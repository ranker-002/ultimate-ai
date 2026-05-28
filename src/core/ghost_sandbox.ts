import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SystemTools } from './system_tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const GHOST_DIR = path.join(ROOT, 'ghost');

const sys = new SystemTools();

export class GhostSandbox {
  async prepareGhost() {
    await fs.mkdir(GHOST_DIR, { recursive: true });
    // Copy src and package.json to ghost for testing
    await sys.exec(`cp -r src package.json tsconfig.json ${GHOST_DIR}/`);
  }

  async testInGhost(files: Record<string, string>): Promise<boolean> {
    console.log('👻 Ghost Mode: Testing mutation in sandbox...');
    await this.prepareGhost();

    for (const [filePath, content] of Object.entries(files)) {
      const resolved = path.resolve(path.join(GHOST_DIR, filePath));
      if (!resolved.startsWith(path.resolve(GHOST_DIR))) {
        console.warn(`⚠️ Ghost: Skipping path traversal attempt: ${filePath}`);
        continue;
      }
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content);
    }

    // Try to build in ghost
    const result = await sys.exec('npm run build', { cwd: GHOST_DIR });
    
    // Cleanup
    await fs.rm(GHOST_DIR, { recursive: true, force: true });
    
    return result.success;
  }
}
