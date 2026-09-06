---
'@johnhenry/aimatey-core': patch
---

Honour `fallbackStrategy: 'none'` at selection time, not only after a failure (#134).

## The defect

`FallbackStrategy.NONE` is documented as "No fallback - fail immediately if primary backend
fails". A caller pairing it with `routingStrategy: 'explicit'` is asking for one thing: **this
backend, or nothing.** The Router did not deliver that.

`fallbackStrategy` was consulted on every *post-failure* path — `execute()`'s catch,
`executeEmbed()`, `executeFallback()`, `nextStreamFallbackBackend()` — but never inside
`selectBackend()`. So an open circuit took a different route entirely:

```
isBackendAvailable('primary')  ->  false   (circuitBreakerState === 'open')
routeExplicit('primary')       ->  null
// ...falls through to:
// Final fallback: first available backend
if (!selectedBackend) {
  selectedBackend = this.getAvailableBackends()[0] ?? null;   // <- unguarded
}
```

Nothing guarded that branch — not `routingStrategy: 'explicit'`, not `fallbackStrategy:
'none'`. Which backend answered was **registration order**. The request never "failed", so no
failure path ever ran, and the caller was told nothing: `execute()` returned a normal response
and `executeStream()` produced an ordinary `[content, done]` stream.

The distinction the code was drawing is *failure* vs *unavailability*, and the option only
covered the first. From the caller's side both are fallback — the request went somewhere they
did not name. Reported from a privacy-first on-device app, where a turn targeted at a local
model was answered by a cloud provider once the local backend's breaker opened.

## The fix

A named preference that cannot be honoured is a **substitution**, and `'none'` is the opt-out
from substitution:

```ts
const refusesSubstitution =
  this.config.fallbackStrategy === 'none' && preferredBackend !== undefined;

if (!selectedBackend && !refusesSubstitution) { /* first available */ }
```

`selectedBackend` stays null and the existing `NO_BACKEND_AVAILABLE` throw fires — which is
what "fail immediately" already promised. `executeStream()` surfaces it as an error chunk, its
established shape for a failure it cannot fail over.

The guard is limited to a **named** preference. When the caller named nothing there is no
substitution to refuse: that branch is simply how a router without a `defaultBackend` resolves
at all, and suppressing it there would leave a single-backend `'none'` router unable to route
anything — a much larger break than the bug.

## Not changed

Every other `fallbackStrategy` is untouched: with the default `'sequential'` an open circuit
still substitutes at selection time, exactly as before.

`routingStrategy: 'explicit'` still permits the substitution on its own. It reads like a
contradiction, but `routingStrategy` **defaults** to `'explicit'`, so guarding on it would
silently re-aim every router that never configured routing at all, and would reroute those
requests through the post-failure fallback machinery — changing `totalFallbacks` accounting for
successful requests. `fallbackStrategy: 'none'` is the documented opt-out and is what #134 is
about.
