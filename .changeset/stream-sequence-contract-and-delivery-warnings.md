---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-utils': minor
'@johnhenry/aimatey-core': patch
'@johnhenry/aimatey-backend': patch
'@johnhenry/aimatey-backend-browser': patch
'@johnhenry/aimatey-native-apple': patch
'@johnhenry/aimatey-native-model-runner': patch
'@johnhenry/aimatey-native-node-llamacpp': patch
---

Give `sequence` a contract and make every adapter keep it, and let a warning say the
delivery was degraded rather than the translation (#120, #123, #131).

## `sequence` had no contract, and 27 adapters broke the one it turned out to have

`BaseStreamChunk.sequence` shipped with no doc comment at all. Nothing said whether it
starts at 0, whether it increments by one, whether a `metadata` chunk between two `content`
chunks consumes a number, or what a consumer should do on a gap. In-process none of that
matters: an async generator cannot drop or reorder its own yields, so the field is
decoration. Across a wire it is the only loss-detection primitive the IR has, and a gap can
only mean loss if a gap is illegal.

It is now documented as **monotonic and contiguous from 0, across all chunk types of one
stream**. That is not a new rule -- it is the rule `validateChunkSequence()` and
`validateStream()` in `@johnhenry/aimatey-utils` have always enforced. It was simply never
written down, so nothing checked that the library's own adapters obeyed it.

They did not. Every streaming adapter emitted its terminal `error` chunk from a `catch` that
could not see the counter, so it hardcoded `sequence: 0`:

```ts
} catch (error) {
  yield { type: 'error', sequence: 0, ... };   // after 40 content chunks
}
```

A provider failing part-way through a generation therefore produced `0, 1, 2, … 40, 0` --
a duplicate and a decrease in the one place a consumer most needs to trust the numbering.
Passed through this repo's own strict `validateStream()`, that stream throws
`Out-of-order chunk: sequence 0 after 41`, replacing the provider's real error with a
validator artefact. A consumer using `sequence` to detect a severed connection sees a reset
instead.

Fixed in all 27 emitters -- 22 HTTP providers, `chrome-ai`, `litert-lm`, `native-apple`,
`native-model-runner` and `native-node-llamacpp` -- by hoisting the counter above the `try`.
`native-model-runner`, which delegates with `yield*`, now tracks the delegated stream's
numbering so its own terminal chunk continues it.

`Router.executeStream` had the same fault twice over. Its synthesized error chunk was
numbered 0 after it had already delivered a committed stream's chunks; and a *backend's*
error chunk was forwarded with the number the backend gave it, even though the router may
have withheld that backend's preamble or failed over from it -- opening a stream at
`sequence: 3` with nothing before it. The terminal chunk is now renumbered onto the stream
the consumer actually received.

## `WarningCategory` could not say a turn was served badly

All thirteen existing members describe a **translation** problem: a parameter normalized or
clamped, a capability missing, content redacted, a model substituted. Coherent, and with no
room for a turn that was translated faithfully and then *delivered* badly. The only thing to
reach for was `capability-unsupported`, which says the backend could not do what was asked
-- a different claim, and one that stops carrying information after a few stretches.

Three additive members, and a factory for each in `@johnhenry/aimatey-utils`:

- **`request-queued`** -- a store-and-forward transport held the request and ran it later.
  `createRequestQueuedWarning(queuedMs, source)`; the wait goes in `details`, because a
  caller that has already shown a spinner needs the elapsed time and not just the fact.
- **`transport-degraded`** -- the link degraded the turn: a stream that reconnected
  mid-response, a re-send after a transport failure, a hop an order of magnitude slower than
  the same request served locally. `createTransportDegradedWarning(reason, { details, source })`.
- **`provenance-lost`** -- a response arrived where the receiver had reason to expect
  `IRMetadata.provenance` and there was none. `createProvenanceLostWarning(expectedFrom, source)`.

The last one closes a gap that only exists across a wire. `provenance` is optional, so
`undefined` means both "the chain recorded nothing" and "the chain recorded something and
the trip ate it" -- dropped by a transport, a re-serialization, or a hop that rebuilt
`metadata` without spreading the old one. In one process the second never happens; across a
boundary it is the difference between "we do not know where this ran" and "something ate the
answer", and an application whose rule is that unknown provenance renders as *no* trust label
needs "unknown" to stay rare and honest.

It is the **receiving hop's claim about what it expected**, never an inference by a walker
and never attached by an adapter that had no such expectation -- so an absent provenance
carrying no `provenance-lost` warning still means "not recorded", exactly as before.

Adding members to a union is additive for producers. Consumers that switch exhaustively on
`WarningCategory` will need the usual new-member arms.
