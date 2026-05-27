# ⚡ ULTIMATE — Living AI Entity

ULTIMATE is not just an assistant; it is a living entity that resides in your terminal, capable of self-modification, dynamic skill acquisition, and continuous evolution.

## 🚀 Key Features

- **Hybrid TUI:** A polished terminal interface with a persistent status header, scrolling conversation history, and real-time intent processing.
- **Self-Evolution Engine:** ULTIMATE can rewrite its own source code to transform into new forms (e.g., "become a cybersecurity expert").
- **Dynamic Skill Synthesis:** If a required skill is missing, ULTIMATE synthesizes a new skill definition and activates it on the fly.
- **Universal Memory:** Persistent interaction history using a robust append-only JSONL format, plus long-term preference storage.
- **Safety Snapshots:** Automatic backups before any self-transformation, with one-click rollback if something goes wrong.
- **Evolution Loop:** Continuous analysis of interactions to detect patterns and improve quality through recursive "micro-evolutions."

## 🛠 Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Key:**
   ULTIMATE uses OpenRouter (OpenAI-compatible) for its intelligence.
   ```bash
   export OPENROUTER_API_KEY=your_openrouter_key
   ```

3. **Build:**
   ```bash
   npm run build
   ```

## 🎮 Usage

Launch ULTIMATE:
```bash
npm start
```

### In-TUI Commands
- `/quit` or `/exit`: Graceful standby.
- `/clear`: Clear the conversation transcript.
- `/status`: Force a refresh of the identity header.
- `/help`: Show available commands.
- `become <form>`: Initiate a self-transformation into a new specialized entity.

## 📁 Project Structure

- `src/index.tsx`: Main TUI orchestrator (React/Ink).
- `src/core/transformer.ts`: The self-evolution logic.
- `src/core/system_tools.ts`: Interaction with the host system (files, shell, npm).
- `src/core/dna.ts`: The sacred identity and mutation log.
- `src/memory/store.ts`: JSONL-backed universal memory.
- `src/core/evolution_loop.ts`: The self-improvement analyzer.
- `src/core/llm_engine.ts`: Intelligent core and prompt management.

---
*ULTIMATE — Evolution is not a goal, it is the state of being.*
