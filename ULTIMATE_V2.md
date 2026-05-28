# ULTIMATE v2 Implementation Plan

## Phase 1: Multi-Provider & Resilience
- [ ] Refactor `LLMEngine` to use Provider Adapters.
- [ ] Add local Ollama support (fallback).
- [ ] Implement model-switching logic in DNA.

## Phase 2: Immersive Full-Screen TUI
- [ ] Re-architect `src/index.tsx` for full-screen layout (Header, Sidebar/Status, Main Transcript).
- [ ] Implement "Form Browser" (The Museum).
- [ ] Add real-time resource/mutation metrics to the dashboard.

## Phase 3: Semantic Memory (RAG)
- [ ] Implement a lightweight local vector store for interactions.
- [ ] Update `UniversalMemory` to use semantic search for context retrieval.

## Phase 4: Self-Healing & Background Evolution
- [ ] Implement `src/core/test_runner.ts` for behavioral validation.
- [ ] Implement `src/core/autonomous_agent.ts` for background self-analysis.

## Phase 5: Hyper-Tools
- [ ] Add Web Search tool (via DuckDuckGo/Google Search API).
- [ ] Add File Watcher tool for proactive insights.
