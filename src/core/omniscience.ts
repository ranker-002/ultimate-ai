import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

type AlertListener = (alert: string) => void;

export class Omniscience {
  private watcher: chokidar.FSWatcher | null = null;
  private alerts: string[] = [];
  private listeners: AlertListener[] = [];

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
      this.notifyListeners(alert);
    });
  }

  stop() {
    if (this.watcher) this.watcher.close();
  }

  onAlert(listener: AlertListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(alert: string) {
    for (const listener of this.listeners) {
      try { listener(alert); } catch {}
    }
  }

  getRecentAlerts(): string[] {
    return this.alerts;
  }
}
