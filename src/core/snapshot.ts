import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOTS_DIR = path.join(ROOT, 'snapshots');
const MAX_SNAPSHOTS = 10;

export class SnapshotManager {
  async createSnapshot(reason: string = 'pre-transformation'): Promise<string> {
    const timestamp = Date.now();
    const snapshotId = `snapshot_${timestamp}`;
    const snapshotPath = path.join(SNAPSHOTS_DIR, snapshotId);

    await fs.mkdir(snapshotPath, { recursive: true });

    const filesToSnapshot = [
      'src/core/dna.json',
      'src/core/dna.ts',
      'src/core/intent_engine.ts',
      'src/core/transformer.ts',
      'src/core/skill_activator.ts',
      'src/core/evolution_loop.ts',
      'src/core/llm_engine.ts',
      'src/core/snapshot.ts',
      'src/core/bootstrap.ts',
      'src/index.ts',
      'package.json',
      'skills/registry.json'
    ];

    for (const file of filesToSnapshot) {
      const src = path.join(ROOT, file);
      const dst = path.join(snapshotPath, file.replace(/\//g, '__'));
      try {
        await fs.copyFile(src, dst);
      } catch {
        // Optional file — ignore if absent
      }
    }

    await fs.writeFile(
      path.join(snapshotPath, 'meta.json'),
      JSON.stringify({ timestamp, reason, snapshotId }, null, 2)
    );

    await this.pruneOldSnapshots();

    console.log(`📸 Snapshot created: ${snapshotId}`);
    return snapshotId;
  }

  async rollback(snapshotId: string | null = null): Promise<string> {
    const targetId = snapshotId || await this.getLatestSnapshotId();
    if (!targetId) throw new Error('No snapshot available for rollback');

    const snapshotPath = path.join(SNAPSHOTS_DIR, targetId);
    const files = await fs.readdir(snapshotPath);

    for (const file of files) {
      if (file === 'meta.json') continue;
      const src = path.join(snapshotPath, file);
      const originalPath = file.replace(/__/g, '/');
      const dst = path.join(ROOT, originalPath);

      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
    }

    console.log(`⏪ Rollback performed from: ${targetId}`);
    return targetId;
  }

  private async getLatestSnapshotId(): Promise<string | null> {
    try {
        const entries = await fs.readdir(SNAPSHOTS_DIR);
        const snapshots = entries
          .filter(e => e.startsWith('snapshot_'))
          .sort()
          .reverse();
        return snapshots[0] || null;
    } catch {
        return null;
    }
  }

  private async pruneOldSnapshots(): Promise<void> {
    try {
        const entries = await fs.readdir(SNAPSHOTS_DIR);
        const snapshots = entries.filter(e => e.startsWith('snapshot_')).sort();
        while (snapshots.length > MAX_SNAPSHOTS) {
          const old = snapshots.shift();
          if (old) {
            await fs.rm(path.join(SNAPSHOTS_DIR, old), { recursive: true, force: true });
          }
        }
    } catch {}
  }
}
