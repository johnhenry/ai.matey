---
'ai.matey.cli': patch
'ai.matey.react.core': patch
'ai.matey.react.hooks': patch
'ai.matey.react.nextjs': patch
'ai.matey.react.stream': patch
'ai.matey.testing': patch
'ai.matey.core': patch
---

Lint hardening: previously-unlinted packages (cli, react-*) now pass the strict ESLint config;
fixed floating/misused promises in React hooks and CLI, case-block declarations, and unused
variables. require-await and no-redundant-type-constituents re-enabled repo-wide.
