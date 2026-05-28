import React, { useState, useEffect, useRef, useCallback } from 'react';
import { render, Box, Text, useInput, useApp, Spacer } from 'ink';
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

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgDark: '\x1b[48;5;234m',
};

function print(msg: string) { process.stdout.write(msg + '\n'); }
function printLine(color: string, text: string) { process.stdout.write(`${color}${text}${C.reset}\n`); }

// ── Print header to terminal scrollback ────────────
function printHeader(dnaData: any, mode: string, status: string) {
  const statusColor = status === 'Error' ? C.red : status === 'Ready' ? C.green : C.blue;
  print(`${C.bold}${C.cyan} ⚡ ULTIMATE ${C.reset}${C.dim}v${dnaData.identity.version}${C.reset} ${C.gray}│${C.reset} ${C.blue}${mode.toUpperCase()}${C.reset} ${statusColor}●${C.reset} ${C.dim}${status}${C.reset}`);
  print(`${C.gray}────────────────────────────────────────────${C.reset}`);
}

function printMessage(role: string, content: string) {
  if (role === 'user') {
    print(`${C.bold}${C.blue} > You${C.reset}`);
  } else if (role === 'system') {
    print(`${C.bold}${C.yellow} ! System${C.reset}`);
  } else {
    print(`${C.bold}${C.green} < ULTIMATE${C.reset}`);
  }
  // Print content line by line with proper wrapping
  const lines = content.split('\n');
  for (const line of lines) {
    print(`  ${C.white}${line}${C.reset}`);
  }
  print('');
}

function printStatus(dnaData: any, startTime: number) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  print(`${C.bold}${C.white} ULTIMATE v${dnaData.identity.version}${C.reset}`);
  print(`${C.gray}─────────────────────${C.reset}`);
  print(`  Form:      ${C.white}${dnaData.identity.currentForm}${C.reset}`);
  print(`  Mutations: ${C.white}${dnaData.mutations}${C.reset}`);
  print(`  Memory:    ${C.white}${dnaData.memory.interaction_count} interactions${C.reset}`);
  print(`  Traits:    ${C.white}${dnaData.traits ? Object.entries(dnaData.traits).map(([k,v]: [string,any]) => `${k}:${(v as number).toFixed(1)}`).join(' ') : 'none'}${C.reset}`);
  print(`  Uptime:    ${C.white}${Math.floor(uptime / 60)}m ${uptime % 60}s${C.reset}`);
  print('');
}

function printHelp() {
  print(`${C.bold}${C.white} Commands${C.reset}`);
  print(`${C.gray}─────────────────────${C.reset}`);
  print(`  ${C.cyan}/quit${C.reset}              Exit`);
  print(`  ${C.cyan}/clear${C.reset}             Clear screen`);
  print(`  ${C.cyan}/status${C.reset}            System status`);
  print(`  ${C.cyan}/help${C.reset}              Show this`);
  print(`  ${C.cyan}/screenshot${C.reset}        Capture screen`);
  print(`  ${C.cyan}/hive push|pull${C.reset}    Sync DNA`);
  print(`  ${C.cyan}/architect${C.reset}         Project manage`);
  print(`  ${C.cyan}/voice listen|say${C.reset}  Voice I/O`);
  print(`  ${C.cyan}/traits${C.reset}            Drift profile`);
  print(`  ${C.cyan}/patch quick${C.reset}       Surgical edit`);
  print('');
}

// ── Ink TUI (input only) ──────────────────────────
const TUI = () => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dnaData, setDnaData] = useState<any>(null);
  const [status, setStatus] = useState('Initializing...');
  const [startTime] = useState(Date.now());

  const engines = useRef<{
    intent: IntentEngine; transformer: Transformer; memory: UniversalMemory;
    skills: SkillActivator; evolution: EvolutionLoop; llm: LLMEngine;
    web: WebPerception; omni: Omniscience; dna: DNA; oracle: Oracle;
    patch: PatchEngine; hive: HiveMind; voice: VoiceEntity; architect: Architect;
  } | null>(null);

  const processingLock = useRef(false);
  const bgRef = useRef<BackgroundEvolution | null>(null);
  const modeRef = useRef('chat');
  const alertCount = useRef(0);

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
      setStatus('Ready');

      // Print welcome using dna directly (setState is async)
      print('');
      printHeader(dna.rawData, modeRef.current, 'Ready');
      print(`${C.dim}  Type a message or /help for commands${C.reset}`);
      print('');

      const bg = new BackgroundEvolution();
      bgRef.current = bg;
      bg.start();

      omni.onAlert((alert) => {
        alertCount.current++;
        if (alertCount.current <= 3) {
          print(`${C.yellow} ⚠ ${alert}${C.reset}`);
        }
      });

      process.on('SIGINT', () => {
        omni.stop();
        bgRef.current?.stop();
        dna.save().catch(() => {});
        process.exit(0);
      });
    };
    init();
  }, []);

  useInput((_, key) => {
    if (key.tab) {
      modeRef.current = modeRef.current === 'chat' ? 'museum' : modeRef.current === 'museum' ? 'architect' : 'chat';
    }
  });

  const handleCommand = async (cmd: string, args: string[]): Promise<boolean> => {
    if (!engines.current) return false;
    const { oracle, hive, voice, architect, dna } = engines.current;
    switch (cmd) {
      case 'quit': exit(); return true;
      case 'clear': process.stdout.write('\x1b[2J\x1b[H'); return true;
      case 'status': printStatus(dna.rawData, startTime); return true;
      case 'help': printHelp(); return true;
      case 'screenshot': {
        setStatus('Capturing...');
        const r = args[0] === 'terminal' ? await oracle.captureTerminal() : await oracle.captureScreen();
        printMessage('system', r.success ? `✓ ${r.filePath}` : `✗ ${r.error}`);
        return true;
      }
      case 'hive': {
        const a = args[0] || 'status';
        if (a === 'push') { setStatus('Syncing...'); printMessage('system', (await hive.push()).message); }
        else if (a === 'pull') { setStatus('Pulling...'); printMessage('system', (await hive.pull()).message); }
        else { const s = await hive.getStatus(); printMessage('system', `Hive: ${s.configured ? 'synced' : 'offline'} | Device: ${s.device}`); }
        return true;
      }
      case 'architect': {
        const a = args[0] || 'status';
        setStatus('Working...');
        if (a === 'analyze') { const c = await architect.analyzeProject(); printMessage('system', `${c.name} · ${c.currentPhase}`); }
        else if (a === 'todo') { printMessage('system', (await architect.generateTODO()).substring(0, 2000)); }
        else if (a === 'next') { printMessage('system', await architect.suggestNextStep()); }
        else { printMessage('system', await architect.getProjectStatus()); }
        return true;
      }
      case 'voice': {
        const a = args[0] || 'status';
        if (a === 'listen') {
          setStatus('Listening...');
          try { const r = await voice.transcribeFromMicrophone(5); printMessage('system', `"${r.text}" (${r.engine})`); setInput(r.text); }
          catch (e: any) { printMessage('system', `✗ ${e.message}`); }
        } else if (a === 'say' && args.length > 1) {
          const r = await voice.speak(args.slice(1).join(' '));
          printMessage('system', r.success ? '✓ Speaking' : '✗ TTS failed');
        } else {
          const av = voice.isAvailable();
          printMessage('system', `STT: ${av.stt ? 'on' : 'off'} | TTS: ${av.tts ? 'on' : 'off'}`);
        }
        return true;
      }
      case 'traits': {
        const d = engines.current.dna;
        printMessage('system', `Drift: ${d.getTraitProfile()}`);
        return true;
      }
      case 'patch': {
        if (args[0] === 'quick' && args.length >= 4) {
          const file = args[1] || '';
          const ok = await engines.current.patch.quickPatch(file, args[2] || '', args.slice(3).join(' '));
          printMessage('system', ok ? `✓ ${file}` : `✗ Anchor not found`);
        } else { printMessage('system', 'Usage: /patch quick <file> "old" "new"'); }
        return true;
      }
      default: return false;
    }
  };

  const handleSubmit = async (value: string) => {
    if (!value || loading || !engines.current || processingLock.current) return;
    processingLock.current = true;
    setInput('');
    setLoading(true);
    setStatus('Thinking...');

    // Print user message immediately to scrollback
    printMessage('user', value);

    try {
      const { intent, memory, skills, evolution, llm, web, dna } = engines.current;
      if (value.startsWith('/')) {
        const parts = value.slice(1).split(' ');
        const handled = await handleCommand(parts[0] || '', parts.slice(1));
        if (handled) { setStatus('Ready'); setLoading(false); return; }
      }
      const pi = await intent.perceive(value);
      if (pi.isCommand) {
        const handled = await handleCommand(pi.commandName || '', pi.commandArgs || []);
        if (!handled) printMessage('system', `Unknown: /${pi.commandName}`);
        setStatus('Ready'); setLoading(false); return;
      }

      let ctx = "";
      if (value.toLowerCase().includes('search') || value.toLowerCase().includes('web')) {
        setStatus('Researching...'); ctx = `\n\nWEB:\n${await web.search(value)}`;
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

      // Print response to scrollback
      printMessage('assistant', response);

      await memory.remember('interaction', { input: value, output: response });
      await dna.logInteraction();
      setDnaData({ ...dna.rawData });
      await evolution.analyze({ input: value, output: response, skills: dna.rawData.memory.active_skills });
      setDnaData({ ...dna.rawData });
      setStatus('Ready');
    } catch (err: any) {
      printMessage('system', `✗ ${err?.message || 'Unknown error'}`);
      setStatus('Error');
    } finally {
      setLoading(false);
      processingLock.current = false;
    }
  };

  if (!dnaData) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold> ⚡ ULTIMATE Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="#333" paddingX={1}>
      <Box flexDirection="row">
        <Text color="#0070f3" bold> ❯ </Text>
        {loading ? <Spinner type="dots" /> : (
          <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="Type a message..." />
        )}
      </Box>
    </Box>
  );
};

await loadEnv();
await setupWizard();
render(<TUI />);
