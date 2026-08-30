---
'@johnhenry/aimatey-core': minor
'@johnhenry/aimatey-types': minor
---

Make a registered router backend reconfigurable: add `Router.replace()` and stop `unregister()`
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

Swaps the adapter behind an existing name and keeps everything that refers to that backend *by
name*: registration order, the fallback chain, model mappings, model patterns, and
backend-specific translation mappings. An unregister/register round trip loses all of that, which
is why it is not a substitute.

`register()` deliberately stays strict rather than becoming an upsert — a duplicate name is almost
always a double-initialization bug, and silently swapping the adapter would hide it. `replace()`
correspondingly throws `ROUTING_FAILED` for a name that is *not* registered; callers who want
upsert semantics can write `router.has(n) ? router.replace(n, a) : router.register(n, a)`.

State handling across a `replace()` is split deliberately:

- **Carried over** — `totalRequests`, `successfulRequests`, `failedRequests`, `latencies`,
  `totalCost`. These are a cumulative accounting record of traffic sent to this logical backend.
  Zeroing `totalCost` on a credential change would silently corrupt spend tracking.
- **Reset** — `isHealthy`, `circuitBreakerState`, `consecutiveFailures`, `circuitOpenedAt`,
  `lastHealthCheck`. These are a live judgement about a configuration that no longer exists.
  Keeping them would defeat the motivating use case: an expired key trips the circuit breaker, and
  a breaker left open would keep refusing the *new*, working key until `circuitBreakerTimeout`
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
  later `register()` of a *different* adapter under the same name silently inherited the removed
  backend's routing rules and translation mappings.
- Unregistering a name that is not registered still throws `ROUTING_FAILED`.

**Also new:** the `routing-config-changed` `WarningCategory` in `@johnhenry/aimatey-types`, for
warnings about the router rewriting its own configuration (there is no request to attach these to,
so `onWarning` is the only channel).

Compatibility: removing a thrown error is not a breaking change for correct callers, but code that
relied on `unregister()` throwing for the default or last backend will now see it succeed. Adding
`replace()` to the `Router` interface is a breaking change only for third-party classes that
`implement Router` directly.
