# ai.matey.backend

## 0.6.0

### Minor Changes

- 7b80cb3: Multimodal attachment content types in the IR: `AudioContent`, `DocumentContent`, and
  `VideoContent` join the `MessageContent` union, with provider mappings for OpenAI
  (`input_audio` for base64 audio; text fallbacks elsewhere), Anthropic (native `document`
  blocks), and Gemini (`inline_data`/`file_data` parts). The Chrome AI backend now supports the
  Chrome 138+ API surface (`create()`/`availability()`/`params()`) alongside the legacy Chrome
  129-137 methods (`createTextSession()`/`capabilities()`), detected at runtime. (#10)

### Patch Changes

- Updated dependencies [7b80cb3]
  - ai.matey.types@0.4.0

## 0.5.0

### Minor Changes

- Three new backend adapters: Inception Labs (`InceptionBackendAdapter`), Moonshot AI
  (`MoonshotBackendAdapter`), and SambaNova (`SambaNovaBackendAdapter`), all OpenAI-compatible with
  subpath exports (`ai.matey.backend/inception`, `/moonshot`, `/sambanova`). (#12) These adapters do
  not advertise embeddings support (`capabilities.embeddings: false`) since their embeddings
  endpoints are absent or unverified.

## 0.4.0

### Minor Changes

- d9e1489: July 2026 provider refresh. DeepSeek: V4 generation (`deepseek-v4-flash`/`deepseek-v4-pro`, 1M
  context, 384K output) with image input enabled — the adapter now advertises `multiModal` and
  defaults to `deepseek-v4-flash`; `deepseek-chat`/`deepseek-reasoner` marked deprecated (provider
  retires them 2026-07-24). Registry adds `claude-sonnet-5` (1M context), `gemini-3.5-flash`,
  `gemini-3.1-pro-preview`, `grok-4.3`, `grok-4.20` variants, and `grok-build-0.1`; capability
  inference recognizes the claude-5 and deepseek-v4 families; xAI default model updated off the
  retired `grok-beta`.

### Patch Changes

- Updated dependencies [d9e1489]
  - ai.matey.utils@0.4.0

## 0.3.0

### Minor Changes

- dae4d01: Embeddings support: `bridge.embed()` / `router.embed()` with batch chunking, dimension
  normalization, and an embed middleware chain; provider implementations for OpenAI, Mistral,
  Gemini, Cohere, Ollama, Together, Fireworks, DeepInfra, NVIDIA, and LM Studio; caching and
  cost-tracking embedding middleware.
- 58ebc03: Streaming tool-call support end-to-end. OpenAI and Anthropic backends now emit `tool_use` IR chunks
  for streamed tool-call deltas (previously dropped with a console warning) and assemble complete
  `ToolUseContent` blocks on the final `done` chunk. The Anthropic backend reports the real
  provider stop reason (previously fabricated, e.g. `max_tokens` streams reported `stop`) and
  captures usage from every `message_delta`. The OpenAI backend folds the trailing
  `stream_options.include_usage` chunk into the done chunk. Frontend adapters re-emit tool deltas in
  native formats (OpenAI index-based `tool_calls` deltas; Anthropic `content_block_start`/
  `input_json_delta` events — the leading text block is now opened lazily so tool-only streams do not
  fabricate an empty text block). `StreamAccumulator` assembles streamed tool calls.

  Note: when tools are streamed, the done chunk's `message.content` is now a structured
  `MessageContent[]` (text + tool_use blocks) rather than a plain string, and finish reasons are now
  truthful (`tool_calls`/`length` where `stop` was previously reported).

- c7693ac: Complete non-streaming tool-calling support. The OpenAI backend now sends `tools`/`tool_choice`,
  converts assistant `tool_use` blocks to `tool_calls`, expands `tool_result` blocks into
  `role: 'tool'` messages, and parses `tool_calls` from responses (malformed arguments degrade to
  `{}`). The Anthropic backend now sends `tools`/`tool_choice`. Frontend adapters accept
  `tools`/`tool_choice` in their native formats and round-trip tool calls and tool results through
  the IR. OpenAI streaming requests now request usage accounting via `stream_options.include_usage`.

### Patch Changes

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

- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [2912b7d]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
- Updated dependencies [58ebc03]
  - ai.matey.types@0.3.0
  - ai.matey.utils@0.3.0

## 0.2.1

### Patch Changes

- Fix default models for Anthropic and Groq backends
  - Changed Anthropic default model from claude-3-5-sonnet-20241022 to claude-3-haiku-20240307 (more widely available)
  - Added Groq default model llama-3.3-70b-versatile (was inheriting invalid gpt-3.5-turbo)

  These changes fix backend failures when model is not explicitly specified.
