---
'ai.matey.backend': patch
---

Fix two backend adapter bugs:

- `OpenAIBackendAdapter` now sends `max_completion_tokens` instead of `max_tokens` for
  gpt-5.x and o1/o3/o4 reasoning-model families, which reject `max_tokens` outright. (#19)
- 10 adapters (Azure OpenAI, Cerebras, Cloudflare, DeepInfra, Fireworks, Gemini, Mistral,
  OpenRouter, Together AI, xAI) previously advertised `capabilities.tools: true` while
  silently dropping any `request.tools`/`toolChoice` - they now correctly report
  `tools: false` and surface a `tool-unsupported` `IRWarning` instead of silent data loss.
  Full native tool-calling support for these adapters remains a follow-up. (#17)
