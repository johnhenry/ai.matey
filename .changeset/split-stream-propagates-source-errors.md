---
'@johnhenry/aimatey-utils': minor
---

Propagate a source error out of every `splitStream` split instead of ending them cleanly (#101).

## Truncation looked exactly like completion

The producer that drains the source was `try`/`finally` with no `catch`:

```ts
void (async () => {
  try {
    for await (const chunk of stream) {
      /* distribute */
    }
  } finally {
    streamDone = true;
    // resolve every parked consumer with { done: true }
  }
})();
```

When the source threw, the `finally` still ran, set `streamDone`, and resolved every parked
split with `{ done: true }`. Each split therefore ended **normally**. A caller draining a
split with `for await` could not distinguish a stream that finished from one that was cut
off mid-response, and committed the partial output as though it were whole -- the worst
available failure mode for a streaming API, because it is silent.

Separately, the producer is invoked as `void (async () => { ... })()`. With no `catch` the
rejection had no handler anywhere, so the source error also surfaced as an **unhandled
rejection**; under Node's default `--unhandled-rejections=throw` that terminates the
process. That happened whether or not anything was consuming the splits.

`teeStream`, one function away, already did this correctly -- it captures the error into a
local and rethrows it into each consumer. `splitStream` now follows it:

```ts
} catch (e) {
  sourceError = e instanceof Error ? e : new Error(String(e));
} finally {
  /* ... */
}
```

and each split, having yielded whatever genuinely arrived, throws `sourceError` rather than
returning.

| source behaviour | split before | split after |
| --- | --- | --- |
| completes | ends cleanly | ends cleanly |
| throws after 2 of 5 chunks | yields 2 chunks, **ends cleanly** | yields 2 chunks, **throws** |
| throws, nothing consuming | unhandled rejection | no unhandled rejection |

## Why this is `minor`, not `patch`

This changes observable behaviour. Code that relied on the silent truncation -- treating a
split's clean end as proof of a complete response -- will now see a throw. That reliance was
on a bug rather than a contract, but it is a real behavioural break for such callers, and on
0.x `minor` is the channel that carries one.

The chunks that did arrive are still delivered before the throw, so a caller that wants the
partial output can still collect it; it simply has to acknowledge the failure to do so.
