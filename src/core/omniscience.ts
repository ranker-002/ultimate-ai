import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export class Omniscience {
  private watcher: chokidar.FSWatcher | null = null;
  private alerts: string[] = [];

  start(targetDir: string = ROOT) {
    console.log(`👁️ Omniscience active: watching ${targetDir}`);
    this.watcher = chokidar.watch(targetDir, {
      ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/dist/**', '**/snapshots/**'],
      persistent: true
    });

    this.watcher.on('change', (filePath: string) => {
      const fileName = path.basename(filePath);
      const alert = `Proactive Insight: Detected change in ${fileName}. Analyzing potential impact...`;
      this.alerts.push(alert);
      if (this.alerts.length > 5) this.alerts.shift();
    });
  }

  stop() {
    if (this.watcher) this.watcher.close();
  }

  getRecentAlerts(): string[] {
    return this.alerts;
  }
}
