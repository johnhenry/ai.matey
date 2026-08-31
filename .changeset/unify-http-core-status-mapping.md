---
'@johnhenry/aimatey-http-core': minor
---

Give `http.core` one error-to-status mapper instead of two that disagreed (#105).

## Two mappers, same package, different answers

`handler.ts` and `error-handler.ts` each carried their own mapper, and they disagreed using
a character-for-character identical predicate:

```ts
// handler.ts:507
if (message.includes('timeout')) return 408;
// error-handler.ts:132
if (message.includes('timeout')) return 504;
```

Which status a caller saw for the same underlying timeout depended only on which code path
handled it.

## The divergence was wider than the timeout

Measuring both paths before the fix found eight disagreements, not one. `CoreHTTPHandler`'s
private copy sniffed message text and ignored the typed error taxonomy **entirely**:

| input | handler.ts | error-handler.ts | now |
| --- | --- | --- | --- |
| message `timeout` | 408 | 504 | **504** |
| message `conflict` | 409 | 500 | **409** |
| message `validation` | 400 | 500 | **400** |
| message `too large` | 500 | 413 | **413** |
| `RateLimitError` | 500 | 429 | **429** |
| `NetworkError` | 500 | 502 | **502** |
| `ProviderError` | 500 | 503 | **503** |
| `ValidationError` | 500 | 400 | **400** |

A rate limit surfacing through the handler path was reported as a generic 500 rather than a
429, so a client could not tell it to back off. That is the more consequential half of this
issue, and it was not visible from the reported symptom.

## What changed

The mapper moved to a new `status-mapping.ts` that both files import -- one implementation,
not two copies that can drift again. `error-handler.ts` re-exports `getHTTPStatusCode`, so
the package's public API is unchanged, and `handler.ts`'s private duplicate is deleted.

The unified mapper is the **union** of the two, so unifying dropped nothing: `conflict` and
`validation` came from the handler's copy, `too large` and the typed taxonomy from the
shared one.

Timeout resolves to **504**. 408 says the client was too slow; 504 says an upstream was.
This library proxies to a provider, so a timeout it observes is a gateway timeout.

## Retry behaviour did not diverge

Worth stating because the issue raised it: no retry path keys off either status. The only
status-driven retry predicate is `isRetryableStatusCode` in `@johnhenry/aimatey-errors`,
whose sole caller is `createErrorFromHttpResponse` -- a mapper for responses *received from*
a provider, the opposite direction from these two, which produce statuses the library
*serves*. Every other retry decision (`Bridge`, the retry middleware, `Router`) reads the
`isRetryable` boolean on the error object. And even where the two could meet -- an ai.matey
server proxied by an ai.matey client -- 408 and 504 are both retryable anyway (408 is in
`RETRYABLE_CLIENT_STATUS_CODES`; 504 is `>= 500`). So there was no silent retry split.

## Why this is `minor`

Statuses served to callers change: a timeout through `CoreHTTPHandler` moves 408 -> 504, and
the typed-error rows above move off 500. Any client keying on those codes sees different
values. On 0.x that is a `minor`.
