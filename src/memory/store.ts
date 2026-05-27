import fs from 'fs/promises';
import { createWriteStream, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, 'memory');
const INTERACTIONS_FILE = path.join(MEMORY_DIR, 'interactions.jsonl');
const PREFS_FILE = path.join(MEMORY_DIR, 'preferences.json');

export interface MemoryEntry {
  key: string;
  value: any;
  timestamp: number;
}

export class UniversalMemory {
  private shortTerm: MemoryEntry[] = [];
  private preferences: Record<string, any> = {};

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

      // Load last N interactions from JSONL
      try {
        const raw = await fs.readFile(INTERACTIONS_FILE, 'utf-8');
        const lines = raw.trim().split('\n').filter(l => l.trim());
        this.shortTerm = lines.map(l => JSON.parse(l)).slice(-50);
        console.log(`🧠 Memory restored: ${this.shortTerm.length} recent interactions`);
      } catch {
        this.shortTerm = [];
      }
    } catch (error) {
      console.error('Failed to restore memory', error);
    }
  }

  async remember(key: string, value: any): Promise<void> {
    const entry: MemoryEntry = { key, value, timestamp: Date.now() };

    if (key === 'interaction') {
      this.shortTerm.push(entry);
      if (this.shortTerm.length > 50) {
        this.shortTerm = this.shortTerm.slice(-50);
      }
      // Append to JSONL
      await fs.appendFile(INTERACTIONS_FILE, JSON.stringify(entry) + '\n');
    } else {
      // Store in preferences for other keys
      this.preferences[key] = value;
      await this.persistPrefs();
    }
  }

  async recall(query: string): Promise<MemoryEntry[]> {
    const queryWords = query.toLowerCase().split(' ');
    return this.shortTerm.filter(entry => {
      const entryStr = JSON.stringify(entry).toLowerCase();
      return queryWords.some(w => entryStr.includes(w));
    }).slice(-10);
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
