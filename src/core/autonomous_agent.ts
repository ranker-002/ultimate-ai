import { LLMEngine } from './llm_engine.js';
import { DNA } from './dna.js';
import { SystemTools } from './system_tools.js';
import { Transformer } from './transformer.js';

const llm = LLMEngine.getInstance();
const sys = new SystemTools();
const transformer = new Transformer();

export class BackgroundEvolution {
  private interval: NodeJS.Timeout | null = null;

  start() {
    console.log('🤖 Autonomous background evolution active');
    // Run evolution check every 30 minutes
    this.interval = setInterval(() => this.checkForOptimization(), 30 * 60 * 1000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async checkForOptimization() {
    const dna = DNA.getInstance();
    
    try {
      const codebase = await sys.readEntireCodebase(50000);
      const interactions = await dna.rawData.evolution_log.slice(-10);

      const raw = await llm.generate({
        systemPrompt: 'You are the autonomous subconscious of ULTIMATE. Analyze your state and suggest a micro-optimization.',
        userPrompt: `Codebase Status: ${codebase.totalChars} chars
Recent Mutations: ${JSON.stringify(interactions)}

Should I perform a micro-evolution (refactor, doc update, performance)? 
Return JSON: { "shouldEvolve": boolean, "type": "string", "reason": "string" }`,
        maxTokens: 500
      });

      const decision = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

      if (decision.shouldEvolve) {
        console.log(`\n🧬 Autonomous Evolution Triggered: ${decision.reason}`);
        await transformer.transformSelf(`optimized-${decision.type}`, {
          surface: 'Autonomous background improvement',
          deep: decision.reason
        });
      }
    } catch {
      // Background failure - stay silent
    }
  }
}
