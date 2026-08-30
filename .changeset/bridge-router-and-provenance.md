---
'@johnhenry/aimatey-core': patch
---

Fix a router-backed `Bridge` being unobservable: `getRouter()` always returned `null`, and
`enrichResponse()` overwrote which backend actually answered.

**`Bridge.getRouter()` now returns the router.** It was hardcoded to `return null`, with a
return type of the literal `null` rather than `Router | null` - so even the type said it
could never work, while the `Bridge` interface in `@johnhenry/aimatey-types` had promised
`Router | null` all along. There was no supported way to reach the router a bridge was
constructed with: no inspecting `listBackends()`, no reading `getBackendInfo()`, no
adjusting a fallback chain through the object you were handed. It now returns the
configured backend when that backend is a `Router`, and `null` otherwise. The check is
structural rather than an `instanceof`, so consumers do not pull the `Router`
implementation in at runtime just to ask the question - this is the same duck-typing the
private `asRouter()` added in #51 was doing, and that helper has been folded into
`getRouter()` so there is one answer to the question instead of two.

**Response provenance now names the backend that answered.** `enrichResponse()` set
`provenance.backend` to `this.backend.metadata.name` unconditionally. For a router-backed
bridge `this.backend` *is* the router, so every response claimed `"router"`, discarding
what the backend adapter had already written. For a multi-provider router - the case this
library exists for - that field was always wrong, which matters for cost attribution, for
debugging a bad answer, and for any UI showing where a reply came from.

The precedence rule is now:

- `provenance.frontend` is always the bridge's frontend adapter. The bridge knows this for
  certain.
- `provenance.backend` keeps whatever the chain already reported, and only falls back to
  the bridge's own backend name when the adapter reported none. Every shipped backend
  adapter reports one, so in practice the routed backend wins.
- `provenance.router` is set to the router's name on a router-backed bridge, using the
  field that already exists for it. The routing layer stays visible without overwriting
  the backend, so nothing that was learnable from the old (wrong) value is lost.

**The streaming path now reports provenance too.** `chatStream()` and `executeIRStream()`
applied no provenance at all, so the two paths disagreed about the same request:
`chat()` always reported some backend while `chatStream()` reported only what the backend
volunteered. The same rule is now applied to a stream's `start` chunk - the chunk backends
carry response metadata on. Other chunks pass through untouched, and a `start` chunk
carrying no metadata at all is left alone rather than given a fabricated one.

Released as a patch: this is a bug fix in every direction. The widened `getRouter()` return
type only brings the class in line with the `Bridge` interface it implements, which already
declared `Router | null`, so no published type narrows and `@johnhenry/aimatey-types` is
untouched. Callers reading `provenance.backend` on a single-adapter bridge see exactly what
they saw before.
