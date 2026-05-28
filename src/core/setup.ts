import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT, '.env');
const SETUP_DONE = path.join(ROOT, '.setup_done');

export async function loadEnv(): Promise<void> {
  try {
    const content = await fs.readFile(ENV_FILE, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {}
}

async function saveEnv(key: string, value: string): Promise<void> {
  let content = '';
  try { content = await fs.readFile(ENV_FILE, 'utf-8'); } catch {}

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trim() + `\n${key}=${value}\n`;
  }
  await fs.writeFile(ENV_FILE, content.trim() + '\n');
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function setupWizard(): Promise<void> {
  // Check if setup was already done
  try {
    await fs.access(SETUP_DONE);
    return; // Setup already completed
  } catch {}

  // Check if API key is already set
  if (process.env.OPENROUTER_API_KEY) {
    await fs.writeFile(SETUP_DONE, Date.now().toString());
    return;
  }

  console.clear();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║        ⚡ ULTIMATE — First Time Setup ⚡         ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('  ULTIMATE needs an OpenRouter API key to connect');
  console.log('  to its AI brain. The key is free.');
  console.log('');
  console.log('  Get yours at: https://openrouter.ai/keys');
  console.log('');

  const choice = await askQuestion('  Press ENTER when you have your key, or type "skip" to continue without: ');

  if (choice.toLowerCase() === 'skip') {
    console.log('');
    console.log('  ⚠ Skipping. You can set it later with:');
    console.log('    export OPENROUTER_API_KEY=your_key');
    console.log('');
    await fs.writeFile(SETUP_DONE, Date.now().toString());
    return;
  }

  console.log('');
  const apiKey = await askQuestion('  Paste your OpenRouter API key: ');

  if (!apiKey) {
    console.log('');
    console.log('  ⚠ No key entered. You can set it later with:');
    console.log('    export OPENROUTER_API_KEY=your_key');
    console.log('');
    await fs.writeFile(SETUP_DONE, Date.now().toString());
    return;
  }

  // Save to .env
  process.env.OPENROUTER_API_KEY = apiKey;
  await saveEnv('OPENROUTER_API_KEY', apiKey);

  // Also add to shell profile for persistence
  const shellProfile = detectShellProfile();
  if (shellProfile) {
    try {
      const existing = await fs.readFile(shellProfile, 'utf-8');
      if (!existing.includes('OPENROUTER_API_KEY')) {
        await fs.appendFile(shellProfile, `\n# ULTIMATE API Key\nexport OPENROUTER_API_KEY="${apiKey}"\n`);
      }
    } catch {}
  }

  console.log('');
  console.log('  ✅ API key saved to .env and shell profile.');
  console.log('');
  await fs.writeFile(SETUP_DONE, Date.now().toString());
}

function detectShellProfile(): string | null {
  const home = process.env.HOME || '';
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return path.join(home, '.zshrc');
  if (shell.includes('bash')) return path.join(home, '.bashrc');
  return path.join(home, '.profile');
}
