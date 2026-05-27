import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DNA_PATH = path.join(__dirname, 'dna.json');

export interface DNAData {
  identity: {
    name: string;
    version: string;
    birth: number;
    currentForm: string;
  };
  mutations: number;
  evolution_log: any[];
  memory: {
    user_preferences: Record<string, any>;
    learned_patterns: string[];
    active_skills: string[];
    transformation_history: any[];
    interaction_count: number;
  };
  capabilities: {
    self_modify: boolean;
    learn_in_realtime: boolean;
    skill_acquisition: string;
    form_limit: string;
  };
}

let _instance: DNA | null = null;

export class DNA {
  private data: DNAData;

  private constructor(data: DNAData) {
    this.data = data;
  }

  static async load(): Promise<DNA> {
    if (_instance) return _instance;
    try {
      const raw = await fs.readFile(DNA_PATH, 'utf-8');
      _instance = new DNA(JSON.parse(raw));
      return _instance;
    } catch (error) {
      // If file doesn't exist, we might need to bootstrap it.
      // For now, we'll throw or expect bootstrap to have run.
      throw new Error(`DNA file not found at ${DNA_PATH}. Run bootstrap first.`);
    }
  }

  static getInstance(): DNA {
    if (!_instance) throw new Error('DNA not loaded. Call DNA.load() first.');
    return _instance;
  }

  async save(): Promise<void> {
    await fs.writeFile(DNA_PATH, JSON.stringify(this.data, null, 2));
  }

  async incrementMutations(transformationDetails: any): Promise<void> {
    this.data.mutations++;
    this.data.identity.version = this.generateVersion();
    this.data.evolution_log.push({
      timestamp: Date.now(),
      mutation: this.data.mutations,
      ...transformationDetails
    });
    
    if (this.data.evolution_log.length > 100) {
      this.data.evolution_log = this.data.evolution_log.slice(-100);
    }
    await this.save();
  }

  async addActiveSkill(skillName: string): Promise<void> {
    if (!this.data.memory.active_skills.includes(skillName)) {
      this.data.memory.active_skills.push(skillName);
      await this.save();
    }
  }

  async updatePreference(key: string, value: any): Promise<void> {
    this.data.memory.user_preferences[key] = value;
    await this.save();
  }

  async logInteraction(): Promise<void> {
    this.data.memory.interaction_count++;
    await this.save();
  }

  private generateVersion(): string {
    const m = this.data.mutations;
    return `${Math.floor(m / 100)}.${Math.floor((m % 100) / 10)}.${m % 10}`;
  }

  get mutations(): number { return this.data.mutations; }
  get currentForm(): string { return this.data.identity.currentForm; }
  get activeSkills(): string[] { return this.data.memory.active_skills; }
  get preferences(): Record<string, any> { return this.data.memory.user_preferences; }
  get rawData(): DNAData { return this.data; }
}
