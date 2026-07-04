---
'ai.matey.types': minor
'ai.matey.utils': minor
'ai.matey.core': minor
'ai.matey.middleware': patch
'ai.matey.backend': patch
'ai.matey.react.hooks': patch
---

Introduce a shared, data-driven model registry in `ai.matey.utils` as the single source of truth
for model metadata (pricing, context windows, capabilities, quality/latency). The registry ships
with a mid-2026 seed (GPT-5.x/o-series, Claude 4.x, Gemini 2.5/3, Grok, current Mistral/DeepSeek,
plus embedding models) and is runtime-extensible via `registerModels()` / `overrideModelPricing()`,
with alias and longest-prefix fallback so new dated snapshots of known families still resolve.

`ai.matey.core`'s model-pricing API is now a thin delegate over the registry (no API break; legacy
models keep their prices, marked `deprecated`). Capability inference recognizes current families.
Cost-tracking middleware consults the registry before provider-level defaults. `useTokenCount`
consults the registry for context windows. Backend default models updated:
`claude-3-haiku-20240307` → `claude-sonnet-4-5-20250929` (Anthropic), `gpt-3.5-turbo` →
`gpt-5-mini` (OpenAI) — note this changes behavior for requests that omit a model. `estimateCost()`
on both backends now prices the actual requested model. Refreshed `deepseek-chat` pricing.
