---
'ai.matey.backend': minor
'ai.matey.utils': minor
'ai.matey.core': patch
---

July 23 2026 provider refresh, plus a real bug fix.

**Bug fix (Anthropic)**: Claude Opus 4.7+ (including 4.8) and Claude Sonnet 5 return HTTP 400 if
`temperature`/`top_p`/`top_k` are set to a non-default value. `AnthropicBackendAdapter` now omits
these params for those models (new exported `supportsSamplingParams()` helper) and surfaces a
`parameter-unsupported` `IRWarning` instead of forwarding a request that would be rejected.

**Default model bumps** (all confirmed stale/deprecated against provider docs as of 2026-07-23):
- OpenAI: `gpt-5-mini` → `gpt-5.6-terra` (the dated `gpt-5-mini-2025-08-07` snapshot is deprecated,
  shuts down 2026-12-11)
- Anthropic: `claude-sonnet-4-5-20250929` → `claude-sonnet-5` (Anthropic's current default)
- xAI: `grok-4.3` → `grok-4.5`
- Moonshot: `moonshot-v1-8k` → `kimi-k3` (2.8T-param flagship, 1,048,576 context, native
  multimodal - `multiModal`/`maxContextTokens` updated accordingly)
- Gemini: `gemini-2.0-flash-lite` → `gemini-3.6-flash`

**Aggregator adapter defaults** (OpenRouter, Fireworks, Together AI route to many vendors' models
rather than owning a single lineage - their defaults were verified directly against each
platform's live catalog on 2026-07-23, not assumed):
- OpenRouter: `anthropic/claude-3-haiku` → `anthropic/claude-haiku-4.5` (Claude 3 Haiku is retired
  on Anthropic's own API and EOL on Bedrock 2026-09-10; `anthropic/claude-haiku-4.5` confirmed
  live via OpenRouter's public `/api/v1/models` endpoint, pricing matches Anthropic's own rate
  exactly)
- Fireworks AI: `accounts/fireworks/models/llama-v3p1-8b-instruct` →
  `accounts/fireworks/models/deepseek-v4-flash` (confirmed listed on fireworks.ai/models);
  `maxContextTokens` raised 128000 → 1000000 to match
- Together AI: `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` → `deepseek-ai/DeepSeek-V4-Pro`
  (confirmed listed on together.ai/models); `maxContextTokens` raised 128000 → 1000000 to match

**Registry additions** (`ai.matey.utils`'s `MODEL_REGISTRY_SEED`): `gpt-5.6-sol/terra/luna`
(marking the deprecated dated GPT-5/o3 snapshots - `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `o3` -
`deprecated: true`), `claude-opus-4-8`, `claude-fable-5`, `grok-4.5`, `gemini-3.6-flash`,
`gemini-3.5-flash-lite`, and a new Moonshot AI section (`kimi-k3`, pricing confirmed via
OpenRouter's live catalog). Some pricing figures for other brand-new SKUs (Gemini 3.6
Flash/3.5 Flash-Lite, Grok 4.5, Fable 5, Opus 4.8) are estimates flagged in code comments, not
independently confirmed - override via `registerModels()` if you have exact numbers.

**Capability inference** (`ai.matey.core`): adds a `moonshot` family (`kimi`/`moonshot` name
matching) so Kimi K3 and future Moonshot models get sensible capability defaults instead of
falling through to nothing.

**Known gaps, not addressed by this refresh** (see the research thread for detail): whether any
new inference-speed/open-weight/regional LLM providers outside ai.matey's current 24 are worth
adding, and the state of MCP/agent-interop/computer-use/prompt-caching/batch-API standardization
across providers - both remain open follow-up research, not confirmed non-issues.
