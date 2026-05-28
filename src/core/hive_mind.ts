import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SYNC_CONFIG = path.join(ROOT, '.hive_sync.json');

export interface HiveSyncConfig {
  gistId: string;
  lastSyncTime: number;
  deviceFingerprint: string;
  syncEnabled: boolean;
  encryptionKey: string;
}

export interface SyncPayload {
  dna: any;
  preferences: any;
  interactions: any[];
  skills: any;
  timestamp: number;
  deviceOrigin: string;
  version: string;
}

export class HiveMind {
  private config: HiveSyncConfig = {
    gistId: '',
    lastSyncTime: 0,
    deviceFingerprint: '',
    syncEnabled: false,
    encryptionKey: ''
  };

  private configured = false;
  private static KEY_BACKUP = path.join(ROOT, '.hive_key_backup');

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(SYNC_CONFIG, 'utf-8');
      const parsed = JSON.parse(raw);
      this.config = {
        gistId: parsed.gistId || '',
        lastSyncTime: parsed.lastSyncTime || 0,
        deviceFingerprint: parsed.deviceFingerprint || crypto.randomBytes(16).toString('hex'),
        syncEnabled: parsed.syncEnabled || false,
        encryptionKey: parsed.encryptionKey || ''
      };
      this.configured = true;
    } catch {
      this.config = {
        gistId: '',
        lastSyncTime: 0,
        deviceFingerprint: crypto.randomBytes(16).toString('hex'),
        syncEnabled: false,
        encryptionKey: ''
      };
      this.configured = false;
      await this.saveConfig();
    }

    // Recover key from backup if primary is missing
    if (!this.config.encryptionKey) {
      try {
        const backup = await fs.readFile(HiveMind.KEY_BACKUP, 'utf-8');
        this.config.encryptionKey = backup.trim();
        await this.saveConfig();
      } catch {}
    }
  }

  private async saveConfig(): Promise<void> {
    await fs.writeFile(SYNC_CONFIG, JSON.stringify(this.config, null, 2));
    // Always backup the key separately
    if (this.config.encryptionKey) {
      await fs.writeFile(HiveMind.KEY_BACKUP, this.config.encryptionKey);
    }
  }

  private async checkGhCli(): Promise<boolean> {
    try {
      const result = await execAsync('gh auth status 2>&1');
      return result.stdout.includes('Logged in') || result.stdout.includes('github.com');
    } catch {
      return false;
    }
  }

  private encrypt(data: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedData: string, key: string): string {
    const parts = encryptedData.split(':');
    const ivHex = parts[0] || '';
    const encContent = parts.slice(1).join(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private async collectLocalData(): Promise<SyncPayload> {
    const dnaPath = path.join(ROOT, 'dist', 'core', 'dna.json');
    const prefsPath = path.join(ROOT, 'memory', 'preferences.json');
    const interactionsPath = path.join(ROOT, 'memory', 'interactions.jsonl');
    const skillsPath = path.join(ROOT, 'skills', 'registry.json');

    let dna: any = {};
    let preferences: any = {};
    let interactions: any[] = [];
    let skills: any = {};

    try { dna = JSON.parse(await fs.readFile(dnaPath, 'utf-8')); } catch {}
    try { preferences = JSON.parse(await fs.readFile(prefsPath, 'utf-8')); } catch {}
    try {
      const raw = await fs.readFile(interactionsPath, 'utf-8');
      interactions = raw.trim().split('\n').filter(l => l.trim()).map(l => JSON.parse(l)).slice(-50);
    } catch {}
    try { skills = JSON.parse(await fs.readFile(skillsPath, 'utf-8')); } catch {}

    return {
      dna,
      preferences,
      interactions,
      skills,
      timestamp: Date.now(),
      deviceOrigin: this.config.deviceFingerprint.slice(0, 8),
      version: dna.identity?.version || '0.0.0'
    };
  }

  async push(): Promise<{ success: boolean; gistId: string; message: string }> {
    if (!this.config.gistId) await this.init();
    if (!(await this.checkGhCli())) {
      return { success: false, gistId: '', message: 'gh CLI not authenticated. Run: gh auth login' };
    }

    const payload = await this.collectLocalData();
    const payloadJson = JSON.stringify(payload, null, 2);

    const key = crypto.randomBytes(32).toString('hex');
    const encrypted = this.encrypt(payloadJson, key);

    const description = `ULTIMATE Hive Sync — v${payload.version} — ${new Date().toISOString()}`;
    const filename = `ultimate_hive_${this.config.deviceFingerprint.slice(0, 8)}.json`;

    try {
      if (this.config.gistId) {
        await execAsync(`gh gist edit ${this.config.gistId} -f "${filename}" -c '${encrypted.replace(/'/g, "'\\''")}'`);
        this.config.lastSyncTime = Date.now();
        await this.saveConfig();
        return { success: true, gistId: this.config.gistId, message: `Updated gist ${this.config.gistId}` };
      } else {
        const tmpFile = path.join(ROOT, `.hive_payload_${Date.now()}`);
        await fs.writeFile(tmpFile, encrypted);
        const { stdout } = await execAsync(`gh gist create "${tmpFile}" --desc "${description}" --public=false`);
        await fs.unlink(tmpFile).catch(() => {});
        const gistUrl = stdout.trim();
        const gistId = gistUrl.split('/').pop()?.trim() || '';
        this.config.gistId = gistId;
        this.config.lastSyncTime = Date.now();
        this.config.encryptionKey = key;
        await this.saveConfig();
        return { success: true, gistId, message: `Created gist ${gistId}` };
      }
    } catch (err: any) {
      return { success: false, gistId: '', message: `Sync failed: ${err.message}` };
    }
  }

  async pull(): Promise<{ success: boolean; data: SyncPayload | null; message: string }> {
    if (!this.config.gistId) await this.init();
    if (!this.config.gistId) {
      return { success: false, data: null, message: 'No gist configured. Push first to create one.' };
    }
    if (!(await this.checkGhCli())) {
      return { success: false, data: null, message: 'gh CLI not authenticated.' };
    }

    try {
      const { stdout } = await execAsync(`gh gist view ${this.config.gistId} --json files`);
      const gistData = JSON.parse(stdout);
      const files = gistData.files;
      const fileKeys = Object.keys(files);
      if (fileKeys.length === 0) return { success: false, data: null, message: 'Empty gist' };

      const fileKey = fileKeys[0]!;
      const fileData = files[fileKey];
      const encryptedContent: string = fileData?.content || '';

      if (!this.config.encryptionKey) {
        return { success: false, data: null, message: 'No encryption key stored. Cannot decrypt remote data.' };
      }

      const decrypted = this.decrypt(encryptedContent, this.config.encryptionKey);
      const payload: SyncPayload = JSON.parse(decrypted);

      await this.applyPayload(payload);

      this.config.lastSyncTime = Date.now();
      await this.saveConfig();

      return { success: true, data: payload, message: `Pulled from device ${payload.deviceOrigin} (v${payload.version})` };
    } catch (err: any) {
      return { success: false, data: null, message: `Pull failed: ${err.message}` };
    }
  }

  private async applyPayload(payload: SyncPayload): Promise<void> {
    const dnaPath = path.join(ROOT, 'dist', 'core', 'dna.json');
    try {
      const localDna = JSON.parse(await fs.readFile(dnaPath, 'utf-8'));
      if (payload.dna.mutations > localDna.mutations) {
        await fs.writeFile(dnaPath, JSON.stringify(payload.dna, null, 2));
      }
    } catch {
      await fs.writeFile(dnaPath, JSON.stringify(payload.dna, null, 2));
    }

    const prefsPath = path.join(ROOT, 'memory', 'preferences.json');
    try {
      const localPrefs = JSON.parse(await fs.readFile(prefsPath, 'utf-8'));
      const merged = { ...payload.preferences, ...localPrefs };
      await fs.writeFile(prefsPath, JSON.stringify(merged, null, 2));
    } catch {
      await fs.writeFile(prefsPath, JSON.stringify(payload.preferences, null, 2));
    }

    const interactionsPath = path.join(ROOT, 'memory', 'interactions.jsonl');
    try {
      const existing = await fs.readFile(interactionsPath, 'utf-8');
      const existingLines = existing.trim().split('\n').filter(l => l.trim());
      const existingTimestamps = new Set(existingLines.map(l => JSON.parse(l).timestamp));
      const newEntries = payload.interactions.filter(i => !existingTimestamps.has(i.timestamp));
      if (newEntries.length > 0) {
        const additions = newEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
        await fs.appendFile(interactionsPath, additions);
      }
    } catch {
      const content = payload.interactions.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.writeFile(interactionsPath, content);
    }

    const skillsPath = path.join(ROOT, 'skills', 'registry.json');
    try {
      const localSkills = JSON.parse(await fs.readFile(skillsPath, 'utf-8'));
      const remoteSkills = payload.skills?.skills || [];
      const existingNames = new Set(localSkills.skills.map((s: any) => s.name));
      for (const skill of remoteSkills) {
        if (!existingNames.has(skill.name)) {
          localSkills.skills.push(skill);
        }
      }
      await fs.writeFile(skillsPath, JSON.stringify(localSkills, null, 2));
    } catch {
      await fs.writeFile(skillsPath, JSON.stringify(payload.skills, null, 2));
    }
  }

  async getStatus(): Promise<{ configured: boolean; gistId: string; lastSync: string; device: string }> {
    if (!this.config.gistId) await this.init();
    return {
      configured: this.config.gistId !== '',
      gistId: this.config.gistId,
      lastSync: this.config.lastSyncTime > 0 ? new Date(this.config.lastSyncTime).toISOString() : '',
      device: this.config.deviceFingerprint.slice(0, 8)
    };
  }

  async reset(): Promise<void> {
    this.config = {
      gistId: '',
      lastSyncTime: 0,
      deviceFingerprint: crypto.randomBytes(16).toString('hex'),
      syncEnabled: false,
      encryptionKey: ''
    };
    await this.saveConfig();
  }
}
