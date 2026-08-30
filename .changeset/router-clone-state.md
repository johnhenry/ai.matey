---
'@johnhenry/aimatey-core': patch
'@johnhenry/aimatey-types': patch
---

Router: `clone()` keeps translation mappings, stats and circuit-breaker state (#58)

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

A clone is now documented, and implemented, as *this router with different
settings*. It inherits:

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
*resets* the health verdict. Both follow the same underlying rule: a health
verdict survives exactly as long as the thing it judged. `replace()` swaps in a
different adapter, so the verdict is stale by construction. `clone()` carries
the *same adapter instances* across, so an open circuit is still an accurate
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
