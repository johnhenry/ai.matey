---
'@johnhenry/aimatey-core': patch
---

Fix `next()` called twice skipping the rest of the middleware chain.

`MiddlewareStack.execute()` and `executeStream()` composed the chain with a
single mutable `index` captured in the `next` closure, so a second `next()`
advanced *past* the next middleware instead of re-running the remainder of the
chain:

```ts
bridge.use(async (ctx, next) => {
  await next();
  return next();          // a retry
});
bridge.use(async (ctx, next) => next());   // ran once for two next() calls
```

The second call went straight to the backend, so retry-shaped middleware
retried with the unvalidated, untransformed request - the second attempt took a
different code path from the first, silently, unless the retry happened to be
registered last.

Both paths now dispatch by recursion with the index as a parameter, so every
`next()` re-enters at its own position and re-runs the whole remainder of the
chain, in order, once per call.

`next()` is deliberately left **re-entrant** rather than guarded the way Koa
guards it. Koa throws on a second `next()` within one middleware; here
retry-shaped middleware is a first-class pattern and a retry must re-run the
validation, redaction and transform middleware registered after it, or the
second attempt reaches the backend with a differently-prepared request.
Re-running is not free of side effects - every downstream middleware runs
again, `context` is shared rather than snapshotted, and nothing bounds the
number of passes - and that is now documented on `execute()`, `executeStream()`
and in `docs/api.md`.

The one place a second `next()` is still refused is the streaming adapter added
in #46/#50: once a standard middleware's first `next()` has handed a stream to
the consumer, the chunks are already delivered and no restart could reach the
consumer, so `adaptMiddlewareToStreaming` throws a `MiddlewareError` rather than
start a stream nobody can read. A `next()` that *failed* before any chunk was
delivered is still retryable there, and such a retry now re-runs the whole
downstream chain instead of skipping the middleware next to it. Stream-native
middleware registered with `useStreaming()` owns the `IRChatStream` itself and
may call `next()` as often as it likes.

Error handling is unchanged: the innermost frame wraps a non-`MiddlewareError`
into a `MiddlewareError`, outer frames re-throw it as-is, and the final handler
is still called outside the `try`.

Fixes #56.
