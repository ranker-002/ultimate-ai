import { SystemTools } from './system_tools.js';

const sys = new SystemTools();

export class GitAutonomy {
  async autoCommit(message: string): Promise<boolean> {
    console.log(`🐙 Git Autonomy: Committing evolution - ${message}`);
    try {
      await sys.exec('git add .');
      const result = await sys.exec(`git commit -m "${message}"`);
      return result.success;
    } catch {
      return false;
    }
  }

  async autoPush(): Promise<boolean> {
    console.log('🐙 Git Autonomy: Synchronizing with remote...');
    const result = await sys.exec('git push origin main');
    return result.success;
  }

  async createEvolutionPR(branchName: string, title: string): Promise<string> {
    try {
      await sys.exec(`git checkout -b ${branchName}`);
      await sys.exec('git add .');
      await sys.exec(`git commit -m "${title}"`);
      await sys.exec(`git push origin ${branchName}`);
      const prResult = await sys.exec(`gh pr create --title "${title}" --body "Autonomous evolution PR."`);
      await sys.exec('git checkout main');
      return prResult.stdout || "PR Created";
    } catch (err: any) {
      return `Failed to create PR: ${err.message}`;
    }
  }
}
