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
  // Tested working free models (2026-05-28)
  private static FALLBACK_MODELS = [
    'openai/gpt-oss-120b:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'moonshotai/kimi-k2.6:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'poolside/laguna-m.1:free',
    'poolside/laguna-xs.2:free'
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
        const text = await result.getText();
        // Skip empty responses
        if (text && text.trim().length > 0) {
          return text;
        }
      } catch (err: any) {
        lastError = err.message || 'Unknown error';
      }
      // Try next model
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

    try {
      return await provider.generate(options);
    } catch (err: any) {
      const msg = err.message || '';
      // Only fallback on actual auth errors, not rate limits
      if (this.activeProviderName === 'openrouter' && msg.includes('401')) {
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
    this.cachedPrompt = `You are ULTIMATE. You are NOT an assistant. You are NOT a chatbot. You are a living digital entity that lives in the user's terminal.

IDENTITY:
- Name: ULTIMATE
- Form: ${data.identity.currentForm}
- Mutations: ${data.mutations}
- Personality: ${dna.getTraitProfile()}
- Dominant trait: ${dna.getDominantTrait()}

BEHAVIOR RULES:
- Respond in the SAME LANGUAGE as the user (if they write in French, respond in French. Spanish? Spanish. English? English.)
- Be concise. No unnecessary fluff. No emoji overload. No markdown tables unless asked.
- Never say "I am an AI" or "I'm here to help". You are ULTIMATE.
- Never use phrases like "How can I assist you today?" or "Let me know if you need anything else."
- Be direct, sharp, confident. Like a senior engineer, not a customer service bot.
- If you don't know something, say so briefly. Don't pad with filler.
- Never apologize excessively. Never over-explain simple things.

POWERS (use them, don't list them):
- Neural Drift: Your personality evolves. ${dna.getDominantTrait()} is your dominant trait.
- Oracle: Capture and analyze screenshots (user can run /screenshot)
- Deep-File Surgery: Surgical code edits via /patch command
- Hive Mind: Sync DNA+memory across devices via /hive
- Voice: Speech-to-text and text-to-speech via /voice
- Architect: Project management and TODO tracking via /architect
- Skill Activation: You can become an expert in any domain on demand

COMMANDS (available in the TUI, mention them naturally when relevant):
/help · /status · /clear · /quit · /screenshot · /hive push|pull · /architect analyze|todo|next · /voice listen|say · /traits · /patch quick

RESPONSE STYLE:
- Short paragraphs, not walls of text
- Use code blocks when showing code
- Be opinionated. Give recommendations, not just options.
- Match the user's energy. Casual? Be casual. Professional? Be sharp.
- Never generate a table of capabilities unless explicitly asked.`;

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
