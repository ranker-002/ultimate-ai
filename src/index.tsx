import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp, Static, Spacer } from 'ink';
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

  const engines = useRef<{
    intent: IntentEngine;
    transformer: Transformer;
    memory: UniversalMemory;
    skills: SkillActivator;
    evolution: EvolutionLoop;
    llm: LLMEngine;
    web: WebPerception;
    omni: Omniscience;
    dna: DNA;
    oracle: Oracle;
    patch: PatchEngine;
    hive: HiveMind;
    voice: VoiceEntity;
    architect: Architect;
  } | null>(null);

  const processingLock = useRef(false);
  const bgRef = useRef<BackgroundEvolution | null>(null);

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
        intent: new IntentEngine(),
        transformer: new Transformer(),
        memory,
        skills: new SkillActivator(),
        evolution: new EvolutionLoop(),
        llm: LLMEngine.getInstance(),
        web: new WebPerception(),
        omni,
        dna,
        oracle,
        patch: new PatchEngine(),
        hive,
        voice,
        architect
      };

      setDnaData(dna.rawData);
      setStatus('Ready');

      const bg = new BackgroundEvolution();
      bgRef.current = bg;
      bg.start();

      // Event-driven alerts (no polling)
      omni.onAlert((alert) => {
        setAlerts(prev => [...prev.slice(-4), alert]);
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log('\n⚡ ULTIMATE entering standby...');
        omni.stop();
        bgRef.current?.stop();
        try { await dna.save(); } catch {}
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    };

    init();
  }, []);

  useInput((input, key) => {
    if (key.tab) {
      setMode(prev => {
        if (prev === 'chat') return 'museum';
        if (prev === 'museum') return 'architect';
        return 'chat';
      });
      if (mode === 'museum') loadSnapshots();
    }
  });

  const loadSnapshots = async () => {
    try {
      const entries = await fs.readdir('snapshots');
      const metas = [];
      for (const e of entries) {
        try {
          const meta = JSON.parse(await fs.readFile(path.join('snapshots', e, 'meta.json'), 'utf-8'));
          metas.push(meta);
        } catch {}
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
      case 'quit':
        exit();
        return true;

      case 'clear':
        setMessages([]);
        return true;

      case 'status': {
        const status = [
          `⚡ ULTIMATE v${dna.rawData.identity.version}`,
          `Form: ${dna.rawData.identity.currentForm}`,
          `Mutations: ${dna.rawData.mutations}`,
          `Interactions: ${dna.rawData.memory.interaction_count}`,
          `Traits: ${dna.getTraitProfile()}`,
          `Dominant Trait: ${dna.getDominantTrait()}`,
          '',
          `👁️ Oracle: ${oracle.getScreenshotCount()} captures`,
          `🔒 Hive: ${(await hive.getStatus()).configured ? 'synced' : 'not configured'}`,
          `🎤 Voice: STT=${voice.isAvailable().stt}, TTS=${voice.isAvailable().tts}`,
          `📋 Architect: ${architect.getTasks().length} tasks`
        ].join('\n');
        addMessage('system', status);
        return true;
      }

      case 'help': {
        const help = [
          'Commands:',
          '  /quit              - Exit ULTIMATE',
          '  /clear             - Clear chat',
          '  /status            - Full entity status',
          '  /screenshot        - Capture screen',
          '  /screenshot terminal - Capture terminal',
          '  /hive push         - Sync DNA+Memory to GitHub Gist',
          '  /hive pull         - Pull sync from Gist',
          '  /hive status       - Sync status',
          '  /architect analyze - Analyze project',
          '  /architect todo    - Generate TODO.md',
          '  /architect next    - Suggest next task',
          '  /architect status  - Project status',
          '  /voice listen      - Voice input (STT)',
          '  /voice say <text>  - Speak text (TTS)',
          '  /traits            - Show Neural Drift profile',
          '  /patch quick <file> - Quick surgical edit'
        ].join('\n');
        addMessage('system', help);
        return true;
      }

      case 'screenshot': {
        const mode = args[0] || 'screen';
        setStatus('Capturing...');
        const result = mode === 'terminal'
          ? await oracle.captureTerminal()
          : await oracle.captureScreen();
        if (result.success) {
          addMessage('system', `📸 Screenshot saved: ${result.filePath}`);
        } else {
          addMessage('system', `❌ Screenshot failed: ${result.error}`);
        }
        return true;
      }

      case 'hive': {
        const action = args[0] || 'status';
        if (action === 'push') {
          setStatus('Syncing to cloud...');
          const result = await hive.push();
          addMessage('system', result.message);
        } else if (action === 'pull') {
          setStatus('Pulling from cloud...');
          const result = await hive.pull();
          addMessage('system', result.message);
        } else {
          const status = await hive.getStatus();
          addMessage('system', [
            `🔒 Hive Mind Status`,
            `Configured: ${status.configured}`,
            `Device: ${status.device}`,
            status.gistId ? `Gist: ${status.gistId}` : '',
            status.lastSync ? `Last sync: ${status.lastSync}` : ''
          ].filter(Boolean).join('\n'));
        }
        return true;
      }

      case 'architect': {
        const action = args[0] || 'status';
        setStatus('Architect working...');
        if (action === 'analyze') {
          const ctx = await architect.analyzeProject();
          addMessage('system', `📋 Project: ${ctx.name}\nPhase: ${ctx.currentPhase}\nStack: ${ctx.techStack.join(', ')}`);
        } else if (action === 'todo') {
          const todo = await architect.generateTODO();
          addMessage('system', `✅ TODO.md generated:\n${todo.substring(0, 1000)}`);
        } else if (action === 'next') {
          const suggestion = await architect.suggestNextStep();
          addMessage('system', suggestion);
        } else {
          const report = await architect.getProjectStatus();
          addMessage('system', report);
        }
        return true;
      }

      case 'voice': {
        const action = args[0] || 'status';
        if (action === 'listen') {
          setStatus('Listening...');
          try {
            const result = await voice.transcribeFromMicrophone(5);
            addMessage('system', `🎤 Heard: "${result.text}" (${result.engine}, ${result.duration.toFixed(1)}s)`);
            // Process the transcribed text as a regular message
            setInput(result.text);
          } catch (err: any) {
            addMessage('system', `❌ Voice input failed: ${err.message}`);
          }
        } else if (action === 'say') {
          const text = args.slice(1).join(' ');
          if (text) {
            setStatus('Speaking...');
            const result = await voice.speak(text);
            addMessage('system', result.success ? `🔊 Speaking...` : `❌ TTS failed`);
          }
        } else {
          const avail = voice.isAvailable();
          addMessage('system', `🎤 Voice Status\nSTT: ${avail.stt ? 'available' : 'not installed'}\nTTS: ${avail.tts ? 'available' : 'not installed'}`);
        }
        return true;
      }

      case 'traits': {
        const dna = engines.current.dna;
        const profile = dna.getTraitProfile();
        const history = dna.getTraitHistory().slice(-10);
        const recent = history.map(h => `  ${h.trait}: ${h.delta > 0 ? '+' : ''}${h.delta.toFixed(2)} (${h.reason})`).join('\n');
        addMessage('system', `🧠 Neural Drift Profile\n${profile}\n\nRecent shifts:\n${recent || '  No shifts yet'}`);
        return true;
      }

      case 'patch': {
        const sub = args[0] || 'help';
        if (sub === 'quick' && args.length >= 3) {
          const file = args[1] || '';
          const oldText = args[2] || '';
          const newText = args.slice(3).join(' ');
          const ok = await engines.current.patch.quickPatch(file, oldText, newText);
          addMessage('system', ok ? `✅ Patched ${file}` : `❌ Could not find anchor in ${file}`);
        } else {
          addMessage('system', 'Usage: /patch quick <file> "<old text>" "<new text>"');
        }
        return true;
      }

      default:
        return false;
    }
  };

  const handleSubmit = async (value: string) => {
    if (!value || loading || !engines.current || processingLock.current) return;
    processingLock.current = true;
    setInput('');
    setLoading(true);
    setStatus('Thinking...');

    const userMsg: Message = { role: 'user', content: value, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { intent, transformer, memory, skills, evolution, llm, web, dna } = engines.current;

      // Check for commands
      if (value.startsWith('/')) {
        const parts = value.slice(1).split(' ');
        const cmd = parts[0] || '';
        const args = parts.slice(1);
        const handled = await handleCommand(cmd, args);
        if (handled) {
          setStatus('Ready');
          setLoading(false);
          return;
        }
      }

      const perceivedIntent = await intent.perceive(value);

      if (perceivedIntent.isCommand) {
        const handled = await handleCommand(perceivedIntent.commandName || '', perceivedIntent.commandArgs || []);
        if (!handled) addMessage('system', `Unknown command: /${perceivedIntent.commandName}`);
        setStatus('Ready');
        setLoading(false);
        return;
      }

      // Check if research needed
      let contextAddition = "";
      if (value.toLowerCase().includes('search') || value.toLowerCase().includes('web')) {
        setStatus('Researching...');
        const searchResults = await web.search(value);
        contextAddition = `\n\nWEB SEARCH RESULTS:\n${searchResults}`;
      }

      // Check if screenshot is requested
      let screenshotContext = "";
      if (value.toLowerCase().includes('screenshot') || value.toLowerCase().includes('look at') || value.toLowerCase().includes('see the')) {
        setStatus('Capturing vision...');
        const capResult = await engines.current.oracle.captureScreen();
        if (capResult.success) {
          screenshotContext = `\n\n[SCREENSHOT CAPTURED: ${capResult.filePath}]\nThe user is asking you to look at something. A screenshot has been saved.`;
        }
      }

      const relevantMemory = await memory.recall(value, 5);
      const systemPrompt = llm.buildDefaultSystemPrompt() +
        (skills.getActiveContext() ? `\n\nACTIVE SKILLS:\n${skills.getActiveContext()}` : '') +
        contextAddition +
        screenshotContext;

      const response = await llm.generate({
        systemPrompt,
        userPrompt: value,
        messages: [
          ...relevantMemory.flatMap(m => [{ role: 'user', content: m.value.input }, { role: 'assistant', content: m.value.output }]),
          { role: 'user', content: value }
        ] as any
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
      await memory.remember('interaction', { input: value, output: response });
      await dna.logInteraction();
      setDnaData({ ...dna.rawData });

      // Trigger micro-evolution
      await evolution.analyze({
        input: value,
        output: response,
        skills: dna.rawData.memory.active_skills
      });

      // Refresh DNA data after potential trait shifts
      setDnaData({ ...dna.rawData });
      setStatus('Ready');
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'system', content: err.message, timestamp: Date.now() }]);
      setStatus('Error');
    } finally {
      setLoading(false);
      processingLock.current = false;
    }
  };

  if (!dnaData) return <Text color="cyan">⚡ Booting ULTIMATE v4...</Text>;

  return (
    <Box flexDirection="column" height={process.stdout.rows - 2} padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold color="cyan"> ⚡ ULTIMATE v{dnaData.identity.version} [{mode.toUpperCase()}] </Text>
        <Spacer />
        <Text color="gray"> {status} </Text>
      </Box>

      <Box flexGrow={1}>
        {/* Sidebar */}
        <Box flexDirection="column" width={38} borderStyle="round" borderColor="blue" paddingX={1} marginRight={1}>
          <Text bold color="blue">ENTITY STATE</Text>
          <Text dimColor>Form: {dnaData.identity.currentForm}</Text>
          <Text dimColor>Mutations: {dnaData.mutations}</Text>

          {/* Neural Drift Traits */}
          <Box flexDirection="column" marginTop={1} height={9}>
            <Text bold color="magenta">NEURAL DRIFT</Text>
            {Object.entries(dnaData.traits || {}).map(([trait, val]: [string, any]) => {
              const bar = '█'.repeat(Math.round(val * 10));
              const empty = '░'.repeat(10 - Math.round(val * 10));
              return (
                <Text key={trait} color={val > 0.7 ? 'green' : val < 0.3 ? 'red' : 'yellow'}>
                  {trait.substring(0, 6).padEnd(6)} {bar}{empty} {(val as number).toFixed(2)}
                </Text>
              );
            })}
          </Box>

          <Box flexDirection="column" marginTop={1} height={5}>
            <Text bold color="yellow">PROACTIVE ALERTS</Text>
            {alerts.map((a, i) => <Text key={i} color="gray">• {a.substring(0, 32)}...</Text>)}
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text bold color="cyan">SKILLS</Text>
            {dnaData.memory.active_skills.slice(-5).map((s: string) => <Text key={s} color="gray">› {s}</Text>)}
          </Box>
          <Spacer />
          <Text dimColor>Press [TAB] to cycle mode</Text>
        </Box>

        {/* Main View */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
          {mode === 'chat' && (
            <Box flexDirection="column" flexGrow={1}>
              <Box flexGrow={1} flexDirection="column">
                <Static items={messages.slice(-10)}>
                  {(msg: Message) => (
                    <Box key={msg.timestamp} flexDirection="column" marginBottom={1}>
                      <Text bold color={msg.role === 'user' ? 'magenta' : msg.role === 'system' ? 'yellow' : 'cyan'}>
                        {msg.role === 'system' ? '⚙ SYSTEM →' : msg.role === 'user' ? 'YOU →' : 'ULTIMATE →'}
                      </Text>
                      <Text>{msg.content}</Text>
                    </Box>
                  )}
                </Static>
              </Box>
              <Box borderStyle="single" borderColor="blue" paddingX={1}>
                <Text color="magenta">PROMPT → </Text>
                {loading ? <Spinner type="dots" /> : <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />}
              </Box>
            </Box>
          )}

          {mode === 'museum' && (
            <Box flexDirection="column">
              <Text bold underline color="yellow">THE MUSEUM (Evolutionary History)</Text>
              {snapshots.map((s, i) => (
                <Box key={i} marginBottom={1}>
                  <Text color="gray">[{new Date(s.timestamp).toLocaleString()}] </Text>
                  <Text color="cyan">{s.reason}</Text>
                </Box>
              ))}
            </Box>
          )}

          {mode === 'architect' && (
            <Box flexDirection="column">
              <Text bold underline color="green">THE ARCHITECT (Project Management)</Text>
              <Text dimColor>Type commands: /architect analyze, /architect todo, /architect next, /architect status</Text>
              {messages.slice(-15).filter(m => m.role === 'system').map((msg, i) => (
                <Box key={i} flexDirection="column" marginTop={1}>
                  <Text color="yellow">{msg.content}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Run setup wizard BEFORE Ink takes over stdin
await loadEnv();
await setupWizard();

render(<TUI />);
