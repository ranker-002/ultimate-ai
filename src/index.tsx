import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp, Static, Spacer } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { bootstrap } from './core/bootstrap.js';
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
import fs from 'fs/promises';
import path from 'path';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const TUI = () => {
  const { exit } = useApp();
  const [mode, setMode] = useState<'chat' | 'museum'>('chat');
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
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      await bootstrap();
      const dna = await DNA.load();
      const memory = new UniversalMemory();
      await memory.restore();
      
      const omni = new Omniscience();
      omni.start();

      engines.current = {
        intent: new IntentEngine(),
        transformer: new Transformer(),
        memory,
        skills: new SkillActivator(),
        evolution: new EvolutionLoop(),
        llm: new LLMEngine(),
        web: new WebPerception(),
        omni,
        dna
      };

      setDnaData(dna.rawData);
      setStatus('Ready');

      const bg = new BackgroundEvolution();
      bg.start();

      // Poll for alerts
      setInterval(() => {
        setAlerts(engines.current?.omni.getRecentAlerts() || []);
      }, 2000);
    };

    init();
  }, []);

  useInput((input, key) => {
    if (key.tab) {
      setMode(prev => prev === 'chat' ? 'museum' : 'chat');
      if (mode === 'chat') loadSnapshots();
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
      setSnapshots(metas.sort((a,b) => b.timestamp - a.timestamp));
    } catch {}
  };

  const handleSubmit = async (value: string) => {
    if (!value || loading || !engines.current) return;
    setInput('');
    setLoading(true);
    setStatus('Thinking...');

    const userMsg: Message = { role: 'user', content: value, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { intent, transformer, memory, skills, evolution, llm, web, dna } = engines.current;
      const perceivedIntent = await intent.perceive(value);

      if (perceivedIntent.isCommand) {
        if (perceivedIntent.commandName === 'quit') exit();
        if (perceivedIntent.commandName === 'clear') setMessages([]);
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

      const relevantMemory = await memory.recall(value, 5);
      const systemPrompt = llm.buildDefaultSystemPrompt() + 
        (skills.getActiveContext() ? `\n\nACTIVE SKILLS:\n${skills.getActiveContext()}` : '') +
        contextAddition;

      const response = await llm.generate({
        systemPrompt,
        userPrompt: value,
        messages: [
          ...relevantMemory.flatMap(m => [{role: 'user', content: m.value.input}, {role:'assistant', content: m.value.output}]),
          { role: 'user', content: value }
        ] as any
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
      await memory.remember('interaction', { input: value, output: response });
      await dna.logInteraction();
      setDnaData({...dna.rawData});
      setStatus('Ready');
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'system', content: err.message, timestamp: Date.now() }]);
      setStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  if (!dnaData) return <Text color="cyan">⚡ Booting ULTIMATE v3...</Text>;

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
        <Box flexDirection="column" width={35} borderStyle="round" borderColor="blue" paddingX={1} marginRight={1}>
          <Text bold color="blue">ENTITY STATE</Text>
          <Text dimColor>Form: {dnaData.identity.currentForm}</Text>
          <Text dimColor>Mutations: {dnaData.mutations}</Text>
          
          <Box flexDirection="column" marginTop={1} height={5}>
            <Text bold color="yellow">PROACTIVE ALERTS</Text>
            {alerts.map((a, i) => <Text key={i} color="gray" >• {a.substring(0, 30)}...</Text>)}
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text bold color="cyan">SKILLS</Text>
            {dnaData.memory.active_skills.slice(-5).map((s: string) => <Text key={s} color="gray">› {s}</Text>)}
          </Box>
          <Spacer />
          <Text dimColor >Press [TAB] to toggle Museum</Text>
        </Box>

        {/* Main View */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
          {mode === 'chat' ? (
            <Box flexDirection="column" flexGrow={1}>
              <Box flexGrow={1} flexDirection="column">
                <Static items={messages.slice(-10)}>
                  {(msg: Message) => (
                    <Box key={msg.timestamp} flexDirection="column" marginBottom={1}>
                      <Text bold color={msg.role === 'user' ? 'magenta' : 'cyan'}>{msg.role.toUpperCase()} →</Text>
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
          ) : (
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
        </Box>
      </Box>
    </Box>
  );
};

render(<TUI />);
