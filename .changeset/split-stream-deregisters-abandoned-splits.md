---
'@johnhenry/aimatey-utils': minor
---

Give `splitStream` a working reference count so an abandoned split stops leaking (#102).

## The count never counted

```ts
const activeConsumers = consumerCount; // never reassigned
// ...
while (activeConsumers > 0) {          // invariant
```

Because `activeConsumers` was a `const`, `while (activeConsumers > 0)` was `while (true)`
whenever `consumerCount > 0`, and the loop's real exit was the `break` on `streamDone`
below it. The dead condition was the visible half of the problem; the missing decrement was
the costly one.

There was no deregistration path at all. A split that stopped iterating early -- `break` out
of a `for await`, an early `return`, a throw in the consuming loop -- stayed in `consumers`
forever, and the producer kept appending every subsequent chunk to a queue nothing would
ever drain:

```ts
for (const consumer of consumers) {
  consumer.queue.push(chunk); // unconditional
```

On a long stream with one abandoned split that grows without bound.

## What changed

`activeConsumers` is now a real `let`, decremented in a `finally` inside each split's
generator. A generator's `finally` runs on every way out -- completion, `break`, `return`,
and throw -- which is exactly the deregistration hook that was missing. On deregistration a
split's queue is dropped and the producer stops enqueuing for it. Once every split has
finalised the producer stops pulling from the source entirely, which is safe because an
async generator that has completed cannot be read again.

The consumer loop is now `while (true)` with explicit exits, matching `teeStream`. A split
must not stop because its *siblings* left -- it still owes its own buffered chunks -- so the
reference count is read only by the producer.

| scenario | before | after |
| --- | --- | --- |
| one split `break`s early, sibling still reading | abandoned queue grows for the rest of the stream | abandoned split deregisters; sibling unaffected |
| every split `break`s early | source drained to completion into dead queues | producer stops pulling |
| a split never starts iterating | receives full buffered history | receives full buffered history (unchanged) |

The last row is deliberate: the late-subscriber contract from #37 is untouched. A split that
has not started yet has not finalised, so it is still counted as active and is still owed
every chunk.

## Why this is `minor`, not `patch`

The source is no longer necessarily drained to completion. Anything relying on
`splitStream` as a way to force an upstream stream to run to its end -- for side effects,
say -- while abandoning all of its splits will now see the source stop early. That is the
intended fix, but it is an observable change, and on 0.x `minor` is the channel for one.
