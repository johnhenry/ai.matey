---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-errors': minor
'@johnhenry/aimatey-core': minor
'@johnhenry/aimatey-middleware': patch
---

Classify `isRetryable` the same way everywhere.

Four sites decided retryability and they disagreed, so the same fault was
transient or permanent depending on which path reached it - and `isRetryable`
is the only thing retry logic keys off.

**`RouterError` derives `ALL_BACKENDS_FAILED` from its leaves, not from its
code.** It asserted `isRetryable: options.code === ALL_BACKENDS_FAILED`, so a
router whose every backend rejected the API key produced a "retryable" error
and the caller burned its whole retry budget on a fault that was permanent at
every leaf. `RouterErrorOptions` gains an optional `backendErrors`, and
retryability is now `true` only when at least one attempted backend failed
retryably - `some`, not `every`, because retrying helps as soon as one leg
could succeed. This is the same principle as the `MiddlewareError` fix: a
composite has no more standing to reclassify its parts than a wrapper has to
reclassify its cause.

**The router builds every `ALL_BACKENDS_FAILED` through `RouterError`.** There
were four construction sites and three answers: `isRetryable: true` in parallel
dispatch and parallel fallback, `false` on the embeddings and sequential
fallback paths, none of them going through `RouterError`, which said `true` for
all of them. All four now go through `RouterError`, which carries the leaf
errors where they exist and derives one answer from them.

**Neither retry implementation retries an unclassified error.** `Bridge`'s
`config.retries` loop treated a non-`AdapterError` as retryable while
`defaultShouldRetry` in `createRetryMiddleware` did not. `Bridge` now agrees
with the middleware: an unclassified throwable is as likely a bug in the
caller's own adapter or middleware as a transient fault, retrying it re-runs
every middleware side effect for something that cannot succeed, and `Bridge`
already wrapped such an error as a non-retryable `INTERNAL_ERROR` on the way
out - so retrying it contradicted the classification it then handed the caller.

**`408 Request Timeout` and `425 Too Early` are retryable.**
`createErrorFromHttpResponse` had explicit branches for 401, 403, 429, 400 and
5xx and fell through to `statusCode >= 500` for everything else, so the two
statuses whose entire meaning is "try again" were marked permanent. `404`,
`409` and `422` were checked and stay non-retryable: an identical retry
reproduces each of them.

Both flags are read duck-typed rather than through `instanceof AdapterError`,
so a second copy of the errors package across the ESM/CJS boundary does not
silently disable retries.

**Behaviour changes.**

- A `RouterError` built with `ALL_BACKENDS_FAILED` and no `backendErrors` is
  now non-retryable. If you construct one yourself and want the old answer,
  pass the failures it composes:

  ```ts
  new RouterError({
    code: ErrorCode.ALL_BACKENDS_FAILED,
    message: 'All backends failed',
    attemptedBackends: ['openai', 'anthropic'],
    backendErrors: [openaiError, anthropicError],   // <- new
  });
  ```

- `bridge.chat()` with `config.retries` no longer retries a backend failure
  that is not an `AdapterError` (or does not carry `isRetryable: true`). A
  backend that wants its failures retried should raise a classified error -
  `NetworkError`, `RateLimitError`, or an `AdapterError` with
  `isRetryable: true`.

- The router's `ALL_BACKENDS_FAILED` errors are now `RouterError` instances
  rather than bare `AdapterError`s. `RouterError extends AdapterError` and the
  `code` is unchanged, so `instanceof AdapterError` and `error.code` checks are
  unaffected; only a check on `error.name === 'AdapterError'` would notice.
