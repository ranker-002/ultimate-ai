import { SystemTools } from './system_tools.js';
import { SnapshotManager } from './snapshot.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const sys = new SystemTools();
const snapshots = new SnapshotManager();

export class SelfHealing {
  async validateBehavior(): Promise<boolean> {
    console.log('🧪 Running behavioral validation...');
    
    // 1. Run Smoke Test
    const smokeResult = await sys.exec('node dist/smoke.test.js');
    if (!smokeResult.success) {
      console.error('❌ Smoke test failed behavior validation');
      return false;
    }

    // 2. Run Type Check
    const buildResult = await sys.exec('npm run build');
    if (!buildResult.success) {
      console.error('❌ Build failed behavior validation');
      return false;
    }

    console.log('✅ Behavioral validation passed');
    return true;
  }

  async heal(snapshotId: string) {
    console.log('🩹 Behavioral error detected. Healing via rollback...');
    await snapshots.rollback(snapshotId);
    await sys.exec('npm run build');
    console.log('✓ System restored to stable state');
  }
}
