---
'@johnhenry/aimatey-core': patch
---

Fix `Bridge` statistics drifting when a request failed before its execution pipeline ran.

`_totalRequests` is incremented the moment a request arrives, but the work that happens
before the retry loop - `frontend.toIR()`, request enrichment, and the registered-backend
check enrichment performs - threw straight past the failure accounting. `getStats()` then
reported a request that was counted as sent, never counted as failed, and produced no
error event, so a caller computing `successRate` watched it drift downward with no failure
to explain it, and anything listening for `REQUEST_ERROR` never learned the request died.

Both `chat()` and `chatStream()` now run that pre-pipeline work inside the same accounting
the rest of the method uses: `failedRequests` and the error breakdown are incremented, and
a `REQUEST_ERROR` (or `STREAM_ERROR`, on the streaming path) event is emitted. The original
error is re-thrown unchanged, so which error a caller sees is unaffected. When
`frontend.toIR()` itself is what threw there is no IR request to report, so the event
carries a stub with the generated request id and frontend provenance rather than being
dropped.

These are fail-fast programmer errors - a malformed request, an unknown backend name - and
so are rare in a working integration, but they are exactly the errors worth an event while
building one.

`executeIR()` and `executeIRStream()` are deliberately left alone: they do not increment
`totalRequests` either, so nothing skews. `getStats()` and the `REQUEST_*` events count
`chat()` and `chatStream()` calls only, which means a `runTools()` loop reports as the one
request the caller made rather than one per turn. That is now stated on both methods.
