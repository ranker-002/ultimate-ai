import { LLMEngine } from './llm_engine.js';
import { DNA } from './dna.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const REGISTRY_PATH = path.join(SKILLS_DIR, 'registry.json');

const llm = new LLMEngine();

export interface SkillDef {
  name: string;
  domains: string[];
  systemPromptAddition: string;
  capabilities: string[];
  executionPatterns: string[];
  qualityMetrics: string[];
  relatedSkills: string[];
}

export class SkillActivator {
  private activeSkillPrompts: string[] = [];

  async identifyRequired(intent: any): Promise<string[]> {
    return intent.requiredSkills || [];
  }

  async activate(skillName: string, intent: any): Promise<SkillDef> {
    const dna = DNA.getInstance();

    let skillDef = await this.loadFromRegistry(skillName);

    if (!skillDef) {
      console.log(`🔬 Synthesizing new skill: ${skillName}`);
      skillDef = await this.synthesizeSkill(skillName, intent);
      await this.saveToRegistry(skillDef);
    }

    if (!this.activeSkillPrompts.includes(skillDef.systemPromptAddition)) {
        this.activeSkillPrompts.push(skillDef.systemPromptAddition);
    }
    await dna.addActiveSkill(skillName);

    console.log(`✓ Skill activated: ${skillName}`);
    return skillDef;
  }

  private async synthesizeSkill(skillName: string, context: any): Promise<SkillDef> {
    const prompt = llm.buildSkillSynthesisPrompt(skillName, context);
    const raw = await llm.generate({
      systemPrompt: 'You create skill definitions. Respond only in valid JSON.',
      userPrompt: prompt,
      maxTokens: 2000
    });

    try {
      return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      return {
        name: skillName,
        domains: [skillName],
        systemPromptAddition: `You now master the domain: ${skillName}. Produce expert results in this field.`,
        capabilities: [`Expert in ${skillName}`],
        executionPatterns: ['Direct and expert response'],
        qualityMetrics: ['Accuracy', 'Relevance'],
        relatedSkills: []
      };
    }
  }

  getActiveContext(): string {
    return this.activeSkillPrompts.join('\n\n');
  }

  private async loadFromRegistry(skillName: string): Promise<SkillDef | null> {
    try {
      const raw = await fs.readFile(REGISTRY_PATH, 'utf-8');
      const registry = JSON.parse(raw);
      return registry.skills.find((s: any) => s.name === skillName) || null;
    } catch {
      return null;
    }
  }

  private async saveToRegistry(skillDef: SkillDef): Promise<void> {
    try {
      let registry: any = { skills: [] };
      try {
        const raw = await fs.readFile(REGISTRY_PATH, 'utf-8');
        registry = JSON.parse(raw);
      } catch {}
      
      registry.skills.push({ ...skillDef, status: 'synthesized' });
      await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
    } catch (error) {
      console.error('Failed to save skill to registry', error);
    }
  }
}
