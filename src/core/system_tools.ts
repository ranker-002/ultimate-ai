import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export interface CodebaseFiles {
  files: Record<string, string>;
  chunked: boolean;
  totalChars: number;
}

export class SystemTools {
  // Execute a shell command
  async exec(command: string, options: any = {}) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd || ROOT,
        timeout: options.timeout || 30000,
        env: { ...process.env, ...options.env }
      });
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err: any) {
      return { success: false, error: err.message, stdout: err.stdout, stderr: err.stderr };
    }
  }

  // Read a file
  async readFile(filePath: string) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  // Write a file
  async writeFile(filePath: string, content: string) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  // Read entire codebase for context window
  async readEntireCodebase(maxChars: number = 100000): Promise<CodebaseFiles> {
    const extensions = ['.ts', '.js', '.json', '.md'];
    const excludeDirs = ['node_modules', 'dist', '.git', 'memory', 'snapshots'];
    const files = await this.getCodebaseFiles(ROOT, extensions, excludeDirs);

    let totalContent = '';
    let totalChars = 0;
    const fileMap: Record<string, string> = {};

    for (const file of files) {
      const relativePath = path.relative(ROOT, file);
      try {
        const content = await fs.readFile(file, 'utf-8');
        fileMap[relativePath] = content;
        totalChars += content.length;
      } catch { /* ignore */ }
    }

    if (totalChars > maxChars) {
      return this.chunkCodebase(fileMap, maxChars);
    }

    return { files: fileMap, chunked: false, totalChars };
  }

  private chunkCodebase(fileMap: Record<string, string>, maxChars: number): CodebaseFiles {
    const priority = ['src/core/', 'src/index.ts', 'package.json'];
    const prioritized: [string, string][] = [];
    const rest: [string, string][] = [];

    for (const [p, content] of Object.entries(fileMap)) {
      if (priority.some(pref => p.startsWith(pref) || p === pref)) {
        prioritized.push([p, content]);
      } else {
        rest.push([p, content]);
      }
    }

    const result: Record<string, string> = {};
    let chars = 0;

    for (const [p, c] of [...prioritized, ...rest]) {
      if (chars + c.length <= maxChars) {
        result[p] = c;
        chars += c.length;
      } else {
        const remaining = maxChars - chars;
        if (remaining > 500 && p.startsWith('src/core/')) {
          result[p] = c.substring(0, remaining) + '\n// [TRUNCATED]';
          chars = maxChars;
        }
        break;
      }
    }

    return { files: result, chunked: true, totalChars: chars };
  }

  private async getCodebaseFiles(dir: string, extensions: string[], excludeDirs: string[]): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          results.push(...await this.getCodebaseFiles(fullPath, extensions, excludeDirs));
        }
      } else if (extensions.includes(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  // Install npm dependencies
  async installDependencies(packages: string[]) {
    console.log(`📦 Installing: ${packages.join(', ')}`);
    const result = await this.exec(`npm install ${packages.join(' ')}`, { timeout: 120000 });
    if (!result.success) throw new Error(`npm install failed: ${result.error}`);
    console.log('✓ Dependencies installed');
    return result;
  }

  // Relaunch ULTIMATE
  async relaunchSelf(newEntryPoint: string = 'dist/index.js') {
    console.log('🔄 Relaunching ULTIMATE...');
    await new Promise(r => setTimeout(r, 500));

    const child = spawn(process.execPath, [path.join(ROOT, newEntryPoint)], {
      detached: true,
      stdio: 'inherit',
      cwd: ROOT,
      env: { ...process.env, ULTIMATE_RELAUNCH: 'true' }
    });

    child.unref();
    setTimeout(() => process.exit(0), 200);
  }

  // Validate JS/TS syntax
  async validateCode(code: string, isTypeScript: boolean = true) {
    const ext = isTypeScript ? '.ts' : '.js';
    const tempFile = path.join(ROOT, `.temp_validate${ext}`);
    try {
      await fs.writeFile(tempFile, code);
      const cmd = isTypeScript ? `npx tsc ${tempFile} --noEmit --esModuleInterop --target esnext --moduleResolution nodenext` : `node --check ${tempFile}`;
      const result = await this.exec(cmd);
      await fs.unlink(tempFile).catch(() => {});
      return result.success;
    } catch {
      await fs.unlink(tempFile).catch(() => {});
      return false;
    }
  }
}
