---
'ai.matey.backend': minor
---

Fix missing, stale, and non-lite default models across the backend provider adapters.

**Missing/broken defaults** (adapter had no sensible fallback at all):
- `NVIDIABackendAdapter` and `LMStudioBackendAdapter` set no `defaultModel`, so an unspecified
  request silently inherited `OpenAIBackendAdapter`'s `gpt-5.6-terra` fallback via subclassing - a
  model neither NVIDIA NIM nor a local LM Studio server serves. Now default to
  `meta/llama-3.1-8b-instruct` and `local-model` respectively.
- `HuggingFaceBackendAdapter` had no fallback at all (sent an empty model string). Now defaults to
  the ungated `Qwen/Qwen3.5-9B` (Meta's Llama repos require accepting a gated license, which would
  break a default that's supposed to "just work").
- `OllamaBackendAdapter`'s `fromIR` ignored `config.defaultModel` entirely and always fell back to
  the retired `llama2`. Now respects `config.defaultModel` and falls back to `llama3.2`.

**Retired model IDs** (still accepted the old default, but the model itself is gone):
- `AnyscaleBackendAdapter` / `ReplicateBackendAdapter`: Llama 2 (2023) → Llama 3.1/3 8B Instruct.
- `PerplexityBackendAdapter`: `llama-3.1-sonar-small-128k-online` (retired when Perplexity renamed
  to the plain `sonar` family) → `sonar`.
- `AWSBedrockBackendAdapter`: `anthropic.claude-3-haiku-20240307-v1:0` (2024) →
  `global.anthropic.claude-haiku-4-5-20251001-v1:0`. The bare Haiku 4.5 model ID 400s on Bedrock
  ("on-demand throughput isn't supported for this model") - it must go through the `global.`
  cross-region inference profile.

**Mid-tier → lite-tier bumps** (default worked fine, but pointed at the balanced/flagship tier
instead of the provider's cheaper lite tier - verified live against each platform's current docs
on 2026-08-01, not assumed):
- OpenAI: `gpt-5.6-terra` (balanced) → `gpt-5.6-luna` (fast, low-cost tier).
- Anthropic: `claude-sonnet-5` → `claude-haiku-4-5-20251001` (lightweight tier; also updates the
  `estimateCost()` fallback rate from a Sonnet-tier $3.00/1M to Haiku's actual $1.00/1M).
- Groq: `llama-3.3-70b-versatile` → `llama-3.1-8b-instant` (Groq's cheapest/fastest tier).
- DashScope: `qwen3.7-plus` (mid) → `qwen3.7-flash` (budget tier).

**Deliberately left unchanged** (no reliable lite alternative found):
- xAI's `grok-4.5` - xAI's own docs describe it as "the most intelligent and fastest model," with
  no distinct cheaper tier confirmed live in the current model lineup.
- Together AI's `deepseek-ai/DeepSeek-V4-Pro` - `DeepSeek-V4-Flash` exists on other platforms but
  Together AI's own blog still lists it as "coming soon," not yet live there.
- Azure OpenAI's `gpt-4o` deployment-name guess - Azure deployment IDs are arbitrary names the
  resource owner chose, not a selectable provider model list, so there's no reliable lite
  equivalent to guess at.
- Mistral, Cohere, AI21, Cerebras, Cloudflare, GitHub Models, OpenRouter, Fireworks, DeepInfra,
  Gemini, Moonshot, DeepSeek, SambaNova, Inception - already default to their smallest documented
  tier.
