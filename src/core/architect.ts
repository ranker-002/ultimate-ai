import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LLMEngine } from './llm_engine.js';
import { SystemTools } from './system_tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'deferred';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number;
  dependencies: string[];
  notes: string;
}

export interface ProjectContext {
  name: string;
  description: string;
  techStack: string[];
  currentPhase: string;
  milestones: { name: string; status: string; dueDate: string }[];
}

const TODO_PATH = path.join(ROOT, 'TODO.md');
const PROJECT_META_PATH = path.join(ROOT, '.architect.json');

const llm = new LLMEngine();
const sys = new SystemTools();

export class Architect {
  private tasks: ProjectTask[] = [];
  private context: ProjectContext = {
    name: '',
    description: '',
    techStack: [],
    currentPhase: 'development',
    milestones: []
  };

  async init(): Promise<void> {
    await this.syncFromTODO();
    try {
      const raw = await fs.readFile(PROJECT_META_PATH, 'utf-8');
      this.context = JSON.parse(raw);
    } catch {}
  }

  async analyzeProject(): Promise<ProjectContext> {
    const codebase = await sys.readEntireCodebase(50000);

    const raw = await llm.generate({
      systemPrompt: 'You are a project architect. Analyze the codebase and return JSON only.',
      userPrompt: `Analyze this project and describe:
1. Project name and description
2. Tech stack (languages, frameworks, libraries)
3. Current development phase
4. Key milestones and their status

Codebase files: ${Object.keys(codebase.files).join(', ')}
package.json contents: ${codebase.files['package.json'] || 'N/A'}
README: ${(codebase.files['README.md'] || '').substring(0, 500)}

Return JSON:
{
  "name": "project name",
  "description": "...",
  "techStack": [],
  "currentPhase": "planning|development|testing|deployment|maintenance",
  "milestones": [{"name": "...", "status": "todo|in_progress|done", "dueDate": ""}]
}`,
      maxTokens: 1000
    });

    try {
      const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      this.context = {
        name: parsed.name || path.basename(ROOT),
        description: parsed.description || '',
        techStack: parsed.techStack || [],
        currentPhase: parsed.currentPhase || 'development',
        milestones: (parsed.milestones || []).map((m: any) => ({
          name: m.name || '',
          status: m.status || 'todo',
          dueDate: m.dueDate || ''
        }))
      };
    } catch {
      this.context = {
        name: path.basename(ROOT),
        description: 'Detected project',
        techStack: [],
        currentPhase: 'development',
        milestones: []
      };
    }

    await fs.writeFile(PROJECT_META_PATH, JSON.stringify(this.context, null, 2));
    return this.context;
  }

  async generateTODO(): Promise<string> {
    if (!this.context.name) await this.analyzeProject();

    const codebase = await sys.readEntireCodebase(30000);

    const raw = await llm.generate({
      systemPrompt: 'You are a project manager. Generate a TODO list. Return ONLY the TODO markdown content.',
      userPrompt: `Project: ${this.context.name}
Phase: ${this.context.currentPhase}
Tech Stack: ${this.context.techStack.join(', ')}
Milestones: ${JSON.stringify(this.context.milestones)}
Files: ${Object.keys(codebase.files).join(', ')}

Generate a comprehensive TODO.md with:
1. Project overview
2. Current sprint/phase goals
3. Task breakdown with priorities
4. Dependencies between tasks
5. Notes for each task

Format as clean markdown with checkboxes: [ ] for pending, [x] for done.
Use ## headers for sections and - for task items.
Include priority labels: [CRITICAL], [HIGH], [MEDIUM], [LOW].`,
      maxTokens: 3000
    });

    const todoContent = raw.replace(/```markdown\n?/g, '').replace(/```\n?/g, '').trim();
    await fs.writeFile(TODO_PATH, todoContent);

    this.tasks = this.parseTasksFromMarkdown(todoContent);
    return todoContent;
  }

  async syncFromTODO(): Promise<void> {
    try {
      const content = await fs.readFile(TODO_PATH, 'utf-8');
      this.tasks = this.parseTasksFromMarkdown(content);
    } catch {
      this.tasks = [];
    }
  }

  private parseTasksFromMarkdown(content: string): ProjectTask[] {
    const tasks: ProjectTask[] = [];
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const sectionMatch = line.match(/^##\s+(.+)/);
      if (sectionMatch) {
        currentSection = sectionMatch[1]?.trim() || '';
        continue;
      }

      const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/);
      if (taskMatch) {
        const done = taskMatch[1] === 'x';
        const text = taskMatch[2] || '';

        let priority: ProjectTask['priority'] = 'medium';
        if (text.includes('[CRITICAL]')) priority = 'critical';
        else if (text.includes('[HIGH]')) priority = 'high';
        else if (text.includes('[MEDIUM]')) priority = 'medium';
        else if (text.includes('[LOW]')) priority = 'low';

        const cleanText = text.replace(/\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/g, '').trim();

        tasks.push({
          id: `task_${Date.now()}_${tasks.length}`,
          title: cleanText,
          description: currentSection,
          status: done ? 'done' : 'pending',
          priority,
          tags: [currentSection.toLowerCase().replace(/\s+/g, '-')],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: done ? Date.now() : 0,
          dependencies: [],
          notes: ''
        });
      }
    }

    return tasks;
  }

  async getNextTask(): Promise<ProjectTask | null> {
    await this.syncFromTODO();
    const pending = this.tasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      });
    return pending[0] || null;
  }

  async markTaskDone(taskTitle: string): Promise<boolean> {
    await this.syncFromTODO();
    const content = await fs.readFile(TODO_PATH, 'utf-8');
    const lines = content.split('\n');
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes(`[ ]`) && line.includes(taskTitle)) {
        lines[i] = line.replace('[ ]', '[x]');
        found = true;
        break;
      }
    }

    if (found) {
      await fs.writeFile(TODO_PATH, lines.join('\n'));
      await this.syncFromTODO();
    }
    return found;
  }

  async suggestNextStep(): Promise<string> {
    await this.syncFromTODO();
    const pending = this.tasks.filter(t => t.status !== 'done');
    const done = this.tasks.filter(t => t.status === 'done');
    const total = this.tasks.length;

    if (total === 0) {
      return 'No tasks found. Run project analysis first to generate a TODO.';
    }

    const nextTask = await this.getNextTask();
    const progress = Math.round((done.length / total) * 100);

    let suggestion = `📊 Progress: ${done.length}/${total} tasks (${progress}%)\n\n`;

    if (nextTask) {
      suggestion += `🎯 Next up: [${nextTask.priority.toUpperCase()}] ${nextTask.title}\n`;
      suggestion += `   Section: ${nextTask.description}\n`;
      if (nextTask.dependencies.length > 0) {
        suggestion += `   Depends on: ${nextTask.dependencies.join(', ')}\n`;
      }
    } else if (pending.length === 0) {
      suggestion += '🎉 All tasks completed! Consider analyzing the project for new improvements.';
    }

    return suggestion;
  }

  async getProjectStatus(): Promise<string> {
    await this.syncFromTODO();
    const total = this.tasks.length;
    const done = this.tasks.filter(t => t.status === 'done').length;
    const inProgress = this.tasks.filter(t => t.status === 'in_progress').length;
    const blocked = this.tasks.filter(t => t.status === 'blocked').length;
    const pending = this.tasks.filter(t => t.status === 'pending').length;

    const byPriority = {
      critical: this.tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length,
      high: this.tasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
      medium: this.tasks.filter(t => t.priority === 'medium' && t.status !== 'done').length,
      low: this.tasks.filter(t => t.priority === 'low' && t.status !== 'done').length
    };

    let report = `📋 PROJECT STATUS\n`;
    report += `${'─'.repeat(40)}\n`;
    report += `Total: ${total} | Done: ${done} | Active: ${inProgress} | Blocked: ${blocked} | Pending: ${pending}\n`;
    report += `Progress: ${total > 0 ? Math.round((done / total) * 100) : 0}%\n`;
    report += `\nRemaining by priority:\n`;
    report += `  🔴 Critical: ${byPriority.critical}\n`;
    report += `  🟠 High: ${byPriority.high}\n`;
    report += `  🟡 Medium: ${byPriority.medium}\n`;
    report += `  🟢 Low: ${byPriority.low}\n`;

    if (blocked > 0) {
      report += `\n⚠️ Blocked tasks:\n`;
      for (const t of this.tasks.filter(t => t.status === 'blocked')) {
        report += `  • ${t.title}\n`;
      }
    }

    return report;
  }

  getTasks(): ProjectTask[] {
    return this.tasks;
  }

  getContext(): ProjectContext {
    return this.context;
  }
}
