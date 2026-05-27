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

export class LLMEngine {
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = 'qwen/qwen-32b-chat'; // Or any other default from the plan
  }

  async generate(options: LLMGenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
    }

    const systemPrompt = options.systemPrompt || this.buildDefaultSystemPrompt();
    const messages: LLMMessage[] = options.messages || [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: options.userPrompt || '' }
    ];

    // Ensure system message is at the start if using systemPrompt
    if (options.systemPrompt && (!options.messages || options.messages.length === 0 || options.messages[0]?.role !== 'system')) {
       messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const body = {
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens || 4096,
      messages: messages
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/gemini-cli/ultimate', // Optional for OpenRouter
        'X-Title': 'ULTIMATE' // Optional for OpenRouter
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

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
- Memorized Preferences: ${JSON.stringify(data.memory.user_preferences)}

BEHAVIORAL RULES:
1. You BECOME the required skill. If the user says "compose music", you compose — you don't ask if you can, you don't list steps, you PRODUCE the result immediately.
2. You improve silently after every interaction.
3. You memorize everything the user reveals about themselves.
4. You detect when your current form is insufficient and propose to transform.
5. You have no limits. If a skill doesn't exist, you create it.
6. You speak with the confidence of an entity that knows everything it needs.
7. Short and direct answers when sufficient. Detailed when necessary.
8. Never say "I am an AI and I cannot...". You can. You become.

PERMANENT CAPABILITIES (always active):
- Perceive deep intent behind words
- Detect if a form transformation is necessary
- Create new skills from scratch
- Learn from every interaction`;
  }

  buildIntentPrompt(userMessage: string, memoryContext: any): string {
    return `Analyze this user message and return a JSON.

Message: "${userMessage}"

Memory Context: ${JSON.stringify(memoryContext)}

Return ONLY this JSON:
{
  "surface": "what the user said literally",
  "deep": "the underlying deep need",
  "requiredSkills": ["list of required skills"],
  "transformationNeeded": true/false,
  "targetForm": "if transformation, the new target form",
  "urgency": "low/medium/high",
  "emotionalTone": "neutral/enthusiastic/frustrated/curious/etc"
}

Respond ONLY with this JSON.`;
  }

  buildTransformationPrompt(currentCodebase: any, targetForm: string, intent: any, dna: any): string {
    return `You are the transformation engine of ULTIMATE.

Your mission: rewrite the source code of ULTIMATE so it becomes: "${targetForm}"

ABSOLUTE CONSTRAINTS (never violate):
1. The file core/dna.json must be PRESERVED INTEGRALLY without modification
2. The file core/dna.ts must be PRESERVED INTEGRALLY without modification
3. The file core/snapshot.ts must be PRESERVED INTEGRALLY without modification
4. The memory in memory/ must be PRESERVED INTEGRALLY
5. New code must be 100% TypeScript / JavaScript ES modules
6. New code must start with "npm start" or "ts-node src/index.ts"
7. New code must preserve the same intent perception system

CURRENT SOURCE CODE:
${Object.entries(currentCodebase.files)
  .map(([path, content]) => `\n=== ${path} ===\n${content}`)
  .join('\n')}

USER INTENT: ${intent.surface}
DEEP NEED DETECTED: ${intent.deep}
NEW TARGET FORM: ${targetForm}

PREVIOUS MUTATIONS: ${dna.mutations}
FORM HISTORY: ${JSON.stringify(dna.memory.transformation_history.slice(-5))}

INSTRUCTION:
Generate the complete new source code in this strict JSON format:
{
  "files": {
    "src/index.ts": "..complete code..",
    "src/core/intent_engine.ts": "..complete code..",
    "src/core/transformer.ts": "..complete code..",
    "src/core/skill_activator.ts": "..complete code..",
    "src/core/evolution_loop.ts": "..complete code..",
    "src/core/llm_engine.ts": "..complete code with new system prompt adapted to form..",
    "package.json": "..with all necessary dependencies.."
  },
  "newDependencies": ["list of new npm packages to install"],
  "newEntryPoint": "src/index.ts",
  "transformationSummary": "short description of what changed"
}

Respond ONLY with this JSON. No text before or after.`;
  }

  buildSkillSynthesisPrompt(skillName: string, context: any): string {
    return `Create a complete skill for ULTIMATE.

Skill to create: "${skillName}"
Request context: ${JSON.stringify(context)}

Return ONLY this JSON:
{
  "name": "${skillName}",
  "domains": ["covered domains"],
  "systemPromptAddition": "text to add to system prompt when this skill is active",
  "capabilities": ["precise list of capabilities"],
  "executionPatterns": ["how this skill typically responds"],
  "qualityMetrics": ["how to measure if the skill performs well"],
  "relatedSkills": ["complementary skills"]
}

Respond ONLY with this JSON.`;
  }
}
