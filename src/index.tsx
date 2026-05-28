import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { bootstrap } from './core/bootstrap.js';
import { loadEnv, setupWizard } from './core/setup.js';
import { DNA } from './core/dna.js';
import { IntentEngine } from './core/intent_engine.js';
import { Transformer } from './core/transformer.js';
import { UniversalMemory } from './memory/store.js';
import { SkillActivator } from './core/skill_activator.js';
import { EvolutionLoop } from './core/evolution_loop.js';
import { LLMEngine } from './core/llm_engine.js';
import { BackgroundEvolution } from './core/autonomous_agent.js';
import { WebPerception } from './core/web_perception.js';
import { Omniscience } from './core/omniscience.js';
import { Oracle } from './core/oracle.js';
import { PatchEngine } from './core/patch_engine.js';
import { HiveMind } from './core/hive_mind.js';
import { VoiceEntity } from './core/voice_entity.js';
import { Architect } from './core/architect.js';
import fs from 'fs/promises';
import path from 'path';

// ANSI helpers
const A = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  cyan: '\x1b[36m', blue: '\x1b[34m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', magenta: '\x1b[35m', gray: '\x1b[90m', white: '\x1b[37m',
  brightWhite: '\x1b[97m', black: '\x1b[30m', bgBlue: '\x1b[44m',
};

const p = (s: string) => process.stdout.write(s + '\n');
const prompt = () => `${A.bold}${A.cyan}❯${A.reset} `;

// ── Print a message to terminal scrollback ────────
function printMsg(role: string, content: string) {
  if (role === 'user') {
    p(`${A.bold}${A.blue}you${A.reset}`);
  } else if (role === 'system') {
    p(`${A.yellow}system${A.reset}`);
  } else {
    p(`${A.bold}${A.green}ult${A.reset}`);
  }
  // Print content preserving code blocks
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('```')) {
      p(`${A.dim}${line}${A.reset}`);
    } else if (line.startsWith('#')) {
      p(`${A.bold}${A.white}${line}${A.reset}`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      p(`  ${A.dim}•${A.reset} ${line.substring(2)}`);
    } else if (line.match(/^\|/)) {
      p(`${A.dim}${line}${A.reset}`);
    } else {
      p(`  ${line}`);
    }
  }
  p('');
}

function printWelcome(version: string) {
  p(`${A.bold}${A.cyan}⚡ ULTIMATE${A.reset} ${A.dim}v${version}${A.reset}`);
  p(`${A.dim}Type /help for commands${A.reset}`);
  p('');
}

function printHelp() {
  p(`${A.bold}Commands${A.reset}`);
  p(`${A.dim}─────────${A.reset}`);
  p(`  ${A.cyan}/help${A.reset}         Show commands`);
  p(`  ${A.cyan}/status${A.reset}       System info`);
  p(`  ${A.cyan}/clear${A.reset}       Clear screen`);
  p(`  ${A.cyan}/quit${A.reset}        Exit`);
  p(`  ${A.cyan}/traits${A.reset}      Drift profile`);
  p(`  ${A.cyan}/screenshot${A.reset}  Capture screen`);
  p(`  ${A.cyan}/hive${A.reset}        Sync: push|pull|status`);
  p(`  ${A.cyan}/architect${A.reset}   Build: analyze|todo|next`);
  p(`  ${A.cyan}/voice${A.reset}       Audio: listen|say`);
  p(`  ${A.cyan}/patch${A.reset}       Edit: quick <file>`);
  p('');
}

function printStatus(dna: any, startTime: number) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  p(`${A.bold}ULTIMATE v${dna.identity.version}${A.reset} ${A.dim}·${A.reset} ${dna.identity.currentForm}`);
  p(`${A.dim}──────────────${A.reset}`);
  p(`  mutations   ${dna.mutations}`);
  p(`  memory      ${dna.memory.interaction_count} interactions`);
  p(`  drift       ${dna.traits ? Object.entries(dna.traits).map(([k,v]: [string,any]) => `${k}:${(v as number).toFixed(1)}`).join(' ') : 'none'}`);
  p(`  uptime      ${Math.floor(uptime/60)}m ${uptime%60}s`);
  p('');
}

// ── Ink TUI (input only) ──────────────────────────
const TUI = () => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [dnaData, setDnaData] = useState<any>(null);

  const engines = useRef<{
    intent: IntentEngine; transformer: Transformer; memory: UniversalMemory;
    skills: SkillActivator; evolution: EvolutionLoop; llm: LLMEngine;
    web: WebPerception; omni: Omniscience; dna: DNA; oracle: Oracle;
    patch: PatchEngine; hive: HiveMind; voice: VoiceEntity; architect: Architect;
  } | null>(null);

  const processingLock = useRef(false);
  const bgRef = useRef<BackgroundEvolution | null>(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const init = async () => {
      await bootstrap();
      const dna = await DNA.load();
      const memory = new UniversalMemory();
      await memory.restore();
      const omni = new Omniscience();
      omni.start();
      const oracle = new Oracle();
      await oracle.init();
      const hive = new HiveMind();
      await hive.init();
      const voice = new VoiceEntity();
      await voice.init();
      const architect = new Architect();
      await architect.init();

      engines.current = {
        intent: new IntentEngine(), transformer: new Transformer(), memory,
        skills: new SkillActivator(), evolution: new EvolutionLoop(),
        llm: LLMEngine.getInstance(), web: new WebPerception(), omni, dna,
        oracle, patch: new PatchEngine(), hive, voice, architect
      };

      setDnaData(dna.rawData);

      // Clear and print welcome
      process.stdout.write('\x1b[2J\x1b[H');
      printWelcome(dna.rawData.identity.version);

      const bg = new BackgroundEvolution();
      bgRef.current = bg;
      bg.start();
      omni.onAlert(() => {});

      process.on('SIGINT', () => {
        omni.stop();
        bgRef.current?.stop();
        dna.save().catch(() => {});
        process.exit(0);
      });

      setReady(true);
    };
    init();
  }, []);

  useInput((_, key) => {
    if (key.tab) {}
  });

  const handleCommand = async (cmd: string, args: string[]): Promise<boolean> => {
    if (!engines.current) return false;
    const { oracle, hive, voice, architect, dna } = engines.current;
    switch (cmd) {
      case 'quit': exit(); return true;
      case 'clear': process.stdout.write('\x1b[2J\x1b[H'); printWelcome(dna.rawData.identity.version); return true;
      case 'status': printStatus(dna.rawData, startTimeRef.current); return true;
      case 'help': printHelp(); return true;
      case 'screenshot': {
        const r = args[0] === 'terminal' ? await oracle.captureTerminal() : await oracle.captureScreen();
        printMsg('system', r.success ? `captured: ${r.filePath}` : `failed: ${r.error}`);
        return true;
      }
      case 'hive': {
        const a = args[0] || 'status';
        if (a === 'push') { printMsg('system', (await hive.push()).message); }
        else if (a === 'pull') { printMsg('system', (await hive.pull()).message); }
        else { const s = await hive.getStatus(); printMsg('system', `hive: ${s.configured ? 'synced' : 'offline'} · device: ${s.device}`); }
        return true;
      }
      case 'architect': {
        const a = args[0] || 'status';
        if (a === 'analyze') { const c = await architect.analyzeProject(); printMsg('system', `${c.name} · ${c.currentPhase} · ${c.techStack.join(', ')}`); }
        else if (a === 'todo') { printMsg('system', (await architect.generateTODO()).substring(0, 2000)); }
        else if (a === 'next') { printMsg('system', await architect.suggestNextStep()); }
        else { printMsg('system', await architect.getProjectStatus()); }
        return true;
      }
      case 'voice': {
        const a = args[0] || 'status';
        if (a === 'listen') {
          try { const r = await voice.transcribeFromMicrophone(5); printMsg('system', `"${r.text}" (${r.engine})`); setInput(r.text); }
          catch (e: any) { printMsg('system', e.message); }
        } else if (a === 'say' && args.length > 1) {
          const r = await voice.speak(args.slice(1).join(' '));
          printMsg('system', r.success ? 'speaking' : 'tts failed');
        } else {
          const av = voice.isAvailable();
          printMsg('system', `stt: ${av.stt ? 'on' : 'off'} tts: ${av.tts ? 'on' : 'off'}`);
        }
        return true;
      }
      case 'traits': {
        printMsg('system', engines.current.dna.getTraitProfile());
        return true;
      }
      case 'patch': {
        if (args[0] === 'quick' && args.length >= 4) {
          const f = args[1] || '';
          const ok = await engines.current.patch.quickPatch(f, args[2] || '', args.slice(3).join(' '));
          printMsg('system', ok ? `patched: ${f}` : 'anchor not found');
        } else { printMsg('system', 'usage: /patch quick <file> "old" "new"'); }
        return true;
      }
      default: return false;
    }
  };

  const handleSubmit = async (value: string) => {
    if (!value || loading || !engines.current || processingLock.current) return;
    processingLock.current = true;
    setInput('');

    // Print user message
    printMsg('user', value);

    // Check for commands
    if (value.startsWith('/')) {
      const parts = value.slice(1).split(' ');
      const handled = await handleCommand(parts[0] || '', parts.slice(1));
      if (handled) { processingLock.current = false; return; }
    }

    setLoading(true);
    try {
      const { intent, memory, skills, evolution, llm, web, dna } = engines.current;

      const pi = await intent.perceive(value);
      if (pi.isCommand) {
        const handled = await handleCommand(pi.commandName || '', pi.commandArgs || []);
        if (!handled) printMsg('system', `unknown: /${pi.commandName}`);
        processingLock.current = false;
        setLoading(false);
        return;
      }

      let ctx = "";
      if (value.toLowerCase().includes('search') || value.toLowerCase().includes('web')) {
        ctx = `\n\nWEB:\n${await web.search(value)}`;
      }

      const mem = await memory.recall(value, 5);
      const sysPrompt = llm.buildDefaultSystemPrompt() +
        (skills.getActiveContext() ? `\n\nSKILLS:\n${skills.getActiveContext()}` : '') + ctx;

      const response = await llm.generate({
        systemPrompt: sysPrompt, userPrompt: value,
        messages: [
          ...mem.flatMap(m => [{ role: 'user', content: m.value.input }, { role: 'assistant', content: m.value.output }]),
          { role: 'user', content: value }
        ] as any
      });

      printMsg('assistant', response);
      await memory.remember('interaction', { input: value, output: response });
      await dna.logInteraction();
      setDnaData({ ...dna.rawData });
      await evolution.analyze({ input: value, output: response, skills: dna.rawData.memory.active_skills });
      setDnaData({ ...dna.rawData });
    } catch (err: any) {
      printMsg('system', `error: ${err?.message || 'unknown'}`);
    } finally {
      setLoading(false);
      processingLock.current = false;
    }
  };

  if (!ready) {
    return (
      <Box padding={0}>
        <Text dimColor> Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" paddingX={0}>
      {loading ? (
        <Text color="cyan">❯ </Text>
      ) : (
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="Message..." />
      )}
      {loading && <Spinner type="dots" />}
    </Box>
  );
};

await loadEnv();
await setupWizard();
render(<TUI />);
