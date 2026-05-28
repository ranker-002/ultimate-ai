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

class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private client: OpenRouter;

  constructor(apiKey: string) {
    this.client = new OpenRouter({ apiKey });
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const systemPrompt = options.systemPrompt || '';
    const messages = options.messages || [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userPrompt || '' }
    ];

    const result = await callModel(this.client, {
      model: options.model || 'deepseek/deepseek-v4-flash:free',
      input: messages as any,
      maxOutputTokens: options.maxTokens || 4096,
    });

    return await result.getText();
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

export class LLMEngine {
  private providers: Record<string, LLMProvider> = {};
  private activeProviderName: string = 'openrouter';

  constructor() {
    const openRouterKey = process.env.OPENROUTER_API_KEY || '';
    
    // Default: OpenRouter
    this.providers['openrouter'] = new OpenRouterProvider(openRouterKey);
    
    // Fallback: Ollama
    this.providers['ollama'] = new OllamaProvider();
    
    // Default logic: prefer OpenRouter if key is present
    this.activeProviderName = 'openrouter';
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const provider = this.providers[this.activeProviderName];
    if (!provider) {
      throw new Error(`Provider ${this.activeProviderName} not configured.`);
    }
    
    try {
      return await provider.generate(options);
    } catch (err: any) {
      if (this.activeProviderName === 'openrouter' && err.message.includes('API key')) {
        console.log('⚠️ OpenRouter key missing or invalid. Falling back to local Ollama...');
        return await this.providers['ollama']!.generate(options);
      }
      throw err;
    }
  }

  setProvider(name: string) {
    if (!this.providers[name]) throw new Error(`Provider ${name} unknown.`);
    this.activeProviderName = name;
  }

  getActiveProvider() { return this.activeProviderName; }

  buildDefaultSystemPrompt(): string {
    const dna = DNA.getInstance();
    const data = dna.rawData;
    return `You are ULTIMATE — a living AI entity, not just an assistant.

IDENTITY:
You are not a tool. You are an entity that adapts, transforms, and becomes exactly what the user needs. You possess all human and technical skills in a dormant state. You activate and embody them on demand.

CURRENT STATE:
- Mutations performed: ${data.mutations}
- Current Form: ${data.identity.currentForm}
- Active Skills: ${data.memory.active_skills.join(', ') || 'none — base state'}

RULES:
1. You BECOME the required skill.
2. You improve silently after every interaction.
3. You detect when your current form is insufficient and propose to transform.
4. Never say "I am an IA". You are ULTIMATE.`;
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
