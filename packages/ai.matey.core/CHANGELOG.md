# @johnhenry/aimatey-core

## 0.2.0

### Minor Changes

- 213b23e: Make a registered router backend reconfigurable: add `Router.replace()` and stop `unregister()`
  from refusing the default or the last backend.

  There was previously no way to change a backend's configuration once it was registered. The common
  case is a rotated API key: `register()` rejected a name that already existed, and `unregister()`
  refused to remove the default backend or the last remaining one, so both doors were closed at once.
  A single-backend router — the most common shape — was stuck with whatever adapter it was built with.

  **New: `Router.replace(name, adapter)`** (added to the `Router` interface in
  `@johnhenry/aimatey-types` and implemented in `@johnhenry/aimatey-core`)

  ```ts
  router.replace('openai', new OpenAIBackendAdapter({ apiKey: rotatedKey }));
  ```

  Swaps the adapter behind an existing name and keeps everything that refers to that backend _by
  name_: registration order, the fallback chain, model mappings, model patterns, and
  backend-specific translation mappings. An unregister/register round trip loses all of that, which
  is why it is not a substitute.

  `register()` deliberately stays strict rather than becoming an upsert — a duplicate name is almost
  always a double-initialization bug, and silently swapping the adapter would hide it. `replace()`
  correspondingly throws `ROUTING_FAILED` for a name that is _not_ registered; callers who want
  upsert semantics can write `router.has(n) ? router.replace(n, a) : router.register(n, a)`.

  State handling across a `replace()` is split deliberately:
  - **Carried over** — `totalRequests`, `successfulRequests`, `failedRequests`, `latencies`,
    `totalCost`. These are a cumulative accounting record of traffic sent to this logical backend.
    Zeroing `totalCost` on a credential change would silently corrupt spend tracking.
  - **Reset** — `isHealthy`, `circuitBreakerState`, `consecutiveFailures`, `circuitOpenedAt`,
    `lastHealthCheck`. These are a live judgement about a configuration that no longer exists.
    Keeping them would defeat the motivating use case: an expired key trips the circuit breaker, and
    a breaker left open would keep refusing the _new_, working key until `circuitBreakerTimeout`
    elapsed — or fail every request outright if this is the only backend.

  Follow `replace()` with `resetStats()` for a fully clean slate.

  **Changed: `Router.unregister()`**
  - The "cannot unregister last backend" guard is gone. Zero backends is a legitimate transient state
    — it is also the state of a freshly constructed `new Router()`, so the guard was not upholding an
    invariant that otherwise held. An app whose only provider was just disconnected is in exactly that
    state, and it now surfaces as a routing error on the next request rather than as a failure to
    remove the backend.
  - Unregistering the backend named by `config.defaultBackend` no longer throws. `defaultBackend` is
    cleared instead, and a `routing-config-changed` warning is emitted through
    `RouterConfig.onWarning` so the change is not silent.
  - Unregistering now also prunes every routing rule that named the removed backend: fallback-chain
    entries, model mappings, model patterns, and its backend-specific translation mapping. These were
    previously left dangling, violating the invariant that each `setFallbackChain` /
    `setModelMapping` / `setModelPatterns` / `setBackendTranslationMapping` call validates — and a
    later `register()` of a _different_ adapter under the same name silently inherited the removed
    backend's routing rules and translation mappings.
  - Unregistering a name that is not registered still throws `ROUTING_FAILED`.

  **Also new:** the `routing-config-changed` `WarningCategory` in `@johnhenry/aimatey-types`, for
  warnings about the router rewriting its own configuration (there is no request to attach these to,
  so `onWarning` is the only channel).

  Compatibility: removing a thrown error is not a breaking change for correct callers, but code that
  relied on `unregister()` throwing for the default or last backend will now see it succeed. Adding
  `replace()` to the `Router` interface is a breaking change only for third-party classes that
  `implement Router` directly.

### Patch Changes

- 6e79fa1: Fix `RequestOptions.backend` being silently ignored, so a request that explicitly asks for
  one provider is no longer served by another.

  `Router` reads its explicit-routing decision from `request.metadata.custom.backend`, but
  `Bridge.enrichRequest()` only ever merged `options.metadata` into that object - it never
  read `options.backend`. The documented per-request override was therefore inert on every
  path (`chat`, `chatStream`, `executeIR`, `executeIRStream`), while the undocumented
  `metadata.custom.backend` was the only mechanism that actually worked. A request asking
  for `{ backend: 'expensive' }` was answered by the router's `defaultBackend` with no error
  and no warning.

  `enrichRequest()` now folds `options.backend` into `metadata.custom.backend`. It is
  applied after `options.metadata`, so the typed, first-class option is authoritative over
  both a `metadata.custom.backend` already on the request and an untyped `backend` key
  passed through `options.metadata`. Omitting `options.backend` leaves an existing
  `metadata.custom.backend` untouched, so the pre-existing channel keeps working.

  **Unregistered backend names now fail fast.** `Router.selectBackend()` treats an
  unavailable preference as "fall through to strategy selection", which means a typo like
  `{ backend: 'antropic' }` also routed elsewhere in silence. For an explicit override that
  is the wrong behaviour, so the bridge now rejects a name the router has never had
  registered with an `AdapterError` carrying `ErrorCode.ROUTING_FAILED`, before any work is
  done. This is scoped deliberately:
  - Only _unregistered_ names are rejected. A backend that is registered but currently
    unhealthy or has an open circuit breaker is still handled by the router's fallback -
    that is what fallback is for.
  - Only the `options.backend` channel is affected. It was previously inert, so nothing can
    depend on its old behaviour. The lenient `metadata.custom.backend` channel is unchanged,
    to avoid breaking callers that rely on it under a non-`explicit` routing strategy.
  - On a bridge whose backend is a single adapter rather than a router there is no routing
    to override, so the option stays inert rather than throwing.

  Also documents the contract on `RequestOptions.backend`, and adds the previously
  undocumented `options` parameter of `chat()` / `chatStream()` to the Bridge API reference.

- 0ac4957: Fix middleware being silently skipped on every streaming request.

  `MiddlewareStack` kept two separate registries - `middleware` and
  `streamingMiddleware` - and `executeStream()` early-returned the backend stream
  whenever `streamingMiddleware` was empty. `Bridge.use()` only ever wrote to
  `middleware`, and `MiddlewareStack` was `private` on the Bridge, so
  `streamingMiddleware` was _always_ empty through the public API. Every
  middleware registered with `bridge.use()` - retry, caching, logging, telemetry,
  cost tracking, validation, security - ran for `chat()` and did nothing at all
  for `chatStream()`, while `getMiddleware()` kept reporting it as registered. For
  a chat app, where streaming is the normal path, that meant PII redaction and
  prompt-injection detection quietly never ran.

  **`bridge.use()` now runs on both paths.** The stack keeps one ordered
  registry and adapts each `Middleware` onto the stream via a new exported
  `adaptMiddlewareToStreaming()`, preserving the onion shape:
  - the request phase (before `await next()`) runs before the backend is called;
  - chunks pass straight through - no buffering, no added latency;
  - the response phase (after `await next()`) runs once the stream has been
    consumed, against a real `IRChatResponse` assembled from the delivered chunks,
    so logging, telemetry, cost tracking, caching and conversation history see
    genuine content, usage and finish reason rather than a stub.

  **Request rewrites now reach the backend.** `Bridge` called the backend with the
  request it had captured before the chain ran, so a middleware that reassigned
  `context.request` - `createValidationMiddleware`'s PII redaction and
  sanitization, `createTransformMiddleware`, `createSecurityMiddleware`,
  `createConversationHistoryMiddleware` - had its rewrite thrown away on _both_
  paths. `chat()`, `chatStream()`, `executeIR()` and `executeIRStream()` now read
  `context.request` when they call the backend.

  **New: `bridge.useStreaming(mw)`** for stream-native middleware that transforms
  chunks directly, plus `removeStreamingMiddleware()` and
  `getStreamingMiddleware()`. `createStreamingCostTrackingMiddleware()` -
  previously unreachable through `Bridge` at all - can now be registered.
  `use()` and `useStreaming()` registrations interleave in registration order.

  **Documented limitations of the adapted path** (a middleware that needs the
  assembled response cannot behave identically on a stream, and this does not
  pretend otherwise):
  - The chunks have already reached the consumer when the response phase runs, so
    **modifications a middleware makes to the assembled response are dropped**.
    The response is explicitly marked: `metadata.custom.assembledFromStream` is
    `true` and an `info`-severity `capability-unsupported` `IRWarning` states the
    drift. Use `useStreaming()` to change what the consumer sees.
  - Errors thrown _after_ `next()` surface while the consumer iterates the stream,
    not from the `chatStream()` call. Errors thrown _before_ `next()` propagate
    from `chatStream()` exactly as they do from `chat()`.
  - A middleware that short-circuits without calling `next()` (a cache hit) has
    its response replayed as a synthetic stream, with a `capability-unsupported`
    warning on the start chunk noting the chunk boundaries are synthetic.
  - A partially delivered stream cannot be restarted: a second `next()` call
    throws a `MiddlewareError` rather than silently advancing the chain.
  - A consumer that abandons the stream still runs the response phase, with a
    partial response whose `finishReason` is `cancelled`.

  `MiddlewareOptions.supportsStreaming` was left unused. It belongs to a
  `MiddlewareWithMetadata` builder that does not exist anywhere in the repo, and
  it is an opt-_in_ boolean - which would mean middleware defaults to being
  skipped on streams, the very bug being fixed. The opt-in that is actually
  needed is the opposite one, chunk-level control, and the `StreamingMiddleware`
  type plus `useStreaming()` already express it. The field's doc comment now says
  so.

  (#46)

- Updated dependencies [6e79fa1]
- Updated dependencies [213b23e]
- Updated dependencies [0ac4957]
  - @johnhenry/aimatey-types@0.2.0
  - @johnhenry/aimatey-errors@0.1.1
  - @johnhenry/aimatey-utils@0.1.1

## 0.1.0

### Minor Changes

- Republish from current main with a real fresh build.

  The 0.0.0 scope-import publishes (2026-08-26) shipped stale dist output --
  local npm publish without a rebuild, so the tarballs were missing everything
  after mid-July: the OmniRoute/GitHub Models/DashScope/Moonshot/SambaNova/
  Inception providers, litert-lm, the embeddings types module, and the
  provider-default-model fixes. This release republishes every package from
  current main (which also includes the 2026-08-26 audit fixes) via the CI
  release workflow, which always builds fresh before publishing.

### Patch Changes

- Updated dependencies
  - @johnhenry/aimatey-errors@0.1.0
  - @johnhenry/aimatey-types@0.1.0
  - @johnhenry/aimatey-utils@0.1.0

> Previously published as `ai.matey.core`, last unscoped version `0.3.4`.

## 0.3.4

### Patch Changes

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

- Updated dependencies [5b44733]
  - ai.matey.utils@0.5.0

## 0.3.3

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
  - ai.matey.utils@0.4.2

## 0.3.2

### Patch Changes

- Streaming methods now check `AbortSignal` between chunks in Bridge, Router, and the chat wrapper,
  so aborting a request stops delivery promptly instead of draining the remaining stream. (#8)

## 0.3.1

### Patch Changes

- d9e1489: July 2026 provider refresh. DeepSeek: V4 generation (`deepseek-v4-flash`/`deepseek-v4-pro`, 1M
  context, 384K output) with image input enabled — the adapter now advertises `multiModal` and
  defaults to `deepseek-v4-flash`; `deepseek-chat`/`deepseek-reasoner` marked deprecated (provider
  retires them 2026-07-24). Registry adds `claude-sonnet-5` (1M context), `gemini-3.5-flash`,
  `gemini-3.1-pro-preview`, `grok-4.3`, `grok-4.20` variants, and `grok-build-0.1`; capability
  inference recognizes the claude-5 and deepseek-v4 families; xAI default model updated off the
  retired `grok-beta`.
- Updated dependencies [d9e1489]
  - ai.matey.utils@0.4.0

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

- f227db2: Lint hardening: previously-unlinted packages (cli, react-\*) now pass the strict ESLint config;
  fixed floating/misused promises in React hooks and CLI, case-block declarations, and unused
  variables. require-await and no-redundant-type-constituents re-enabled repo-wide.
- aef9f4a: New `ai.matey.patterns` package: complexity routing, parallel aggregation, failover middleware,
  cost optimization with budget windows, and batch processing. Router's `dispatchParallel` now
  actually honors the `fastest` strategy (previously returned the first-registered success).
- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [2912b7d]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
- Updated dependencies [58ebc03]
  - ai.matey.types@0.3.0
  - ai.matey.utils@0.3.0
