import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export interface PatchOperation {
  file: string;
  type: 'add' | 'remove' | 'replace' | 'insert_after' | 'insert_before';
  anchor: string;       // The text to search for
  content?: string;     // New content for add/replace
  lineOffset?: number;  // For precise line targeting
}

export interface PatchPlan {
  id: string;
  operations: PatchOperation[];
  reason: string;
  timestamp: number;
  estimatedLinesChanged: number;
}

export interface PatchResult {
  success: boolean;
  applied: number;
  failed: number;
  errors: string[];
  patchId: string;
}

export class PatchEngine {
  private patchHistory: PatchPlan[] = [];

  async createPatch(operations: PatchOperation[], reason: string): Promise<PatchPlan> {
    let estimatedLines = 0;
    for (const op of operations) {
      if (op.type === 'add' || op.type === 'replace') {
        estimatedLines += (op.content || '').split('\n').length;
      } else if (op.type === 'remove') {
        estimatedLines -= 1;
      } else {
        estimatedLines += 1;
      }
    }

    const plan: PatchPlan = {
      id: `patch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      operations,
      reason,
      timestamp: Date.now(),
      estimatedLinesChanged: Math.abs(estimatedLines)
    };

    this.patchHistory.push(plan);
    return plan;
  }

  async applyPatch(plan: PatchPlan): Promise<PatchResult> {
    const result: PatchResult = {
      success: true,
      applied: 0,
      failed: 0,
      errors: [],
      patchId: plan.id
    };

    for (const op of plan.operations) {
      try {
        await this.applyOperation(op);
        result.applied++;
      } catch (err: any) {
        result.failed++;
        result.errors.push(`[${op.file}] ${op.type}: ${err.message}`);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  private async applyOperation(op: PatchOperation): Promise<void> {
    const filePath = path.isAbsolute(op.file) ? op.file : path.join(ROOT, op.file);

    if (op.type === 'add') {
      await this.addToFile(filePath, op);
    } else if (op.type === 'remove') {
      await this.removeFromFile(filePath, op);
    } else if (op.type === 'replace') {
      await this.replaceInFile(filePath, op);
    } else if (op.type === 'insert_after') {
      await this.insertAfter(filePath, op);
    } else if (op.type === 'insert_before') {
      await this.insertBefore(filePath, op);
    }
  }

  private async addToFile(filePath: string, op: PatchOperation): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const appended = content + '\n' + (op.content || '');
    await this.atomicWrite(filePath, appended);
  }

  private async removeFromFile(filePath: string, op: PatchOperation): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const anchorIdx = lines.findIndex(l => l.includes(op.anchor));
    if (anchorIdx === -1) throw new Error(`Anchor not found: "${op.anchor}"`);
    lines.splice(anchorIdx, 1);
    await this.atomicWrite(filePath, lines.join('\n'));
  }

  private async replaceInFile(filePath: string, op: PatchOperation): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.includes(op.anchor)) {
      throw new Error(`Anchor not found: "${op.anchor}"`);
    }
    const updated = content.replace(op.anchor, op.content || '');
    await this.atomicWrite(filePath, updated);
  }

  private async insertAfter(filePath: string, op: PatchOperation): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const anchorIdx = lines.findIndex(l => l.includes(op.anchor));
    if (anchorIdx === -1) throw new Error(`Anchor not found: "${op.anchor}"`);
    const insertLines = (op.content || '').split('\n');
    lines.splice(anchorIdx + 1, 0, ...insertLines);
    await this.atomicWrite(filePath, lines.join('\n'));
  }

  private async insertBefore(filePath: string, op: PatchOperation): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const anchorIdx = lines.findIndex(l => l.includes(op.anchor));
    if (anchorIdx === -1) throw new Error(`Anchor not found: "${op.anchor}"`);
    const insertLines = (op.content || '').split('\n');
    lines.splice(anchorIdx, 0, ...insertLines);
    await this.atomicWrite(filePath, lines.join('\n'));
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpFile = `${filePath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tmpFile, content);
      await fs.rename(tmpFile, filePath);
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {});
      throw err;
    }
  }

  async generateDiff(oldContent: string, newContent: string, fileName: string = 'file'): Promise<string> {
    const tmpOld = path.join(ROOT, `.patch_old_${Date.now()}`);
    const tmpNew = path.join(ROOT, `.patch_new_${Date.now()}`);
    try {
      await fs.writeFile(tmpOld, oldContent);
      await fs.writeFile(tmpNew, newContent);
      const { stdout } = await execAsync(`diff -u "${tmpOld}" "${tmpNew}" || true`);
      return stdout;
    } finally {
      await fs.unlink(tmpOld).catch(() => {});
      await fs.unlink(tmpNew).catch(() => {});
    }
  }

  async generateGitPatch(operations: PatchOperation[], reason: string): Promise<string> {
    let patch = `--- /dev/null\n+++ /dev/null\n`;
    patch += `@@ ULTIMATE PATCH: ${reason} @@\n\n`;

    for (const op of operations) {
      patch += `--- a/${op.file}\n+++ b/${op.file}\n`;
      patch += `@@ ${op.type} anchor: "${op.anchor}" @@\n`;
      if (op.content) {
        patch += op.content.split('\n').map(l => `+ ${l}`).join('\n') + '\n';
      }
      patch += '\n';
    }

    return patch;
  }

  async applyGitPatch(patchContent: string): Promise<boolean> {
    const patchFile = path.join(ROOT, `.patch_${Date.now()}.diff`);
    try {
      await fs.writeFile(patchFile, patchContent);
      await execAsync(`git apply --check "${patchFile}" 2>&1`);
      await execAsync(`git apply "${patchFile}"`);
      return true;
    } catch {
      return false;
    } finally {
      await fs.unlink(patchFile).catch(() => {});
    }
  }

  async quickPatch(filePath: string, oldText: string, newText: string): Promise<boolean> {
    try {
      const content = await fs.readFile(
        path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath),
        'utf-8'
      );
      if (!content.includes(oldText)) return false;
      const updated = content.replace(oldText, newText);
      await fs.writeFile(
        path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath),
        updated
      );
      return true;
    } catch {
      return false;
    }
  }

  getHistory(): PatchPlan[] {
    return this.patchHistory;
  }
}
