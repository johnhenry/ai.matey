---
'@johnhenry/aimatey-core': patch
'@johnhenry/aimatey-types': patch
---

Fix `RequestOptions.backend` being silently ignored, so a request that explicitly asks for
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

- Only *unregistered* names are rejected. A backend that is registered but currently
  unhealthy or has an open circuit breaker is still handled by the router's fallback -
  that is what fallback is for.
- Only the `options.backend` channel is affected. It was previously inert, so nothing can
  depend on its old behaviour. The lenient `metadata.custom.backend` channel is unchanged,
  to avoid breaking callers that rely on it under a non-`explicit` routing strategy.
- On a bridge whose backend is a single adapter rather than a router there is no routing
  to override, so the option stays inert rather than throwing.

Also documents the contract on `RequestOptions.backend`, and adds the previously
undocumented `options` parameter of `chat()` / `chatStream()` to the Bridge API reference.
