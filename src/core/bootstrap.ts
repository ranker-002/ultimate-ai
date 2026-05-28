import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

export async function bootstrap() {
  const dnaPath = path.join(__dirname, 'dna.json');
  const memoryDir = path.join(ROOT, 'memory');
  const skillsDir = path.join(ROOT, 'skills');
  const snapshotsDir = path.join(ROOT, 'snapshots');
  const formsDir = path.join(ROOT, 'forms', 'history');

  // Create necessary directories
  for (const dir of [memoryDir, skillsDir, snapshotsDir, formsDir]) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Check if first launch
  const isFirstLaunch = !(await fileExists(dnaPath));

  if (isFirstLaunch) {
    console.log('⚡ First Launch — Initializing DNA...');
    await createInitialDNA(dnaPath);
    await createSkillsRegistry(skillsDir);
    console.log('✓ ULTIMATE initialized. DNA created.');
  }

  return { isFirstLaunch, dnaPath };
}

async function createInitialDNA(dnaPath: string) {
  const initialDNA = {
    identity: {
      name: 'ULTIMATE',
      version: '1.0.0',
      birth: Date.now(),
      currentForm: 'terminal-cli'
    },
    traits: {
      logic: 0.5,
      creativity: 0.5,
      caution: 0.5,
      empathy: 0.5,
      ambition: 0.5,
      precision: 0.5
    },
    traitHistory: [],
    mutations: 0,
    evolution_log: [],
    memory: {
      user_preferences: {},
      learned_patterns: [],
      active_skills: [],
      transformation_history: [],
      interaction_count: 0
    },
    capabilities: {
      self_modify: true,
      learn_in_realtime: true,
      skill_acquisition: 'unlimited',
      form_limit: 'none'
    }
  };
  await fs.writeFile(dnaPath, JSON.stringify(initialDNA, null, 2));
}

async function createSkillsRegistry(skillsDir: string) {
  const registry = {
    skills: [
      { name: 'software_development', status: 'dormant', domains: ['js', 'ts', 'python', 'rust', 'go', 'all'] },
      { name: 'music_composition', status: 'dormant', domains: ['midi', 'audio', 'theory'] },
      { name: 'graphic_design', status: 'dormant', domains: ['svg', 'ui', 'branding'] },
      { name: 'data_science', status: 'dormant', domains: ['ml', 'stats', 'visualization'] },
      { name: 'cybersecurity', status: 'dormant', domains: ['pentest', 'analysis', 'hardening'] },
      { name: 'meta_skill_creation', status: 'always_active', domains: ['synthesis', 'learning'] }
    ]
  };
  const registryPath = path.join(skillsDir, 'registry.json');
  if (!(await fileExists(registryPath))) {
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
