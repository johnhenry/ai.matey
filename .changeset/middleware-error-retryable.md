---
'@johnhenry/aimatey-errors': patch
'@johnhenry/aimatey-core': minor
---

Stop middleware from reclassifying the errors it carries.

`MiddlewareStack` re-labelled *every* failure that passed through a middleware
as a `MiddlewareError`, and `MiddlewareError` hard-coded `isRetryable: false`.
A retryable `NetworkError` raised by the backend therefore reached the retry
middleware already reclassified as permanent, and `createRetryMiddleware`
stopped retrying as soon as any middleware was registered after it:

```ts
bridge.use(createRetryMiddleware({ maxAttempts: 3 }));
bridge.use(someOtherMiddleware);   // <- retry now gives up after one attempt
```

Retry configuration looked applied and was not; whether it worked depended
purely on registration order. The same loss of classification reached
everything downstream - `Bridge`'s own `config.retries` loop, `Router`'s
`customFallback`, the HTTP status mapping (a backend `NetworkError` answered
`500` instead of `502`), and any application-level retry, all of which were
told a transient network failure was permanent.

Two changes:

- **`MiddlewareStack` (`@johnhenry/aimatey-core`)** now wraps only what a
  middleware raised *itself* and left unclassified. An `AdapterError` already
  carries a code, a category and a retryability, so it propagates untouched;
  so does anything the final handler raised, which is a backend failure rather
  than a middleware failure. `MiddlewareError` is an `AdapterError`, so it is
  still re-thrown as-is.
- **`MiddlewareError` (`@johnhenry/aimatey-errors`)** built around a `cause`
  now reports the cause's retryability instead of asserting `false`. Without a
  cause, or with a cause that carries no classification, it stays
  non-retryable.

This also removes a divergence that had nothing to do with retry: with an empty
stack a backend failure propagated raw, and registering a single middleware
turned the same failure into a `MiddlewareError`. The error a caller sees no
longer depends on how many middleware are registered.

**Behaviour change for `@johnhenry/aimatey-core`.** Code that catches
`MiddlewareError` to handle *backend* failures behind a middleware chain now
sees the original error class - `NetworkError`, `RateLimitError`,
`ProviderError` - as it already did with no middleware registered. Catch
`AdapterError` (the common base) or switch on `error.code` instead.
`MiddlewareError` still means what its name says: a middleware itself failed.
