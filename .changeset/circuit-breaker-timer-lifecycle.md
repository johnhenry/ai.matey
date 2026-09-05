---
'@johnhenry/aimatey-core': patch
---

Cancel a circuit breaker's pending half-open transition when the breaker it belongs to goes away.

`Router.openCircuitBreaker()` schedules the `open -> half-open` transition with a `setTimeout`
and then dropped the handle on the floor. Nothing held it, so nothing could cancel it, and the
timer outlived both the open it was scheduled for and, in one case, the backend it named.

## A rest period could be cut short by a timer from an earlier one

The scheduled callback carries no record of which open it belongs to. It half-opens whatever
open the breaker happens to be in when it arrives:

```ts
router.openCircuitBreaker('peer');   // t=0    rest until t=30s
router.openCircuitBreaker('peer');   // t=20s  rest until t=50s
                                     // t=30s  the t=0 timer fires -> half-open
```

The second rest period was configured for 30 seconds and lasted 10. A half-open breaker is not
refused by `checkCircuitBreaker`, so a trial request reaches a backend 20 seconds before the
caller said it should — on a backend that is, by the router's own accounting, still failing.

The same shape reaches the two lifecycle methods that close a breaker as part of their contract:

- `closeCircuitBreaker()` / `resetCircuitBreaker()` left the transition armed, so a breaker
  closed by hand and later reopened inherited the old timer.
- `replace()` documents that it resets the health verdict precisely so a breaker tripped by an
  expired credential cannot keep refusing the new, working one. It reset the verdict and left
  the old verdict's timer running — so if the replacement backend then failed too, its rest
  period was the one cut short.

## A transition could outlive its backend

`unregister()` deleted the map entry and left the timer armed. Until it expired, the callback
held the removed `BackendState` — and through it the adapter — keeping both reachable after the
router had dropped them, and keeping the host's event loop alive on a backend that no longer
exists. For a caller unregistering a backend in order to revoke it, the last reference to the
revoked adapter survived the revocation by up to `circuitBreakerTimeout`.

## The rule

A breaker that stops being the open breaker a timer was scheduled for cancels that timer:
`openCircuitBreaker` (cancels the earlier one before arming its own), `closeCircuitBreaker`,
`resetCircuitBreaker`, `replace` and `unregister`.

No signature, type or configuration changes. The normal path is unchanged: a breaker left alone
still half-opens exactly `circuitBreakerTimeout` after it opened.
