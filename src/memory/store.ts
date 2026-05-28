import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

let pipeline: any = null;
try {
  const mod = await import('@xenova/transformers');
  pipeline = mod.pipeline;
} catch {
  // Embedding engine unavailable — semantic search will use keyword fallback
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, 'memory');
const INTERACTIONS_FILE = path.join(MEMORY_DIR, 'interactions.jsonl');
const PREFS_FILE = path.join(MEMORY_DIR, 'preferences.json');

export interface MemoryEntry {
  key: string;
  value: any;
  timestamp: number;
  embedding?: number[];
}

export class UniversalMemory {
  private shortTerm: MemoryEntry[] = [];
  private preferences: Record<string, any> = {};
  private embedder: any = null;

  async restore(): Promise<void> {
    try {
      await fs.mkdir(MEMORY_DIR, { recursive: true });
      
      // Load Prefs
      try {
        const prefsRaw = await fs.readFile(PREFS_FILE, 'utf-8');
        this.preferences = JSON.parse(prefsRaw);
      } catch {
        this.preferences = {};
      }

      // Load Interactions
      try {
        const raw = await fs.readFile(INTERACTIONS_FILE, 'utf-8');
        const lines = raw.trim().split('\n').filter(l => l.trim());
        this.shortTerm = lines.map(l => JSON.parse(l)).slice(-100);
        console.log(`🧠 High-Fidelity Memory restored: ${this.shortTerm.length} interactions`);
      } catch {
        this.shortTerm = [];
      }

      // Initialize local embedding pipeline
      try {
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✨ Semantic Embedding Engine ready');
      } catch (err) {
        console.error('Failed to init embedding engine, falling back to keywords', err);
      }
    } catch (error) {
      console.error('Failed to restore memory', error);
    }
  }

  async remember(key: string, value: any): Promise<void> {
    const entry: MemoryEntry = { key, value, timestamp: Date.now() };

    if (key === 'interaction') {
      // Generate embedding if possible
      if (this.embedder) {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        const output = await this.embedder(text, { pooling: 'mean', normalize: true });
        entry.embedding = Array.from(output.data);
      }

      this.shortTerm.push(entry);
      if (this.shortTerm.length > 100) this.shortTerm.shift();
      await fs.appendFile(INTERACTIONS_FILE, JSON.stringify(entry) + '\n');
    } else {
      this.preferences[key] = value;
      await this.persistPrefs();
    }
  }

  async recall(query: string, limit: number = 5): Promise<MemoryEntry[]> {
    if (this.embedder) {
      const output = await this.embedder(query, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(output.data) as number[];

      const ranked = this.shortTerm
        .filter(e => e.embedding)
        .map(entry => ({
          entry,
          score: this.cosineSimilarity(queryVector, entry.embedding!)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.entry);

      return ranked;
    }

    // Fallback to keyword overlap if no embedder
    return this.keywordRecall(query, limit);
  }

  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dot = 0;
    for (let i = 0; i < v1.length; i++) dot += v1[i]! * v2[i]!;
    return dot;
  }

  private keywordRecall(query: string, limit: number): MemoryEntry[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    return this.shortTerm
      .map(entry => {
        const entryStr = JSON.stringify(entry).toLowerCase();
        const score = queryWords.filter(w => entryStr.includes(w)).length;
        return { entry, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.entry);
  }

  getRecentContext(n: number = 10): MemoryEntry[] {
    return this.shortTerm.slice(-n);
  }

  getPreference(key: string): any {
    return this.preferences[key];
  }

  async setPreference(key: string, value: any): Promise<void> {
    this.preferences[key] = value;
    await this.persistPrefs();
  }

  private async persistPrefs(): Promise<void> {
    await fs.writeFile(PREFS_FILE, JSON.stringify(this.preferences, null, 2));
  }
}
