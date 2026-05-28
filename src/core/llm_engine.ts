import { DNA } from './dna.js';

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
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const systemPrompt = options.systemPrompt || '';
    const messages = options.messages || [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.userPrompt || '' }
    ];

    const body = {
      model: options.model || 'qwen/qwen-32b-chat',
      max_tokens: options.maxTokens || 4096,
      messages
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
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
    if (openRouterKey) {
      this.providers['openrouter'] = new OpenRouterProvider(openRouterKey);
    }
    
    // Always add Ollama as a local option
    this.providers['ollama'] = new OllamaProvider();
    
    // Load preference if DNA is available (will be set in boot)
    this.activeProviderName = openRouterKey ? 'openrouter' : 'ollama';
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    const provider = this.providers[this.activeProviderName];
    if (!provider) {
      throw new Error(`Provider ${this.activeProviderName} not configured.`);
    }
    return provider.generate(options);
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
