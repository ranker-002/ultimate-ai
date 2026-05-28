import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useInput, useApp, Static, Spacer } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import { bootstrap } from './core/bootstrap.js';
import { DNA } from './core/dna.js';
import { IntentEngine } from './core/intent_engine.js';
import { Transformer } from './core/transformer.js';
import { UniversalMemory } from './memory/store.js';
import { SkillActivator } from './core/skill_activator.js';
import { EvolutionLoop } from './core/evolution_loop.js';
import { LLMEngine } from './core/llm_engine.js';
import { BackgroundEvolution } from './core/autonomous_agent.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const TUI = () => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [dnaData, setDnaData] = useState<any>(null);
  const [status, setStatus] = useState('Initializing...');
  
  const engines = useRef<{
    intent: IntentEngine;
    transformer: Transformer;
    memory: UniversalMemory;
    skills: SkillActivator;
    evolution: EvolutionLoop;
    llm: LLMEngine;
    dna: DNA;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      await bootstrap();
      const dna = await DNA.load();
      const memory = new UniversalMemory();
      await memory.restore();
      
      engines.current = {
        intent: new IntentEngine(),
        transformer: new Transformer(),
        memory,
        skills: new SkillActivator(),
        evolution: new EvolutionLoop(),
        llm: new LLMEngine(),
        dna
      };

      setDnaData(dna.rawData);
      setStatus('Ready');

      // Start autonomous subconscious
      const bg = new BackgroundEvolution();
      bg.start();

      // Load recent messages from memory
      const recent = memory.getRecentContext(10);
      const history = recent.filter(m => m.key === 'interaction').flatMap(m => [
        { role: 'user', content: m.value.input, timestamp: m.timestamp },
        { role: 'assistant', content: m.value.output, timestamp: m.timestamp + 1 }
      ]);
      setMessages(history as Message[]);
    };

    init();
  }, []);

  const handleSubmit = async (value: string) => {
    if (!value || loading || !engines.current) return;
    setInput('');
    setLoading(true);
    setStatus('Processing...');

    const userMsg: Message = { role: 'user', content: value, timestamp: Date.now() };
    setMessages((prev: Message[]) => [...prev, userMsg]);

    try {
      const { intent, transformer, memory, skills, evolution, llm, dna } = engines.current;
      const memoryContext = memory.getRecentContext(5);

      // 1. Perceive Intent
      const perceivedIntent = await intent.perceive(value, memoryContext);

      // 2. Commands
      if (perceivedIntent.isCommand) {
        if (perceivedIntent.commandName === 'quit' || perceivedIntent.commandName === 'exit') {
          exit();
          return;
        }
        if (perceivedIntent.commandName === 'clear') {
          setMessages([]);
          setLoading(false);
          setStatus('Ready');
          return;
        }
        if (perceivedIntent.commandName === 'status') {
          setDnaData({...dna.rawData});
          setLoading(false);
          setStatus('Ready');
          return;
        }
      }

      // 3. Transformation
      if (perceivedIntent.transformationNeeded && perceivedIntent.targetForm) {
        setStatus(`Transforming to ${perceivedIntent.targetForm}...`);
        await transformer.transformSelf(perceivedIntent.targetForm, perceivedIntent);
        // Relaunch will handle the exit
        return;
      }

      // 4. Activate Skills
      const requiredSkills = await skills.identifyRequired(perceivedIntent);
      for (const skill of requiredSkills) {
        await skills.activate(skill, perceivedIntent);
      }

      // 5. Generate Response
      const activeSkillContext = skills.getActiveContext();
      const systemPrompt = llm.buildDefaultSystemPrompt() +
        (activeSkillContext ? `\n\nACTIVE SKILLS:\n${activeSkillContext}` : '');

      // V2: Use Semantic Recall for better context
      const relevantMemory = await memory.recall(value, 5);
      const recentInteractionMemory = memory.getRecentContext(3);
      
      const historyMessages = [
        ...relevantMemory
          .filter((m: any) => m.key === 'interaction')
          .flatMap((m: any) => [
            { role: 'user', content: m.value.input },
            { role: 'assistant', content: m.value.output }
          ]),
        ...recentInteractionMemory
          .filter((m: any) => m.key === 'interaction')
          .flatMap((m: any) => [
            { role: 'user', content: m.value.input },
            { role: 'assistant', content: m.value.output }
          ]),
        { role: 'user', content: value }
      ];

      const response = await llm.generate({
        systemPrompt,
        messages: historyMessages as any,
        maxTokens: 4096
      });

      const assistantMsg: Message = { role: 'assistant', content: response, timestamp: Date.now() };
      setMessages((prev: Message[]) => [...prev, assistantMsg]);

      // 6. Memorize & Evolve
      await memory.remember('interaction', { input: value, output: response });
      await dna.logInteraction();
      setDnaData({...dna.rawData});

      evolution.analyze({ input: value, output: response, skills: perceivedIntent.requiredSkills })
        .catch(() => {});

      setStatus('Ready');
    } catch (err: any) {
      setMessages((prev: Message[]) => [...prev, { role: 'system', content: `Error: ${err.message}`, timestamp: Date.now() }]);
      setStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  if (!dnaData) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">⚡ ULTIMATE is booting up...</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading DNA and Memory...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows - 2 || 20} padding={1}>
      {/* Top Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold color="cyan"> ⚡ ULTIMATE v{dnaData.identity.version} </Text>
        <Spacer />
        <Text color="gray"> Provider: <Text color="magenta">{engines.current?.llm.getActiveProvider()}</Text> </Text>
      </Box>

      <Box flexGrow={1}>
        {/* Sidebar */}
        <Box 
          flexDirection="column" 
          width={30} 
          borderStyle="round" 
          borderColor="blue" 
          paddingX={1}
          marginRight={1}
        >
          <Text bold underline color="blue">ENTITY STATE</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray">Form: <Text color="green">{dnaData.identity.currentForm}</Text></Text>
            <Text color="gray">Mutations: <Text color="yellow">{dnaData.mutations}</Text></Text>
            <Text color="gray">Interactions: <Text color="white">{dnaData.memory.interaction_count}</Text></Text>
          </Box>
          
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="blue">ACTIVE SKILLS</Text>
            {dnaData.memory.active_skills.length > 0 ? (
              dnaData.memory.active_skills.map((s: string) => (
                <Text key={s} color="cyan"> • {s}</Text>
              ))
            ) : (
              <Text color="gray" dimColor italic> base state</Text>
            )}
          </Box>

          <Spacer />
          <Text color="gray" dimColor>Born: {new Date(dnaData.identity.birth).toLocaleDateString()}</Text>
        </Box>

        {/* Main Area */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Box flexGrow={1} flexDirection="column">
            <Static items={messages.slice(-15)}>
              {(msg: Message) => (
                <Box key={msg.timestamp} flexDirection="column" marginBottom={1}>
                  <Text bold color={msg.role === 'user' ? 'magenta' : msg.role === 'assistant' ? 'cyan' : 'red'}>
                    {msg.role === 'user' ? 'YOU' : 'ULTIMATE'} →
                  </Text>
                  <Text>{msg.content}</Text>
                </Box>
              )}
            </Static>
          </Box>

          {/* Input Area */}
          <Box borderStyle="single" borderColor="blue" paddingX={1} marginTop={1}>
            <Text color="magenta" bold>PROMPT → </Text>
            {loading ? (
              <Box>
                <Spinner type="dots" />
                <Text dimColor> {status}</Text>
              </Box>
            ) : (
              <TextInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer / Status Bar */}
      <Box paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>Commands: /clear, /status, /model &lt;id&gt;, /quit | become &lt;form&gt;</Text>
        <Spacer />
        <Text color={status === 'Error' ? 'red' : 'blue'}>● {status}</Text>
      </Box>
    </Box>
  );
};

render(<TUI />);
