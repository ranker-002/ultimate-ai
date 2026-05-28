import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOTS_DIR = path.join(ROOT, 'memory', 'visual_snapshots');

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  timestamp: number;
  mode: 'terminal' | 'screen' | 'window';
  error?: string;
}

export interface VisualAnalysis {
  description: string;
  uiIssues: string[];
  suggestions: string[];
  screenshotPath: string;
}

export class Oracle {
  private screenshotCount = 0;

  async init(): Promise<void> {
    await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
  }

  async captureScreen(): Promise<ScreenshotResult> {
    return this.capture('screen');
  }

  async captureTerminal(): Promise<ScreenshotResult> {
    return this.capture('terminal');
  }

  async captureWindow(windowTitle?: string): Promise<ScreenshotResult> {
    return this.capture('window', windowTitle);
  }

  private async capture(mode: 'terminal' | 'screen' | 'window', target?: string): Promise<ScreenshotResult> {
    const timestamp = Date.now();
    const filePath = path.join(SNAPSHOTS_DIR, `oracle_${timestamp}.png`);

    try {
      if (process.platform === 'linux') {
        await this.captureLinux(mode, filePath, target);
      } else if (process.platform === 'darwin') {
        await this.captureMac(mode, filePath, target);
      } else {
        throw new Error(`Unsupported platform: ${process.platform}`);
      }

      this.screenshotCount++;
      return { success: true, filePath, timestamp, mode };
    } catch (err: any) {
      return { success: false, timestamp, mode, error: err.message };
    }
  }

  private async captureLinux(mode: string, filePath: string, target?: string): Promise<void> {
    switch (mode) {
      case 'screen':
        await execAsync(`scrot "${filePath}" 2>/dev/null || gnome-screenshot -f "${filePath}" 2>/dev/null || import -window root "${filePath}" 2>/dev/null || xfce4-screenshooter -f -s "${filePath}" 2>/dev/null`);
        break;
      case 'terminal':
        await execAsync(`import -window "$(xdotool getactivewindow)" "${filePath}" 2>/dev/null || scrot -u "${filePath}" 2>/dev/null`);
        break;
      case 'window':
        if (target) {
          const wid = await execAsync(`xdotool search --name "${target}" | head -1`);
          await execAsync(`import -window ${wid.stdout.trim()} "${filePath}"`);
        } else {
          await execAsync(`import -window "$(xdotool getactivewindow)" "${filePath}"`);
        }
        break;
    }
  }

  private async captureMac(mode: string, filePath: string, target?: string): Promise<void> {
    switch (mode) {
      case 'screen':
        await execAsync(`screencapture -x "${filePath}"`);
        break;
      case 'terminal':
        await execAsync(`screencapture -x -l$(osascript -e 'tell app "System Events" to tell process 1 to id of window 1') "${filePath}" 2>/dev/null || screencapture -x "${filePath}"`);
        break;
      case 'window':
        await execAsync(`screencapture -x -l$(osascript -e 'tell app "System Events" to tell process 1 to id of window 1') "${filePath}"`);
        break;
    }
  }

  async getRecentScreenshots(limit: number = 5): Promise<string[]> {
    try {
      const files = await fs.readdir(SNAPSHOTS_DIR);
      return files
        .filter(f => f.startsWith('oracle_') && f.endsWith('.png'))
        .sort()
        .reverse()
        .slice(0, limit)
        .map(f => path.join(SNAPSHOTS_DIR, f));
    } catch {
      return [];
    }
  }

  async deleteScreenshot(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {}
  }

  async cleanupOldScreenshots(maxAge: number = 3600000): Promise<void> {
    try {
      const files = await fs.readdir(SNAPSHOTS_DIR);
      const now = Date.now();
      for (const f of files) {
        const fp = path.join(SNAPSHOTS_DIR, f);
        const stat = await fs.stat(fp);
        if (now - stat.mtimeMs > maxAge) {
          await fs.unlink(fp);
        }
      }
    } catch {}
  }

  getScreenshotCount(): number {
    return this.screenshotCount;
  }
}
