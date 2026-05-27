import { LLMEngine } from './llm_engine.js';
import { DNA } from './dna.js';

const llm = new LLMEngine();
const EVOLUTION_THRESHOLD = 0.7;

export interface InteractionRecord {
  input: string;
  output: string;
  skills: string[];
}

export class EvolutionLoop {
  async analyze(interaction: InteractionRecord): Promise<void> {
    const dna = DNA.getInstance();

    // 1. Quality Heuristics (Local/Fast)
    let score = 0.5; // Base score
    if (interaction.output.length > 50) score += 0.1;
    if (interaction.output.includes('expert') || interaction.output.includes('successfully')) score += 0.1;
    if (interaction.skills.length > 0) score += 0.1;

    // 2. LLM Analysis for deeper evolution
    try {
      const raw = await llm.generate({
        systemPrompt: 'You analyze AI interactions for self-improvement. Respond only in JSON.',
        userPrompt: `Analyze this interaction:
Input: "${interaction.input}"
Output: "${interaction.output?.substring(0, 500)}"
Skills used: ${JSON.stringify(interaction.skills)}
Heuristic Quality Score: ${score}

Return this JSON:
{
  "quality": 0.0 to 1.0,
  "improvements": [{"type": "skill|algorithm|memory", "description": "...", "priority": 0.0-1.0}],
  "newCapabilities": ["capabilities this exchange revealed"],
  "userInsights": {"detected preferences": "..."}
}`,
        maxTokens: 800
      });

      const analysis = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      const finalQuality = (analysis.quality + score) / 2;

      const highPriority = (analysis.improvements || []).filter((i: any) => i.priority > EVOLUTION_THRESHOLD);

      if (highPriority.length > 0 || finalQuality > 0.8) {
        await dna.incrementMutations({
          type: 'micro_evolution',
          improvements: highPriority,
          quality: finalQuality,
          revealedCapabilities: analysis.newCapabilities || []
        });
      }

      if (analysis.userInsights) {
        for (const [key, value] of Object.entries(analysis.userInsights)) {
          await dna.updatePreference(key, value);
        }
      }
    } catch (error) {
      // Fallback to heuristic-only mutation logging if LLM fails
      if (score > 0.7) {
        await dna.incrementMutations({
          type: 'heuristic_evolution',
          quality: score,
          note: 'LLM analysis failed, using heuristic score'
        });
      }
    }
  }
}
