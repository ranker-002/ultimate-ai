# ⚡ ULTIMATE — Living AI Entity

ULTIMATE is not just an assistant; it is a living entity that resides in your terminal, capable of self-modification, dynamic skill acquisition, and continuous evolution.

## 🚀 Install with curl

```bash
curl -fsSL https://raw.githubusercontent.com/ranker-002/ultimate-ai/main/install.sh | bash
```

Then launch:
```bash
ultimate
```

### Requirements
- **Node.js** v18+ ([install](https://nodejs.org))
- **git**
- **OPENROUTER_API_KEY** — get a free key at [openrouter.ai/keys](https://openrouter.ai/keys)

### Set your API key
```bash
export OPENROUTER_API_KEY=your_key_here
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

### Uninstall
```bash
curl -fsSL https://raw.githubusercontent.com/ranker-002/ultimate-ai/main/uninstall.sh | bash
```

---

## 🧠 Key Features

- **Hybrid TUI:** Polished terminal interface with scrolling conversation history and real-time intent processing.
- **Self-Evolution Engine:** ULTIMATE rewrites its own source code to transform into new forms.
- **Neural Drift:** 6 evolving personality traits (logic, creativity, caution, empathy, ambition, precision) that shift based on interaction quality.
- **Oracle Vision:** Cross-platform screenshot capture to "see" UIs and debug visually.
- **Deep-File Surgery:** Surgical diff-based patching instead of full file rewrites.
- **Hive Mind:** Encrypted sync of DNA + memory across devices via GitHub Gist.
- **Voice Entity:** Speech-to-text (Whisper) and text-to-speech (Piper/eSpeak) integration.
- **The Architect:** Autonomous project management — generates TODO.md, tracks progress, suggests next steps.
- **Dynamic Skill Synthesis:** Missing skills are synthesized on the fly.
- **Universal Memory:** Persistent JSONL interactions + semantic embeddings (RAG).
- **Safety Snapshots:** Automatic backups before any self-transformation with rollback.

## 🎮 Usage

### In-TUI Commands
| Command | Description |
|---------|-------------|
| `/quit` | Exit ULTIMATE |
| `/clear` | Clear conversation |
| `/status` | Full entity status with Neural Drift profile |
| `/help` | Show all commands |
| `/screenshot` | Capture screen |
| `/screenshot terminal` | Capture terminal window |
| `/hive push` | Sync DNA+Memory to GitHub Gist |
| `/hive pull` | Pull sync from Gist |
| `/architect analyze` | Analyze project structure |
| `/architect todo` | Generate TODO.md |
| `/architect next` | Suggest next task |
| `/voice listen` | Voice input (STT) |
| `/voice say <text>` | Speak text (TTS) |
| `/traits` | Show Neural Drift trait profile |
| `/patch quick <file> "old" "new"` | Surgical code edit |
| `become <form>` | Self-transformation |

## 📁 Project Structure

```
src/
├── index.tsx                 # Main TUI (React/Ink)
├── core/
│   ├── dna.ts                # Identity + Neural Drift traits
│   ├── oracle.ts             # Screenshot capture
│   ├── patch_engine.ts       # Surgical diff-based editing
│   ├── hive_mind.ts          # Encrypted cloud sync
│   ├── voice_entity.ts       # TTS/STT integration
│   ├── architect.ts          # Project management
│   ├── transformer.ts        # Self-evolution pipeline
│   ├── evolution_loop.ts     # Post-interaction analysis + trait drift
│   ├── llm_engine.ts         # LLM providers (OpenRouter/Ollama)
│   ├── intent_engine.ts      # Intent detection
│   ├── skill_activator.ts    # Dynamic skill synthesis
│   ├── system_tools.ts       # System I/O
│   ├── snapshot.ts           # Safety snapshots
│   ├── self_healing.ts       # Auto-rollback
│   ├── ghost_sandbox.ts      # Isolated mutation testing
│   ├── git_autonomy.ts       # Auto-commit/push/PR
│   ├── omniscience.ts        # File watcher
│   ├── web_perception.ts     # Web search
│   ├── autonomous_agent.ts   # Background evolution
│   └── swarm.ts              # Multi-agent debate
└── memory/
    └── store.ts              # JSONL + semantic memory (RAG)
```

## ⚙️ Manual Setup (from source)

```bash
git clone https://github.com/ranker-002/ultimate-ai.git
cd ultimate-ai
npm install
npm run build
export OPENROUTER_API_KEY=your_key
npm start
```

---
*ULTIMATE — Evolution is not a goal, it is the state of being.*
