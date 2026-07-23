# ai.matey.utils

## 0.5.0

### Minor Changes

- 5b44733: July 23 2026 provider refresh, plus a real bug fix.

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

## 0.4.2

### Patch Changes

- 73aa9f1: Fix broken CJS entry points across the whole package family. Every package declares
  `"type": "module"` for ESM subpath resolution, but shipped `dist/cjs/` builds with no nested
  override - Node walked up to the package root, saw `"type": "module"`, and misinterpreted the
  compiled CommonJS as ESM, so `require("ai.matey.x")` failed with `Cannot find module './y.js'`
  on every package in the family (ESM `import` was unaffected). Each package's build now emits a
  `dist/cjs/package.json` containing `{"type":"commonjs"}` (via a new
  `scripts/fix-cjs-package-json.js` post-build step) to correctly scope the CJS build's module
  type. No source or `exports` map changes - verified via `npm pack` + fresh install against the
  exact repro in #23, both direct `require()` and the `require` export condition on subpaths (e.g.
  `ai.matey.backend.browser/chrome-ai`).

  (#23)

- Updated dependencies [73aa9f1]
  - ai.matey.errors@0.2.1
  - ai.matey.types@0.5.1

## 0.4.1

### Patch Changes

- New LiteRT-LM backend adapter: run Gemma on-device in the browser via WebGPU
  (`@litert-lm/core`, optional peer). Streaming-native with engine caching per model URL,
  AbortSignal cancellation, and semantic-drift warnings for the Web SDK's dropped features
  (sampler params, tools, non-text content). Registry entries for Gemma-4 E2B/E4B. Also:
  node-llama-cpp is now properly declared as an optional peer dependency of
  ai.matey.native.node-llamacpp.

## 0.4.0

### Minor Changes

- d9e1489: July 2026 provider refresh. DeepSeek: V4 generation (`deepseek-v4-flash`/`deepseek-v4-pro`, 1M
  context, 384K output) with image input enabled — the adapter now advertises `multiModal` and
  defaults to `deepseek-v4-flash`; `deepseek-chat`/`deepseek-reasoner` marked deprecated (provider
  retires them 2026-07-24). Registry adds `claude-sonnet-5` (1M context), `gemini-3.5-flash`,
  `gemini-3.1-pro-preview`, `grok-4.3`, `grok-4.20` variants, and `grok-build-0.1`; capability
  inference recognizes the claude-5 and deepseek-v4 families; xAI default model updated off the
  retired `grok-beta`.

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

- b7e2312: Tool-calling helpers (`extractToolCalls`, `createToolResultMessage`, `validateToolArgs`, ...)
  and an agentic loop: `bridge.runTools({ prompt, tools })` executes model-requested tools and
  feeds results back until completion. `bridge.executeIR()` exposes the IR pipeline directly.
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

### Patch Changes

- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [2912b7d]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
  - ai.matey.types@0.3.0
