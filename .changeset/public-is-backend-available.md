---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-core': minor
---

Make `Router.isBackendAvailable()` public (#134).

`isBackendAvailable(name)` was `private` while `isCircuitBreakerOpen(name)` was public, so a
caller wanting to pre-flight "will this actually go where I asked?" could see the circuit half
of the predicate but not the health half, and had to approximate the rest:

```ts
// what was reachable                    // what routing actually asks
!router.isCircuitBreakerOpen(name)       state.isHealthy && state.circuitBreakerState !== 'open'
```

A backend that failed its last health check is unhealthy and will not be routed to even though
its circuit is closed, so the approximation is wrong in exactly the case a caller cares about.

The method is now public on the `Router` class and declared on the `Router` interface in
`@johnhenry/aimatey-types`. Behaviour is unchanged — this only widens visibility.
