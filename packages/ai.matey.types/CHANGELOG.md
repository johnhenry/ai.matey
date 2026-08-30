# @johnhenry/aimatey-types

## 0.3.0

### Minor Changes

- 3467132: Scope cache entries to a caller, and stop caching requests that name none.

  `createCachingMiddleware`'s default key was a hash of model, messages and parameters, and
  `createEmbeddingCachingMiddleware`'s of input, model and parameters. Neither had any notion
  of who was asking. One process answering for several users therefore had a single cache
  bucket shared by all of them: the second user to send a prompt was handed the first user's
  completion. That is a disclosure bug wearing a performance bug's clothes, and nothing in
  the API made it visible - a caller who configured caching and nothing else got it (#44).

  A `scopeKey` option was added in #45 so a deployment _could_ scope entries by tenant. It
  had to be opted into, which is the wrong way round for this failure mode: the deployment
  that never heard of the option is exactly the one that is leaking.

  **Identity is now a first-class IR field.** `IRMetadata.principal` is an opaque,
  deployment-defined string - a tenant ID, a user ID, an API-key fingerprint, a composite
  like `tenant-7:user-42`. It is compared verbatim, never parsed, and never sent to a
  provider. `Bridge.chat()`, `chatStream()` and `embed()` set it from a typed request option:

  ```typescript
  await bridge.chat(request, { principal: `tenant-${tenantId}:user-${userId}` });
  ```

  It is deliberately not a convention inside `metadata.custom`. `custom` is an unstructured
  bag whose keys mean whatever an application decided they mean, so no middleware can read
  identity out of it safely; scoping that exists to keep users apart needs a field with one
  defined meaning. (The previous documentation suggested `metadata.custom.tenantId`, which
  worked only because you wrote both halves of the convention yourself.)

  **The default is now to cache less.** The cache key mixes in a scope taken from `scopeKey`
  if set, otherwise from `metadata.principal`. A request with neither is not cached at all:
  it goes to the backend, the response comes back with a `cache-bypassed` warning on
  `metadata.warnings` and `metadata.custom.cacheBypassed === true`, and nothing is written.
  Nothing written is nothing that can later be read by the wrong caller.

  The alternative default - keep sharing, and warn - was rejected. The two failure modes are
  not symmetric: defaulting to sharing discloses one user's completion to another and does so
  silently, while defaulting to bypassing costs cache hits until somebody sets one option and
  says so in a warning on every response. The expensive mistake is the recoverable one.

  **Single-tenant deployments say so once.** One process, one audience, every entry safe to
  share - that is why caching was switched on, and it keeps working:

  ```typescript
  bridge.use(createCachingMiddleware({ ttl: 3_600_000, unidentified: 'share' }));
  ```

  `unidentified: 'share'` restores the pre-#44 behaviour for requests that carry no identity.
  Requests that _do_ carry a principal stay scoped to it even in this mode.

  **Existing cache entries survive.** The scope is dropped from the hashed payload when it is
  undefined, so `unidentified: 'share'` produces byte-identical keys to the ones this
  middleware produced before caller scoping existed: an external cache (Redis and friends)
  keeps every entry across the upgrade, and a test pins that. Deployments that adopt
  principals get new keys for newly-scoped requests, which is the point - the old unscoped
  entries are simply never read again rather than being served to somebody they do not belong
  to.

  Nothing here reintroduces a Node-only dependency: keys are still hashed with the pure-JS
  `stableHash` that #48 moved to, so the middleware keeps working in browsers, webviews and
  Electron renderers.

  **Why minor rather than patch.** Two reasons, either of which would be enough. New public
  API is added - `IRMetadata.principal`, `RequestOptions.principal`, `EmbedOptions.principal`,
  `CachingConfig.unidentified`, `EmbeddingCachingConfig.unidentified`, and a `cache-bypassed`
  member on `WarningCategory`. And a deployment that upgrades without reading anything sees
  its cache stop serving hits until it supplies a principal or opts into sharing. That is a
  behaviour change in the safe direction, but it is a behaviour change, and it should not
  arrive in a patch that reads as "no action required".

  A custom `keyGenerator` is unaffected: supplying one still takes over key derivation
  entirely, `scopeKey`, `principal` and `unidentified` are all bypassed, and the generator
  remains responsible for mixing in caller identity itself.

- 681fa2d: Remove the dead `MiddlewareOptions` and `MiddlewareWithMetadata` types (#63).

  Both were exported from `@johnhenry/aimatey-types` and referenced by nothing -
  two declarations, zero uses. All 16 factories in `@johnhenry/aimatey-middleware`
  return plain `Middleware` functions, and no registration path ever accepted a
  metadata wrapper, so neither type was usable even in principle.

  `MiddlewareOptions.supportsStreaming` was the reason to delete rather than keep.
  It read like the switch controlling whether a middleware ran on streaming
  requests - exactly the question #46 was about - while being inert, so it cost
  every reader the time to work out that it did nothing. It was also opt-**in**: a
  middleware would default to _not_ running on streams, which is the bug #46
  fixed, not a design anyone would want now. #50 added a doc comment saying the
  flag was decorative, which patched over the problem rather than resolving it.

  Nothing in the repository referenced either type; the `MiddlewareWithMetadata`
  builder they imply survives only in `specs/001-universal-ai-adapter/contracts/`,
  which declares its own copies and is unaffected. Removing an exported type is
  breaking in the strictest sense, hence `minor` (the breaking-change bump on a 0.x
  package) rather than `patch`.

  The `Middleware` / `StreamingMiddleware` function types and
  `bridge.use()` / `bridge.useStreaming()` are unchanged and remain the whole
  registration surface. `packages/ai.matey.types/src/middleware.ts` now carries a
  note in place of the removed block, explaining why there is no metadata wrapper.

- eb8580b: Name middleware, so a failure says which one failed.

  `MiddlewareError.middlewareName` existed, was typed and documented, and never
  held a middleware name. The four sites that set it hardcoded the literal
  `'unknown'`; the two that actually wrap a middleware failure omitted it. A
  stack of eight middleware reported `Middleware execution failed: <message>`
  with no indication of which one broke - the one piece of provenance the wrapper
  exists to add was always either absent or a placeholder.

  The blocker was that `MiddlewareStack` entries carried no name, so naming
  middleware was the prerequisite.

  `use()` and `useStreaming()` - on both `MiddlewareStack` and `Bridge` - now
  take an optional second argument:

  ```ts
  bridge.use(createRetryMiddleware({ maxAttempts: 3 }), { name: 'retry' });
  ```

  and a failure reads:

  ```
  Middleware "retry" failed: connection reset
  ```

  The name is resolved at registration, in order:
  1. `options.name`;
  2. the function's own `.name` - free for `function rateLimit()` and for
     `const rateLimit = async (ctx, next) => ...`, and skipped when it carries no
     information (`middleware`, `handler`, `fn`, …);
  3. the registration position, `middleware[3]`.

  The position is the index across _both_ `use()` and `useStreaming()`, so the
  same middleware is named identically on the streaming and the non-streaming
  path. It is never `'unknown'`: a position is less useful than a name and far
  more useful than nothing. The four lock-guard errors now name the middleware
  being added or removed instead of claiming `'unknown'`, and report no name at
  all when the function is anonymous.

  Every middleware factory in `@johnhenry/aimatey-middleware` ends in
  `return async (context, next) => {…}`, which produces an anonymous function -
  so pass `{ name }` for anything built by one, or it can only be identified by
  position.

  **API addition, fully backward compatible.** The new parameter is optional;
  every existing `use(middleware)` and `useStreaming(middleware)` call keeps
  working unchanged, and `remove()`/`getMiddleware()` identity is unaffected.
  The only observable change is the wording of the failure message, which gained
  the middleware's name.

- e800f3d: Classify `isRetryable` the same way everywhere.

  Four sites decided retryability and they disagreed, so the same fault was
  transient or permanent depending on which path reached it - and `isRetryable`
  is the only thing retry logic keys off.

  **`RouterError` derives `ALL_BACKENDS_FAILED` from its leaves, not from its
  code.** It asserted `isRetryable: options.code === ALL_BACKENDS_FAILED`, so a
  router whose every backend rejected the API key produced a "retryable" error
  and the caller burned its whole retry budget on a fault that was permanent at
  every leaf. `RouterErrorOptions` gains an optional `backendErrors`, and
  retryability is now `true` only when at least one attempted backend failed
  retryably - `some`, not `every`, because retrying helps as soon as one leg
  could succeed. This is the same principle as the `MiddlewareError` fix: a
  composite has no more standing to reclassify its parts than a wrapper has to
  reclassify its cause.

  **The router builds every `ALL_BACKENDS_FAILED` through `RouterError`.** There
  were four construction sites and three answers: `isRetryable: true` in parallel
  dispatch and parallel fallback, `false` on the embeddings and sequential
  fallback paths, none of them going through `RouterError`, which said `true` for
  all of them. All four now go through `RouterError`, which carries the leaf
  errors where they exist and derives one answer from them.

  **Neither retry implementation retries an unclassified error.** `Bridge`'s
  `config.retries` loop treated a non-`AdapterError` as retryable while
  `defaultShouldRetry` in `createRetryMiddleware` did not. `Bridge` now agrees
  with the middleware: an unclassified throwable is as likely a bug in the
  caller's own adapter or middleware as a transient fault, retrying it re-runs
  every middleware side effect for something that cannot succeed, and `Bridge`
  already wrapped such an error as a non-retryable `INTERNAL_ERROR` on the way
  out - so retrying it contradicted the classification it then handed the caller.

  **`408 Request Timeout` and `425 Too Early` are retryable.**
  `createErrorFromHttpResponse` had explicit branches for 401, 403, 429, 400 and
  5xx and fell through to `statusCode >= 500` for everything else, so the two
  statuses whose entire meaning is "try again" were marked permanent. `404`,
  `409` and `422` were checked and stay non-retryable: an identical retry
  reproduces each of them.

  Both flags are read duck-typed rather than through `instanceof AdapterError`,
  so a second copy of the errors package across the ESM/CJS boundary does not
  silently disable retries.

  **Behaviour changes.**
  - A `RouterError` built with `ALL_BACKENDS_FAILED` and no `backendErrors` is
    now non-retryable. If you construct one yourself and want the old answer,
    pass the failures it composes:

    ```ts
    new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['openai', 'anthropic'],
      backendErrors: [openaiError, anthropicError], // <- new
    });
    ```

  - `bridge.chat()` with `config.retries` no longer retries a backend failure
    that is not an `AdapterError` (or does not carry `isRetryable: true`). A
    backend that wants its failures retried should raise a classified error -
    `NetworkError`, `RateLimitError`, or an `AdapterError` with
    `isRetryable: true`.
  - The router's `ALL_BACKENDS_FAILED` errors are now `RouterError` instances
    rather than bare `AdapterError`s. `RouterError extends AdapterError` and the
    `code` is unchanged, so `instanceof AdapterError` and `error.code` checks are
    unaffected; only a check on `error.name === 'AdapterError'` would notice.

- 71e5631: Make `createSecurityMiddleware` actually secure the request (#55).

  `createSecurityMiddleware` computed a `securityHeaders` object, wrote it to
  `request.metadata.custom.securityHeaders`, and returned. Nothing in the
  repository ever read that key - no backend adapter consulted it, and none of the
  24 providers attached it to an outgoing request. Registered on a Bridge, a
  middleware named `createSecurityMiddleware` passed every request through
  untouched: `card 4111 1111 1111 1111` reached the backend verbatim. It made an
  application look protected in code review while doing nothing at runtime.

  **Request protection.** The middleware now sanitizes message content, redacts
  PII, and detects prompt injection _before_ the request reaches the backend, on
  both `chat()` and `chatStream()`:

  ```ts
  bridge.use(createSecurityMiddleware());
  await bridge.chat({ messages: [{ role: 'user', content: 'card 4111 1111 1111 1111' }] });
  // backend receives: "card [REDACTED_CREDITCARD]"
  ```

  New `SecurityConfig` options: `redactPII` (default `true`), `piiPatterns`,
  `promptInjectionAction` (`'warn'` default, or `'block' | 'log' | 'ignore'`),
  `injectionPatterns`, `sanitizeContent` (default `true`), `sanitizer`,
  `logWarnings`. `createProductionSecurityMiddleware` blocks injection attempts;
  `createDevelopmentSecurityMiddleware` warns. The default is `'warn'` rather than
  `'block'` because `DEFAULT_INJECTION_PATTERNS` is deliberately broad - it matches
  the bare word `DAN`, so blocking by default would reject innocent prompts.

  **One PII implementation, not two.** `createSecurityMiddleware` delegates to
  `createValidationMiddleware` rather than reimplementing `detectPII` /
  `redactPII` / `detectPromptInjection` / `sanitizeRequest`. The two middleware
  are now preset vs. knobs: security is a small, safe-by-default, security-only
  surface; validation keeps the full configuration (message and token limits,
  allowed models, moderation callbacks, `piiAction: 'block' | 'warn'`). Security
  deliberately does _not_ inherit validation's data-quality rules - an empty
  message is not a security failure.

  **Redaction is recorded, not silent.** When redaction changes content, a
  `content-redacted` `IRWarning` naming the PII types found is appended to
  `request.metadata.warnings`. `WarningCategory` gains the `'content-redacted'`
  member for it.

  **The header policy.** `Content-Security-Policy`, `Strict-Transport-Security`,
  `X-Frame-Options` and friends are browser _response_ headers; merging them into
  `BackendAdapterConfig.headers` would send them upstream to a provider API, where
  they mean nothing. They are still computed, and now have real consumers:
  - `buildSecurityHeaders(config)` - exported pure function, for
    `createCoreHandler({ bridge, headers: buildSecurityHeaders() })`, which does
    apply them to HTTP responses.
  - `getSecurityHeaders(request)` - exported reader for the metadata key, which is
    still written under `SECURITY_HEADERS_METADATA_KEY` for back-compat.

  Also adds `ValidationConfig.injectionAction` (`'block'` default - existing
  behaviour unchanged - plus `'warn' | 'log' | 'ignore'`), mirroring `piiAction`,
  and `ValidationConfig.logPrefix` so console output names the middleware that
  produced it.

  **Behavioural change.** A `createSecurityMiddleware` that previously passed
  everything through now mutates the request by default. That is why this is a
  `minor` rather than a `patch`: on a 0.x package a minor is the breaking-change
  bump, and this changes what an existing registration does. Pass
  `redactPII: false, sanitizeContent: false, promptInjectionAction: 'ignore'` to
  restore the old pass-through behaviour, though at that point the middleware only
  computes a header policy.

  Tests: 1667 -> 1709 passing; 42 new in `tests/unit/security-middleware.test.ts`,
  including the issue's reproduction on both `chat()` and `chatStream()`, which
  fails against the previous implementation.

### Patch Changes

- 30629d4: Fix `MiddlewareContext.backend` and `.backendName` being documented but never populated.

  Both fields were declared and documented - "backend that will process (or processed) the
  request, available after routing decision" - and were `undefined` on every path, for every
  backend type. The bridge simply never set them.

  The cost is bigger than a missing field: **a middleware could not execute a turn of its
  own**, which rules out the whole class of middleware that needs a second pass - an agentic
  tool loop, retry with a modified request, failover. Middleware written against the
  documented type reads `context.backend` and guards with `if (!backend) …`; through a real
  `Bridge` that guard always fired. One consumer hit exactly this: the tool ran, the model
  never saw the result, and stripping the tool-call syntax left the user with an empty reply.
  Unit tests passed because a hand-built context had `backend` set, which is what the type
  invites. Middleware that merely _branches_ on `backendName` was hit more quietly - it took
  its fallback path every time, with no error.

  `Bridge` now populates both fields on all four paths (`chat`, `chatStream`, `executeIR`,
  `executeIRStream`), through new optional `backend` parameters on `createMiddlewareContext`
  and `createStreamingMiddlewareContext`.

  **Which backend they name.** The fields are seeded before the chain runs and narrowed once
  the routing decision resolves:
  - Before dispatch they are whatever the bridge is about to call. For a router-backed bridge
    that is the router, because the provider genuinely has not been chosen yet - and it is
    the useful value there, since executing through the router routes an extra turn the same
    way the original request was routed.
  - After a response comes back they are narrowed to the backend that actually served it,
    read from the response provenance the backend reports, with `backend` resolved through
    the router's registry so `backendName` always equals `backend.metadata.name`. On the
    streaming path the narrowing happens off the `start` chunk, early enough that the
    response phase of every middleware sees it.

  That is what "available after routing decision" describes, and it means a follow-up turn
  taken after `next()` goes to the backend that just answered - usually what a follow-up
  wants. To re-route deliberately, execute through `bridge.getRouter()` instead. Narrowing is
  driven from the bridge's innermost dispatch, so a middleware that calls `next()` more than
  once sees the value for its most recent dispatch rather than a stale one.

  Predicting the selected backend _before_ dispatch was considered and rejected: `Router`
  has no access to the middleware context (`BackendAdapter.execute()` takes only a request),
  and calling `Router.selectBackend()` up front would advance round-robin and re-roll random
  selection, so the context could name a backend other than the one that answered. Naming
  the router until the answer is known is honest; guessing is not.

  `backend` and `backendName` are no longer `readonly` on `MiddlewareContext`, since they are
  refined in place as the decision resolves. Dropping `readonly` does not affect assignability,
  so no existing implementation of the interface breaks.

  `createFailoverMiddleware()` in `@johnhenry/aimatey-patterns` is **not** affected: it takes
  its fallback adapters through `FailoverConfig.fallbacks` and never reads `context.backend`.
  It was already working, and keeps working.

- 582a4e5: Router: `clone()` keeps translation mappings, stats and circuit-breaker state (#58)

  `Router.clone()` copied `modelMapping`, `modelPatterns` and `fallbackChain` but
  not `modelTranslationMapping` or `backendTranslationMappings` — exactly the
  configuration that makes cross-provider fallback produce a valid request. A
  cloned router would fall back to a backend and send it a model name it had
  never heard of. Both are now copied, as independent maps.

  `clone()` also re-`register`ed each adapter, so every backend started fresh:
  request counts, latency samples and `totalCost` zeroed, and any **open circuit
  breaker silently closed**. Since `clone({ … })` reads like "same router,
  different config", cloning to change one option quietly re-armed a backend the
  breaker had just taken out of rotation.

  A clone is now documented, and implemented, as _this router with different
  settings_. It inherits:
  - **Routing configuration** — backend registrations in the same order, sharing
    the same adapter instances, plus the fallback chain, model mappings, model
    patterns, and the global and per-backend model translation mappings.
  - **Routing state** — the round-robin cursor, so a clone continues the rotation
    rather than restarting it.
  - **Accounting** — router-level and per-backend request counts, latency samples
    and `totalCost`, on the same reasoning as `replace()`: a cumulative record of
    traffic really sent and money really spent, which a configuration change does
    not un-spend.
  - **Health verdict** — `isHealthy`, `lastHealthCheck`, `consecutiveFailures`
    and the circuit-breaker state.

  That last point is where `clone()` deliberately differs from `replace()`, which
  _resets_ the health verdict. Both follow the same underlying rule: a health
  verdict survives exactly as long as the thing it judged. `replace()` swaps in a
  different adapter, so the verdict is stale by construction. `clone()` carries
  the _same adapter instances_ across, so an open circuit is still an accurate
  statement about them — and silently re-arming a backend the breaker had just
  removed, merely because the caller cloned to change an unrelated setting, is
  the more dangerous default.

  One exception: a clone that turns the circuit breaker **off** starts with every
  circuit closed. Nothing in such a router calls the breaker, so an inherited open
  circuit would never move back to half-open and the backend would be unroutable
  forever.

  Callers who want a genuinely fresh slate can follow the clone with
  `resetStats()` and `resetCircuitBreaker()`.

  Tests: `tests/unit/router-clone.test.ts` (16 cases).

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

> Previously published as `ai.matey.types`, last unscoped version `0.5.1`.

## 0.5.1

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
