import { LLMEngine } from './llm_engine.js';

const llm = LLMEngine.getInstance();

export class SwarmIntelligence {
  async debate(topic: string, agents: string[]): Promise<string> {
    console.log(`🐝 Swarm: Agents [${agents.join(', ')}] debating: ${topic}`);
    
    let consolidatedContext = `Initial Topic: ${topic}\n`;

    for (const agent of agents) {
      const perspective = await llm.generate({
        systemPrompt: `You are agent ${agent}. Provide your unique expert perspective on the topic.`,
        userPrompt: consolidatedContext,
        maxTokens: 1000
      });
      consolidatedContext += `\nPerspective from ${agent}:\n${perspective}\n`;
    }

    const finalSynthesis = await llm.generate({
      systemPrompt: 'You are the Swarm Synthesizer. Consolidate the agent perspectives into a final, highly optimized decision.',
      userPrompt: consolidatedContext,
      maxTokens: 2000
    });

    return finalSynthesis;
  }
}
