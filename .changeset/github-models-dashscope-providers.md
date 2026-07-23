---
'ai.matey.backend': minor
---

Add two new backend provider adapters:

- `GitHubModelsBackendAdapter` - GitHub Models, an OpenAI-compatible gateway free to any GitHub
  account (rate limits scale with Copilot subscription tier), fronting models from OpenAI, Meta,
  DeepSeek, Mistral, Microsoft, and Cohere. Defaults to `openai/gpt-4o-mini` (the most generously
  rate-limited tier). `estimateCost()` returns `null` since usage is metered against Copilot rate
  limits, not billed per-token.
- `DashScopeBackendAdapter` - Alibaba Cloud Model Studio's OpenAI-compatible mode, hosting the
  Qwen model family. Defaults to `qwen3.7-plus` and the international (Singapore)
  `dashscope-intl.aliyuncs.com` endpoint; override `baseURL` for mainland China deployments.
  `estimateCost()` returns `null` - DashScope pricing isn't consistently published across
  regions/models in English-language docs.

Both follow the same OpenAI-compatible-passthrough pattern as `together-ai`/`fireworks`/
`openrouter`: `structuredOutput: 'fallback'` and `tools: false` (with a warning) rather than
claiming native tool-calling support that isn't actually mapped.
