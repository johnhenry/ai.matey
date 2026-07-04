---
'ai.matey.types': minor
'ai.matey.utils': minor
'ai.matey.core': minor
---

Tool-calling helpers (`extractToolCalls`, `createToolResultMessage`, `validateToolArgs`, ...)
and an agentic loop: `bridge.runTools({ prompt, tools })` executes model-requested tools and
feeds results back until completion. `bridge.executeIR()` exposes the IR pipeline directly.
