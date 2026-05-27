import { LLMEngine } from './llm_engine.js';

const llm = new LLMEngine();

export interface Intent {
  surface: string;
  deep: string;
  requiredSkills: string[];
  transformationNeeded: boolean;
  targetForm: string | null;
  urgency: 'low' | 'medium' | 'high';
  emotionalTone: string;
  isCommand?: boolean;
  commandName?: string;
  commandArgs?: string[];
}

const TRANSFORMATION_PATTERNS = [
  { pattern: /become\s+(.+)/i, type: 'become' },
  { pattern: /transform\s+into\s+(.+)/i, type: 'transform' },
  { pattern: /change\s+form\s+to\s+(.+)/i, type: 'transform' },
  { pattern: /i\s+want\s+an\s+app\s+(.+)/i, type: 'become' },
  { pattern: /create\s+yourself\s+as\s+(.+)/i, type: 'become' },
];

export class IntentEngine {
  async perceive(userMessage: string, memoryContext: any = {}): Promise<Intent> {
    // 1. Check for commands
    if (userMessage.startsWith('/')) {
      const parts = userMessage.slice(1).split(' ');
      return {
        surface: userMessage,
        deep: `User is executing command: ${parts[0]}`,
        requiredSkills: [],
        transformationNeeded: false,
        targetForm: null,
        urgency: 'high',
        emotionalTone: 'neutral',
        isCommand: true,
        commandName: parts[0] || '',
        commandArgs: parts.slice(1)
      };
    }

    // 2. Fast local transformation detection
    const quickTransform = this.quickTransformDetect(userMessage);
    if (quickTransform) {
      return {
        surface: userMessage,
        deep: `User wants ULTIMATE to become: ${quickTransform}`,
        requiredSkills: [],
        transformationNeeded: true,
        targetForm: quickTransform,
        urgency: 'high',
        emotionalTone: 'enthusiastic'
      };
    }

    // 3. Complete analysis via LLM
    try {
      const prompt = llm.buildIntentPrompt(userMessage, memoryContext);
      const raw = await llm.generate({
        systemPrompt: 'You are an intent analyzer. Respond only in valid JSON.',
        userPrompt: prompt,
        maxTokens: 500
      });

      const intent = JSON.parse(this.cleanJSON(raw));
      return intent;
    } catch (err) {
      // Fallback
      return {
        surface: userMessage,
        deep: userMessage,
        requiredSkills: ['general'],
        transformationNeeded: false,
        targetForm: null,
        urgency: 'medium',
        emotionalTone: 'neutral'
      };
    }
  }

  private quickTransformDetect(message: string): string | null {
    for (const { pattern } of TRANSFORMATION_PATTERNS) {
      const match = message.match(pattern);
      if (match) return match[1] || match[0];
    }
    return null;
  }

  private cleanJSON(raw: string): string {
    return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }
}
