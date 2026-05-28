# ⚡ ULTIMATE — Master TODO
> Based on full audit of 46 issues. Prioritized by impact.

---

## 🔴 P0 — CRITICAL (Fix immediately)

### Bugs
- [ ] **LLM singleton** — `LLMEngine` is instantiated 8+ times across modules. Convert to singleton pattern. Affects: `evolution_loop.ts`, `intent_engine.ts`, `skill_activator.ts`, `autonomous_agent.ts`, `swarm.ts`, `web_perception.ts`, `architect.ts`, `index.tsx`
- [ ] **Ghost sandbox path traversal** — `ghost_sandbox.ts:24` allows `filePath` like `../../etc/passwd`. Validate all paths stay within ROOT
- [ ] **DNA migration missing** — `bootstrap.ts` doesn't add missing fields (`traits`, `traitHistory`, `ambition`, `precision`) to existing DNA files. Old users crash on first load
- [ ] **Race condition in handleSubmit** — `index.tsx:106` — Rapid submissions bypass `loading` guard. Add mutex/lock
- [ ] **Hive encryption key loss** — `hive_mind.ts` — If `saveConfig()` fails after gist creation, encryption key is lost forever. Atomic save or backup

### Security
- [ ] **SSRF via readPage** — `web_perception.ts:30` — No URL validation. Block internal IPs (localhost, 169.254.x.x, 10.x.x.x)
- [ ] **Path traversal in writeFile** — `system_tools.ts:39` — Validate `filePath` stays within ROOT before writing
- [ ] **Ghost sandbox executes arbitrary code** — `ghost_sandbox.ts:30` — `npm run build` runs LLM-generated code. Add sandboxing (Docker/firejail)

---

## 🟡 P1 — HIGH (Fix this week)

### Bugs
- [ ] **Unused LLM import in web_perception** — `web_perception.ts:3` — Remove dead `LLMEngine` import
- [ ] **Unused LLMMessage import in swarm** — `swarm.ts:1` — Remove unused type import
- [ ] **intent_engine memoryContext unused** — `intent_engine.ts:27` — Either use it in the LLM prompt or remove the parameter
- [ ] **Museum mode empty on first visit** — `index.tsx:87` — Load snapshots on init, not just on TAB press
- [ ] **Background evolution await on sync property** — `autonomous_agent.ts:28` — Remove unnecessary `await`
- [ ] **No retry on LLM JSON parse failure** — `transformer.ts:47` — Add retry with re-prompt

### Performance
- [ ] **System prompt rebuilt every call** — `llm_engine.ts:128` — Cache prompt, invalidate on DNA change
- [ ] **2s polling for alerts** — `index.tsx:77` — Replace with event-driven (chokidar `change` event → callback)
- [ ] **No LLM rate limiting** — Add request queue/cooldown to prevent API flooding from parallel features
- [ ] **Embedding model reloaded** — `store.ts:47` — Check if already loaded before re-initializing

### Code Quality
- [ ] **TUI component 490+ lines** — Split `index.tsx` into: `ChatView`, `Sidebar`, `MuseumView`, `ArchitectView`, `Header`
- [ ] **Inconsistent error handling** — Standardize: all modules return `{ success, data?, error? }` pattern
- [ ] **No DNA validation on load** — `dna.ts:50` — Validate JSON schema before casting to `DNAData`
- [ ] **Hardcoded snapshot file list** — `snapshot.ts:18` — Auto-discover files or use a config

---

## 🟠 P2 — MEDIUM (Fix this month)

### Bugs
- [ ] **Oracle silent failure** — `oracle.ts` — Detect which screenshot tools are available and report clearly
- [ ] **Voice blocks event loop** — `voice_entity.ts:62` — Use `spawn` instead of `execAsync` for arecord
- [ ] **patch_engine no atomicity** — `patch_engine.ts:81` — Write to temp file then rename (atomic)
- [ ] **completedAt = 0 for pending tasks** — `architect.ts:168` — Use -1 or remove field when not completed
- [ ] **Stale ULTIMATE_V2.md** — Mark phases as completed or remove the file

### Security
- [ ] **Hive key stored plaintext** — `hive_mind.ts` — Encrypt key with machine-specific secret
- [ ] **No input sanitization for LLM prompts** — Prompt injection possible via user input

### Missing Features
- [ ] **Smoke test incomplete** — Add tests for: Intent, LLM, Transformer, Oracle, Patch, Hive, Voice, Architect, Neural Drift
- [ ] **No --version/--help CLI flags** — Add argument parsing to entry point
- [ ] **No graceful shutdown** — Add SIGINT/SIGTERM handlers to save state, close watchers, cleanup
- [ ] **No config file** — Support `~/.ultimaterc` or `ultimate.config.js` for API keys, preferences
- [ ] **Swarm never integrated** — Wire `SwarmIntelligence` into complex decision flows
- [ ] **Skill registry dead fields** — `executionPatterns`, `qualityMetrics`, `relatedSkills` never used. Either use or remove

---

## 🔵 P3 — LOW (Backlog)

### Code Quality
- [ ] **No logging system** — Add structured logging with levels (debug/info/warn/error) and optional file output
- [ ] **No ESLint/Prettier** — Add linting and formatting config
- [ ] **No CI/CD** — GitHub Actions for: lint, typecheck, build, smoke test
- [ ] **No test framework** — Install Vitest or Jest, write unit tests for core modules
- [ ] **package.json missing engines** — Add `"engines": { "node": ">=18" }`

### Remaining Features (from roadmap + new ideas)
- [ ] **Provider switching UI** — Let user switch between OpenRouter/Ollama from TUI
- [ ] **Model selection** — Choose specific models per task type
- [ ] **Conversation export** — Export chat history to markdown/JSON
- [ ] **Plugin system** — Allow third-party skill/extension loading
- [ ] **Web UI** — Optional browser-based interface alongside terminal
- [ ] **Multi-language support** — Non-English conversation capability
- [ ] **Cost tracking** — Track LLM API usage and costs
- [ ] **Session persistence** — Resume conversations across restarts
- [ ] **Collaborative mode** — Multiple users share one ULTIMATE instance
- [ ] **Docker deployment** — Containerized install option
- [ ] **Auto-update** — Self-update mechanism for installed instances

### Documentation
- [ ] **Contributing guide** — How to add features, run tests, submit PRs
- [ ] **Architecture docs** — Module relationship diagrams
- [ ] **API reference** — Document all public methods
- [ ] **Changelog** — Track changes between versions

---

## 📊 Priority Summary

| Priority | Items | Effort |
|----------|-------|--------|
| 🔴 P0 Critical | 8 | ~2-3 days |
| 🟡 P1 High | 12 | ~3-4 days |
| 🟠 P2 Medium | 11 | ~1 week |
| 🔵 P3 Low | 14 | Ongoing |
| **Total** | **45** | |

---

## 🎯 Recommended Sprint Order

### Sprint 1 (P0 — Stability)
1. LLM singleton
2. DNA migration
3. Path traversal fixes (ghost sandbox + writeFile)
4. Race condition fix
5. Hive key persistence
6. SSRF protection

### Sprint 2 (P1 — Quality)
1. Split TUI components
2. Standardize error handling
3. Remove dead imports
4. Cache system prompt
5. Event-driven alerts
6. Add LLM retry logic

### Sprint 3 (P2 — Polish)
1. CLI flags (--version, --help)
2. Graceful shutdown
3. Config file support
4. Complete smoke tests
5. Voice non-blocking
6. Atomic patch writes

### Sprint 4+ (P3 — Growth)
1. Logging system
2. CI/CD pipeline
3. Test framework
4. Auto-update
5. Docker support
