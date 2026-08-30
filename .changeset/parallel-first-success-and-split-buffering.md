---
'@johnhenry/aimatey-core': patch
'@johnhenry/aimatey-utils': patch
---

Document two concurrency fixes that changed observable behaviour without a changelog entry,
and pin both with tests that do not depend on timing (#36, #37).

The code fixes landed in #45 but carried no changeset, so they were on course to be
published as silent behaviour changes. Both alter what a caller observes, so both are
recorded here.

**`Router` "first success" parallel dispatch no longer settles on the first *failure*
(#36).** `dispatchParallel({ strategy: 'first' })` awaited `Promise.race()` over per-backend
promises that are wrapped to always fulfill - carrying `{ success: false, error }` when the
backend threw - so the race returned whichever backend *settled* first regardless of
outcome. A backend that failed fast decided the result, and the dispatch threw
`ALL_BACKENDS_FAILED` while a slower backend was still in flight and about to succeed.
`fallbackParallel()` had the same defect through `Promise.race()` over the raw rejecting
promises. That is the exact inverse of what "first success" promises, and it bit hardest in
the case the strategy exists for: a fast-failing cheap backend paired with a slower reliable
one.

Both now race on fulfilment. `fallbackParallel()` uses `Promise.any()`; `dispatchParallel()`
uses a `raceFirstSuccess()` helper, because its legs never reject and `Promise.any()` cannot
see the `success` flag. `ALL_BACKENDS_FAILED` is now raised only once *every* backend has
failed, and names all of them rather than just the first to give up.

What changes for callers: a parallel dispatch that used to fail can now succeed, and one
that fails takes as long as its slowest backend rather than its fastest. Anything relying on
a parallel dispatch failing fast will see it wait. `cancelOnFirstSuccess` still aborts the
losing backends, but only on an actual success - a failure no longer cancels the field.

**`splitStream()` no longer drops chunks produced before a split starts iterating (#37).**
Each consumer's resolver defaulted to a no-op function. The eager producer treats a non-null
resolver as "a consumer is parked waiting", so it handed chunks to that no-op and shifted
them off the queue before any real consumer had begun. A split that started iterating even
slightly late silently lost its prefix and then ended cleanly, so the loss looked like a
short stream rather than an error. The sibling `teeStream()` had it right, defaulting to
`null`; `splitStream()` now matches.

The semantics this implies are now stated on the function rather than left to be discovered:
**a split that subscribes late receives buffered history back to the stream's first chunk.**
Splits are not live subscriptions. Draining one split fully before touching another is well
defined and both see identical sequences. The alternative - treating a late first `next()` as
an error - was rejected because a split exists to fan out to consumers whose start times the
caller does not control, and there is no subscribe step to hook, only a first `next()`. The
documented cost is memory: unread chunks are retained per split, so a split that is never
iterated pins the whole stream.

A dead `chunks` accumulator that appended every chunk and was never read has been removed
alongside, so retention now matches what the documentation describes.

Patch rather than minor in both cases: no API, option or type changed, and each is a bug fix
restoring the behaviour the existing names and docs already promised.
