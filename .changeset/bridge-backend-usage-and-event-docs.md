---
'@johnhenry/aimatey-core': patch
---

Fix `Bridge.getStats().backendUsage` attributing every success to the wrapper, and delete
the `on()`/`once()` docs that denied events are emitted.

**`backendUsage` now names the backend that actually served each request.** It was derived
at read time as `{ [this.backend.metadata.name]: this._successfulRequests }`. `this.backend`
is whatever the bridge was constructed with, so on a router-backed bridge that is the
*router*: four requests round-robined across two registered backends reported
`{ router: 4 }` instead of `{ cheap: 2, expensive: 2 }`. Per-backend usage - the only thing
the field exists to report - was unobservable, and the workaround was to tally provenance
by hand outside the bridge, which is what the round-robin example in the docs does.

The count is now accumulated as requests succeed, keyed by the backend named in the
response's resolved `provenance.backend`. That is the value #57 made report the adapter
that answered rather than the bridge's wrapper, so this fix consumes that precedence rule
rather than restating it: whatever the chain reported wins, and the bridge's own backend
name is the fallback only when the adapter reported none. A router-backed bridge starts
telling the truth; a single-backend bridge reports exactly what it always did.

**The streaming path is fixed with it.** `chatStream()` increments the same success counter
`chat()` does, so it was already contributing to `backendUsage` - all of it filed under the
wrapper. Leaving it alone would have dropped streamed requests from the breakdown entirely.
It now reports the backend named on the stream's enriched `start` chunk, read before the
frontend conversion that discards IR metadata, so the two paths agree about who served a
request and the per-backend counts sum to `successfulRequests`.

`resetStats()` clears the breakdown along with the other counters.

Two consequences worth stating. A backend that has served nothing since the last reset now
has no key at all, where a fresh single-backend bridge previously reported its one backend
with a count of `0`; a zero for a backend that never ran is the same class of falsehood
being fixed here. And `backendUsage` now agrees with `provenance.backend` for an adapter
whose reported name differs from its registered one, rather than with the bridge's
configured name. Semantics are otherwise unchanged: it still counts successes only, so a
failed request remains in `failedRequests` and `errorBreakdown`.

**`on()` and `once()` no longer claim events are unimplemented.** Both carried
"Event emission is not yet implemented. Listeners are stored for future use when event
emission is added." Emission has been implemented for some time - `emit()` is called from
seven sites. The note told anyone reading the JSDoc that the feature in front of them did
not work, so the reasonable response was to go build a wrapper instead of using it.

Replaced with what actually happens: six `BridgeEventType` values are emitted -
`request:start`, `request:success` and `request:error` from `chat()`, and `stream:start`,
`stream:complete` and `stream:error` from `chatStream()` - while `request:cancelled`,
`stream:chunk`, `backend:selected`, `backend:failover` and `middleware:executed` are
declared on the type but nothing emits them, so a listener for one of those never fires.
The docs also now state that `executeIR()`/`executeIRStream()` are deliberately silent, and
that a listener which throws is swallowed rather than failing the request. Tests pin each
of those claims, so the docs cannot silently go stale again.

Docs only for the second half - no behaviour changed there.
