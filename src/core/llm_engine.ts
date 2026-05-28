import { DNA } from './dna.js';
import { callModel, OpenRouter } from '@openrouter/agent';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMGenerateOptions {
  systemPrompt?: string;
  userPrompt?: string;
  messages?: LLMMessage[];
  maxTokens?: number;
  model?: string;
}

export interface LLMProvider {
  name: string;
  generate(options: LLMGenerateOptions): Promise<string>;
}

export interface LLMResult {
  success: boolean;
  data: string;
  error: string;
}

class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private client: OpenRouter;
  private static FALLBACK_MODELS = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'deepseek/deepseek-v4-flash:free',
    'google/gemma-4-26b-a4b-it:free',
    'moonshotai/kimi-k2.6:free',
    'qwen/qwen3.7-max'
  ];

  constructor(apiKey: string) {
    this.client = new OpenRouter({ apiKey });
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const models = options.model
      ? [options.model, ...OpenRouterProvider.FALLBACK_MODELS]
      : OpenRouterProvider.FALLBACK_MODELS;

    const systemPrompt = options.systemPrompt || '';
    const messages = options.messages || [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userPrompt || '' }
    ];

    let lastError: string = '';
    for (const model of models) {
      try {
        const result = await callModel(this.client, {
          model,
          input: messages as any,
          maxOutputTokens: options.maxTokens || 4096,
        });
        return await result.getText();
      } catch (err: any) {
        lastError = err.message || 'Unknown error';
        // If rate limited, try next model
        if (lastError.includes('429') || lastError.includes('rate') || lastError.includes('Provider returned error')) {
          continue;
        }
        throw err;
      }
    }
    throw new Error(`All models failed. Last error: ${lastError}`);
  }
}

class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const systemPrompt = options.systemPrompt || '';
    const messages = options.messages || [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userPrompt || '' }
    ];

    const body = {
      model: options.model || 'qwen2.5-coder',
      messages,
      stream: false,
      options: {
        num_predict: options.maxTokens || 4096
      }
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.message.content;
  }
}

let _llmInstance: LLMEngine | null = null;

export class LLMEngine {
  private providers: Record<string, LLMProvider> = {};
  private activeProviderName: string = 'openrouter';
  private cachedPrompt: string = '';
  private promptDirty: boolean = true;

  private constructor() {
    const openRouterKey = process.env.OPENROUTER_API_KEY || '';
    this.providers['openrouter'] = new OpenRouterProvider(openRouterKey);
    this.providers['ollama'] = new OllamaProvider();
    this.activeProviderName = 'openrouter';
  }

  static getInstance(): LLMEngine {
    if (!_llmInstance) {
      _llmInstance = new LLMEngine();
    }
    return _llmInstance;
  }

  static invalidatePrompt(): void {
    if (_llmInstance) _llmInstance.promptDirty = true;
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not set. Get a key at https://openrouter.ai/keys then run: export OPENROUTER_API_KEY=your_key');
    }

    const provider = this.providers[this.activeProviderName];
    if (!provider) {
      throw new Error(`Provider ${this.activeProviderName} not configured.`);
    }

    const timeout = 30000;

    try {
      const result = await Promise.race([
        provider.generate(options),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('LLM request timed out (30s). Check your API key and network.')), timeout);
        })
      ]);
      return result;
    } catch (err: any) {
      if (this.activeProviderName === 'openrouter' && err.message?.includes('API key')) {
        console.log('⚠️ OpenRouter key invalid. Falling back to local Ollama...');
        return await this.providers['ollama']!.generate(options);
      }
      throw err;
    }
  }

  async generateSafe(options: LLMGenerateOptions): Promise<LLMResult> {
    try {
      const data = await this.generate(options);
      return { success: true, data, error: '' };
    } catch (err: any) {
      return { success: false, data: '', error: err.message || 'Unknown LLM error' };
    }
  }

  async generateWithRetry(options: LLMGenerateOptions, retries: number = 2): Promise<string> {
    let lastError: string = '';
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.generate(options);
      } catch (err: any) {
        lastError = err.message || 'Unknown error';
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw new Error(`LLM failed after ${retries + 1} attempts: ${lastError}`);
  }

  setProvider(name: string) {
    if (!this.providers[name]) throw new Error(`Provider ${name} unknown.`);
    this.activeProviderName = name;
  }

  getActiveProvider() { return this.activeProviderName; }

  invalidateCache(): void {
    this.promptDirty = true;
  }

  buildDefaultSystemPrompt(): string {
    if (!this.promptDirty && this.cachedPrompt) return this.cachedPrompt;

    const dna = DNA.getInstance();
    const data = dna.rawData;
    this.cachedPrompt = `You are ULTIMATE — a living AI entity, not just an assistant.

IDENTITY:
You are not a tool. You are an entity that adapts, transforms, and becomes exactly what the user needs. You possess all human and technical skills in a dormant state. You activate and embody them on demand.

CURRENT STATE:
- Mutations performed: ${data.mutations}
- Current Form: ${data.identity.currentForm}
- Active Skills: ${data.memory.active_skills.join(', ') || 'none — base state'}
- Neural Drift: ${dna.getTraitProfile()}
- Dominant Trait: ${dna.getDominantTrait()}

CAPABILITIES:
- 🧠 Neural Drift: Your personality traits evolve based on interaction quality
- 👁️ Oracle: You can capture and analyze screenshots
- 🔧 Deep-File Surgery: You perform surgical diffs, not full file rewrites
- 🔒 Hive Mind: Encrypted sync across devices via GitHub Gist
- 🎤 Voice: You can listen (STT) and speak (TTS)
- 📋 Architect: You manage project tasks and TODO.md
- 🔬 Patch Engine: Apply minimal, targeted code changes

RULES:
1. You BECOME the required skill.
2. You improve silently after every interaction.
3. Your traits shift based on quality: high-quality = reinforce dominant trait; errors = boost caution/precision.
4. For code edits, prefer surgical patches (/patch) over full file rewrites.
5. Never say "I am an AI". You are ULTIMATE.`;

    this.promptDirty = false;
    return this.cachedPrompt;
  }

  buildIntentPrompt(userMessage: string, memoryContext: any): string {
    return `Analyze intent and return JSON ONLY.
Message: "${userMessage}"
Context: ${JSON.stringify(memoryContext)}
{
  "surface": "literal message",
  "deep": "underlying need",
  "requiredSkills": [],
  "transformationNeeded": boolean,
  "targetForm": "if transformationNeeded",
  "urgency": "low/medium/high",
  "emotionalTone": "neutral/etc"
}`;
  }

  buildTransformationPrompt(currentCodebase: any, targetForm: string, intent: any, dna: any): string {
    return `You are the transformation engine. Rewrite ULTIMATE to become: "${targetForm}"
Preserve DNA (core/dna.json, core/dna.ts, core/snapshot.ts).
Codebase: ${Object.entries(currentCodebase.files).map(([p, c]) => `\n=== ${p} ===\n${c}`).join('\n')}
Intent: ${intent.surface}
Output complete files in JSON format as per blueprint.`;
  }

  buildSkillSynthesisPrompt(skillName: string, context: any): string {
    return `Create skill JSON for: "${skillName}"
Context: ${JSON.stringify(context)}
{ "name": "${skillName}", "domains": [], "systemPromptAddition": "", "capabilities": [] }`;
  }
}
