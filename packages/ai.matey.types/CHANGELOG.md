# ai.matey.types

## 0.5.0

### Minor Changes

- b69566f: Add `responseFormat` to the IR request for per-provider structured/schema-constrained
  output. `IRChatRequest.responseFormat` (`{ type: 'json_schema', schema, strict? }`) reuses
  the existing `JSONSchema` type. OpenAI, Anthropic, Gemini, and their OpenAI-compatible
  inheritors (Groq, DeepSeek, Inception, Moonshot, NVIDIA, LM Studio, SambaNova) map it to
  their native structured-output mechanism; all other backends emulate it via prompt
  injection and best-effort JSON extraction. `IRCapabilities.structuredOutput` and
  `response.metadata.custom.responseFormatEnforced` let callers tell which path was used.
  (#16)

## 0.4.0

### Minor Changes

- 7b80cb3: Multimodal attachment content types in the IR: `AudioContent`, `DocumentContent`, and
  `VideoContent` join the `MessageContent` union, with provider mappings for OpenAI
  (`input_audio` for base64 audio; text fallbacks elsewhere), Anthropic (native `document`
  blocks), and Gemini (`inline_data`/`file_data` parts). The Chrome AI backend now supports the
  Chrome 138+ API surface (`create()`/`availability()`/`params()`) alongside the legacy Chrome
  129-137 methods (`createTextSession()`/`capabilities()`), detected at runtime. (#10)

## 0.3.0

### Minor Changes

- dae4d01: Embeddings support: `bridge.embed()` / `router.embed()` with batch chunking, dimension
  normalization, and an embed middleware chain; provider implementations for OpenAI, Mistral,
  Gemini, Cohere, Ollama, Together, Fireworks, DeepInfra, NVIDIA, and LM Studio; caching and
  cost-tracking embedding middleware.
- 2912b7d: Introduce a shared, data-driven model registry in `ai.matey.utils` as the single source of truth
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

- 78731bb: Router emits `model-substituted` warnings (metadata + new `RouterConfig.onWarning` callback) when
  hybrid translation falls back to a backend default model. http.core gains a framework-agnostic
  `GenericRateLimiter`; `RouteMatcher.match()` accepts any structurally-compatible request.
- b7e2312: Tool-calling helpers (`extractToolCalls`, `createToolResultMessage`, `validateToolArgs`, ...)
  and an agentic loop: `bridge.runTools({ prompt, tools })` executes model-requested tools and
  feeds results back until completion. `bridge.executeIR()` exposes the IR pipeline directly.

### Patch Changes

- e7df1d0: Remove vestigial `ai.matey.backend` runtime dependency from `ai.matey.frontend` (frontend adapters
  never imported it). Document `StreamToolUseChunk` delta semantics and add an optional `index` field
  identifying the tool call's position within the assistant message.
