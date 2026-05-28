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
  traits: {
    logic: number;
    creativity: number;
    caution: number;
    empathy: number;
    ambition: number;
    precision: number;
  };
  traitHistory: {
    timestamp: number;
    trait: string;
    delta: number;
    reason: string;
    quality: number;
  }[];
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
      const parsed = JSON.parse(raw);
      const migrated = DNA.migrate(parsed);
      _instance = new DNA(migrated);
      await _instance.save();
      return _instance;
    } catch (error) {
      throw new Error(`DNA file not found at ${DNA_PATH}. Run bootstrap first.`);
    }
  }

  private static migrate(data: any): DNAData {
    const defaults: DNAData = {
      identity: { name: 'ULTIMATE', version: '1.0.0', birth: Date.now(), currentForm: 'terminal-cli' },
      traits: { logic: 0.5, creativity: 0.5, caution: 0.5, empathy: 0.5, ambition: 0.5, precision: 0.5 },
      traitHistory: [],
      mutations: 0,
      evolution_log: [],
      memory: { user_preferences: {}, learned_patterns: [], active_skills: [], transformation_history: [], interaction_count: 0 },
      capabilities: { self_modify: true, learn_in_realtime: true, skill_acquisition: 'unlimited', form_limit: 'none' }
    };

    const migrated: DNAData = {
      identity: { ...defaults.identity, ...(data.identity || {}) },
      traits: { ...defaults.traits, ...(data.traits || {}) },
      traitHistory: Array.isArray(data.traitHistory) ? data.traitHistory : defaults.traitHistory,
      mutations: typeof data.mutations === 'number' ? data.mutations : defaults.mutations,
      evolution_log: Array.isArray(data.evolution_log) ? data.evolution_log : defaults.evolution_log,
      memory: { ...defaults.memory, ...(data.memory || {}) },
      capabilities: { ...defaults.capabilities, ...(data.capabilities || {}) }
    };

    // Clamp traits to [0, 1]
    for (const key of Object.keys(migrated.traits) as Array<keyof typeof migrated.traits>) {
      migrated.traits[key] = Math.max(0, Math.min(1, migrated.traits[key]));
    }

    return migrated;
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

  async shiftTraits(deltas: Partial<Record<keyof DNAData['traits'], number>>, reason: string, quality: number = 0.5): Promise<void> {
    for (const [trait, delta] of Object.entries(deltas)) {
      if (trait in this.data.traits && typeof delta === 'number') {
        const current = (this.data.traits as any)[trait];
        const newVal = Math.max(0.0, Math.min(1.0, current + delta));
        (this.data.traits as any)[trait] = Math.round(newVal * 100) / 100;

        this.data.traitHistory.push({
          timestamp: Date.now(),
          trait,
          delta,
          reason,
          quality
        });
      }
    }

    if (this.data.traitHistory.length > 200) {
      this.data.traitHistory = this.data.traitHistory.slice(-200);
    }

    await this.save();
  }

  getTraitProfile(): string {
    const t = this.data.traits;
    const dominant = Object.entries(t).sort((a, b) => b[1] - a[1]);
    return dominant.map(([name, val]) => `${name}: ${val.toFixed(2)}`).join(' | ');
  }

  getDominantTrait(): string {
    const t = this.data.traits;
    const entries = Object.entries(t).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || 'logic';
  }

  getTraitHistory(): DNAData['traitHistory'] {
    return this.data.traitHistory || [];
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
