import React, { useState, useEffect, useRef } from 'react';
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

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const C = {
  fg: '#ededed', muted: '#666666', dim: '#444444',
  accent: '#0070f3', success: '#0cce6b', error: '#ee0000',
  warning: '#f5a623', border: '#333333', headerBg: '#111111',
  sidebarBg: '#0a0a0a', user: '#0070f3', ai: '#0cce6b', system: '#f5a623',
};

const TUI = () => {
  const { exit } = useApp();
  const [mode, setMode] = useState<'chat' | 'museum' | 'architect'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [dnaData, setDnaData] = useState<any>(null);
  const [status, setStatus] = useState('Initializing...');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [startTime] = useState(Date.now());
  const [rows, setRows] = useState(process.stdout.rows || 24);
  const [cols, setCols] = useState(process.stdout.columns || 80);

  const engines = useRef<{
    intent: IntentEngine; transformer: Transformer; memory: UniversalMemory;
    skills: SkillActivator; evolution: EvolutionLoop; llm: LLMEngine;
    web: WebPerception; omni: Omniscience; dna: DNA; oracle: Oracle;
    patch: PatchEngine; hive: HiveMind; voice: VoiceEntity; architect: Architect;
  } | null>(null);

  const processingLock = useRef(false);
  const bgRef = useRef<BackgroundEvolution | null>(null);
  const messagesEndRef = useRef<number>(0);

  const sidebarW = cols >= 100 ? 28 : 22;
  const msgAreaHeight = rows - 8;

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
      const bg = new BackgroundEvolution();
      bgRef.current = bg;
      bg.start();
      omni.onAlert((alert) => setAlerts(prev => [...prev.slice(-4), alert]));

      const shutdown = async () => {
        omni.stop();
        bgRef.current?.stop();
        try { await dna.save(); } catch {}
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      process.stdout.on('resize', () => {
        setRows(process.stdout.rows || 24);
        setCols(process.stdout.columns || 80);
      });
    };
    init();
  }, []);

  // Always scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current = messages.length;
  }, [messages.length]);

  useInput((_, key) => {
    if (key.tab) {
      setMode(prev => prev === 'chat' ? 'museum' : prev === 'museum' ? 'architect' : 'chat');
      if (mode === 'museum') loadSnapshots();
    }
  });

  const loadSnapshots = async () => {
    try {
      const entries = await fs.readdir('snapshots');
      const metas = [];
      for (const e of entries) {
        try { metas.push(JSON.parse(await fs.readFile(path.join('snapshots', e, 'meta.json'), 'utf-8'))); } catch {}
      }
      setSnapshots(metas.sort((a, b) => b.timestamp - a.timestamp));
    } catch {}
  };

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }]);
  };

  const handleCommand = async (cmd: string, args: string[]): Promise<boolean> => {
    if (!engines.current) return false;
    const { oracle, hive, voice, architect, dna } = engines.current;
    switch (cmd) {
      case 'quit': exit(); return true;
      case 'clear': setMessages([]); return true;
      case 'status': {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        addMessage('system', [
          `ULTIMATE v${dna.rawData.identity.version}`,
          `─────────────────────`,
          `Form: ${dna.rawData.identity.currentForm}`,
          `Mutations: ${dna.rawData.mutations}`,
          `Memory: ${dna.rawData.memory.interaction_count} interactions`,
          `Traits: ${dna.getTraitProfile()}`,
          `Dominant: ${dna.getDominantTrait()}`,
          ``,
          `Oracle: ${oracle.getScreenshotCount()} captures`,
          `Hive: ${(await hive.getStatus()).configured ? 'synced' : 'offline'}`,
          `Voice: STT:${voice.isAvailable().stt ? 'on' : 'off'} TTS:${voice.isAvailable().tts ? 'on' : 'off'}`,
          `Architect: ${architect.getTasks().length} tasks`,
          `Uptime: ${Math.floor(uptime / 60)}m ${uptime % 60}s`,
        ].join('\n'));
        return true;
      }
      case 'help': {
        addMessage('system', [
          `Commands:`,
          `/quit · /clear · /status · /help`,
          `/screenshot [terminal]`,
          `/hive push|pull|status`,
          `/architect analyze|todo|next|status`,
          `/voice listen|say <text>`,
          `/traits · /patch quick <file>`,
        ].join('\n'));
        return true;
      }
      case 'screenshot': {
        setStatus('Capturing...');
        const r = args[0] === 'terminal' ? await oracle.captureTerminal() : await oracle.captureScreen();
        addMessage('system', r.success ? `✓ ${r.filePath}` : `✗ ${r.error}`);
        return true;
      }
      case 'hive': {
        const a = args[0] || 'status';
        if (a === 'push') { setStatus('Syncing...'); addMessage('system', (await hive.push()).message); }
        else if (a === 'pull') { setStatus('Pulling...'); addMessage('system', (await hive.pull()).message); }
        else { const s = await hive.getStatus(); addMessage('system', `Hive: ${s.configured ? 'synced' : 'offline'} | Device: ${s.device}`); }
        return true;
      }
      case 'architect': {
        const a = args[0] || 'status';
        setStatus('Working...');
        if (a === 'analyze') { const c = await architect.analyzeProject(); addMessage('system', `${c.name} · ${c.currentPhase}`); }
        else if (a === 'todo') { addMessage('system', (await architect.generateTODO()).substring(0, 2000)); }
        else if (a === 'next') { addMessage('system', await architect.suggestNextStep()); }
        else { addMessage('system', await architect.getProjectStatus()); }
        return true;
      }
      case 'voice': {
        const a = args[0] || 'status';
        if (a === 'listen') {
          setStatus('Listening...');
          try { const r = await voice.transcribeFromMicrophone(5); addMessage('system', `"${r.text}" (${r.engine})`); setInput(r.text); }
          catch (e: any) { addMessage('system', `✗ ${e.message}`); }
        } else if (a === 'say' && args.length > 1) {
          const r = await voice.speak(args.slice(1).join(' '));
          addMessage('system', r.success ? '✓ Speaking' : '✗ TTS failed');
        } else {
          const av = voice.isAvailable();
          addMessage('system', `STT: ${av.stt ? 'on' : 'off'} | TTS: ${av.tts ? 'on' : 'off'}`);
        }
        return true;
      }
      case 'traits': {
        const d = engines.current.dna;
        addMessage('system', `Drift: ${d.getTraitProfile()}`);
        return true;
      }
      case 'patch': {
        if (args[0] === 'quick' && args.length >= 4) {
          const file = args[1] || '';
          const ok = await engines.current.patch.quickPatch(file, args[2] || '', args.slice(3).join(' '));
          addMessage('system', ok ? `✓ ${file}` : `✗ Anchor not found`);
        } else { addMessage('system', 'Usage: /patch quick <file> "old" "new"'); }
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

    setMessages(prev => [...prev, { role: 'user', content: value, timestamp: Date.now() }]);

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
        if (!handled) addMessage('system', `Unknown: /${pi.commandName}`);
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
        systemPrompt: sysPrompt,
        userPrompt: value,
        messages: [
          ...mem.flatMap(m => [{ role: 'user', content: m.value.input }, { role: 'assistant', content: m.value.output }]),
          { role: 'user', content: value }
        ] as any
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
      await memory.remember('interaction', { input: value, output: response });
      await dna.logInteraction();
      setDnaData({ ...dna.rawData });
      await evolution.analyze({ input: value, output: response, skills: dna.rawData.memory.active_skills });
      setDnaData({ ...dna.rawData });
      setStatus('Ready');
    } catch (err: any) {
      addMessage('system', `✗ ${err?.message || 'Unknown error'}`);
      setStatus('Error');
    } finally {
      setLoading(false);
      processingLock.current = false;
    }
  };

  if (!dnaData) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={C.accent} bold> ⚡ ULTIMATE </Text>
        <Text color={C.muted}> Loading...</Text>
      </Box>
    );
  }

  const modeLabel = mode === 'chat' ? 'CHAT' : mode === 'museum' ? 'HISTORY' : 'BUILD';
  const statusColor = status === 'Error' ? C.error : status === 'Ready' ? C.success : C.accent;

  // Show last N messages that fit in the visible area
  const visibleMessages = messages.slice(-Math.min(messages.length, msgAreaHeight));

  return (
    <Box flexDirection="column" height={rows} width={cols}>
      {/* ── Top bar ─────────────────────────────── */}
      <Box flexDirection="row" paddingX={1} backgroundColor={C.headerBg} height={1}>
        <Text bold color={C.fg}> ⚡ ULTIMATE </Text>
        <Text color={C.dim}>v{dnaData.identity.version} │ </Text>
        <Text color={C.accent}>{modeLabel}</Text>
        <Spacer />
        <Text color={statusColor}>● </Text>
        <Text color={C.muted}>{status}</Text>
      </Box>

      <Box flexDirection="row" flexGrow={1}>
        {/* ── Sidebar ───────────────────────────── */}
        <Box flexDirection="column" width={sidebarW} backgroundColor={C.sidebarBg} borderStyle="single" borderColor={C.border} paddingX={1}>
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={C.muted}>ENTITY</Text>
            <Text color={C.fg}> {dnaData.identity.currentForm} · v{dnaData.identity.version}</Text>
            <Text color={C.dim}> {dnaData.mutations} mut · {dnaData.memory.interaction_count} msgs</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={C.muted}>DRIFT</Text>
            {Object.entries(dnaData.traits || {}).map(([trait, val]: [string, any]) => {
              const filled = Math.round(val * 6);
              const bar = '█'.repeat(filled) + '░'.repeat(6 - filled);
              const color = val > 0.7 ? C.success : val < 0.3 ? C.error : C.warning;
              return <Text key={trait} color={color}>{trait.substring(0, 5).padEnd(5)} {bar} {(val as number).toFixed(1)}</Text>;
            })}
          </Box>
          {alerts.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold color={C.muted}>ALERTS</Text>
              {alerts.map((a, i) => <Text key={i} color={C.warning}> {a.substring(0, 22)}...</Text>)}
            </Box>
          )}
          <Spacer />
          <Text color={C.dim}> TAB · /help</Text>
        </Box>

        {/* ── Main content ──────────────────────── */}
        <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={C.border}>
          {mode === 'chat' && (
            <Box flexDirection="column" flexGrow={1}>
              <Box flexDirection="column" flexGrow={1} paddingX={1}>
                {messages.length === 0 && (
                  <Box flexDirection="column" marginTop={2}>
                    <Text color={C.dim}> Ready. Type a message or /help</Text>
                  </Box>
                )}
                {visibleMessages.map((msg, idx) => {
                  const roleColor = msg.role === 'user' ? C.user : msg.role === 'system' ? C.system : C.ai;
                  const roleIcon = msg.role === 'user' ? '>' : msg.role === 'system' ? '!' : '<';
                  const roleName = msg.role === 'user' ? 'You' : msg.role === 'system' ? 'Sys' : 'ULT';
                  return (
                    <Box key={msg.timestamp || idx} flexDirection="column">
                      <Text bold color={roleColor}> {roleIcon} {roleName}</Text>
                      <Text color={C.fg} wrap="wrap">{msg.content}</Text>
                    </Box>
                  );
                })}
              </Box>
              <Box borderStyle="single" borderColor={loading ? C.accent : C.border} paddingX={1} flexDirection="row" height={3}>
                <Text color={C.accent}> ❯ </Text>
                {loading ? <Spinner type="dots" /> : <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="Type a message..." />}
              </Box>
            </Box>
          )}

          {mode === 'museum' && (
            <Box flexDirection="column" flexGrow={1} paddingX={1}>
              <Text bold color={C.fg}> Evolution History</Text>
              <Text color={C.dim}>────────────────────────────</Text>
              {snapshots.length === 0 ? <Text color={C.muted}> No snapshots</Text> :
                snapshots.map((s, i) => <Box key={i}><Text color={C.dim}> [{new Date(s.timestamp).toLocaleDateString()}] </Text><Text color={C.accent}>{s.reason}</Text></Box>)}
            </Box>
          )}

          {mode === 'architect' && (
            <Box flexDirection="column" flexGrow={1} paddingX={1}>
              <Text bold color={C.fg}> Project Architect</Text>
              <Text color={C.dim}>────────────────────────────</Text>
              <Text color={C.muted}> /architect analyze · todo · next · status</Text>
              {messages.slice(-15).filter(m => m.role === 'system').map((msg, i) => (
                <Box key={i} flexDirection="column" marginTop={1}><Text color={C.fg}>{msg.content}</Text></Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

await loadEnv();
await setupWizard();
render(<TUI />);
