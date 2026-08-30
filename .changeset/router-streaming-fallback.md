---
'@johnhenry/aimatey-core': patch
---

Router: fail streamed requests over, and record their outcome (#54)

`Router.executeStream()` never failed over. Where `execute()` called
`executeFallback()`, the streaming path yielded an error chunk, so
`fallbackStrategy`, `setFallbackChain()` and `customFallback` were all inert
for streaming — the normal path for a chat app.

It now fails over, bounded by what the consumer has already seen. Once model
output has been handed over, no other backend can take the stream: restarting
would duplicate or contradict text the user is already reading, so a failure
from that point still surfaces as an `error` chunk. Before that point nothing
is observable, so chunks that carry no model output (`start`, `metadata`) are
held back and flushed the instant the first `content`, `tool_use` or `done`
chunk arrives. The buffer never waits on a timer or a chunk count, so it adds
nothing to time-to-first-token; it only defers chunks a consumer cannot render
anyway. A backend that dies mid-preamble is replaced without the caller ever
learning it existed. An `error` chunk that arrives before the stream has
committed is treated exactly like a thrown error.

Three consequences worth knowing:

- Streaming fallback is always **sequential**, including under
  `fallbackStrategy: 'parallel'`. Racing streams would start N generations and
  abandon N-1 — billable output for no latency gain, since a stream can only be
  moved before its first token anyway.
- An **aborted** request is never failed over: the caller asked to stop, not
  for a different backend.
- At most 32 preamble chunks are held. A backend that emits more than that
  before its first token is malformed; rather than buffer without bound the
  router flushes, gives up the option to fail over, and streams through.

`executeStreamOnBackend()` also counted a request without ever recording its
outcome — `successfulRequests`, `failedRequests` and `latencies` were never
touched and the circuit breaker was never consulted. So `successRate` decayed
toward zero for any backend serving streamed traffic, the breaker never tripped
on streaming failures nor reset on streaming successes, and latency-optimised
routing was blind to streaming.

The returned stream is now wrapped so its outcome reaches the same
`recordSuccess` / `recordFailure` the non-streaming path uses (both extracted
from `executeOnBackend`, whose behaviour is unchanged):

- **Success** — a `done` chunk is seen, or the backend's iterator finishes
  without one. Counts a success, breaks the consecutive-failure run, takes a
  latency sample and accrues cost, and closes a half-open circuit.
- **Failure** — the iterator throws, or yields an in-band `error` chunk. Counts
  a failure and may trip the breaker.
- **Abandoned** — the consumer stops reading (`break`, `return()`, `throw()`,
  or an aborted request). Counted as a completed request without fault, because
  cancelling a stream must never be able to trip a circuit breaker on a backend
  that did nothing wrong. It contributes no latency sample and no cost estimate,
  and deliberately leaves `consecutiveFailures` and the breaker state untouched:
  a stream the consumer walked away from is not evidence that a suspect backend
  has recovered.

The latency sample for a stream is full-response wall time — the same quantity
`execute()` measures — so `averageLatencyMs` stays coherent for a backend
serving both kinds of traffic. Time-to-first-token is a different, also useful
metric; it would need its own field rather than being mixed into this one.

`totalRequests` is now counted when the stream is first iterated rather than
when it is created, so a stream that is created and discarded is not counted as
sent. It was already counted after the circuit-breaker check, so a request the
breaker refuses is still not counted.

Tests: `tests/unit/router-streaming-fallback.test.ts` (24 cases).
