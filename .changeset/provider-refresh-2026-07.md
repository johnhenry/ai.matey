---
'ai.matey.backend': minor
'ai.matey.utils': minor
'ai.matey.core': patch
---

July 2026 provider refresh. DeepSeek: V4 generation (`deepseek-v4-flash`/`deepseek-v4-pro`, 1M
context, 384K output) with image input enabled — the adapter now advertises `multiModal` and
defaults to `deepseek-v4-flash`; `deepseek-chat`/`deepseek-reasoner` marked deprecated (provider
retires them 2026-07-24). Registry adds `claude-sonnet-5` (1M context), `gemini-3.5-flash`,
`gemini-3.1-pro-preview`, `grok-4.3`, `grok-4.20` variants, and `grok-build-0.1`; capability
inference recognizes the claude-5 and deepseek-v4 families; xAI default model updated off the
retired `grok-beta`.
