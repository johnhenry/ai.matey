---
'@johnhenry/aimatey-core': patch
'@johnhenry/aimatey-types': patch
---

Fix middleware being silently skipped on every streaming request.

`MiddlewareStack` kept two separate registries - `middleware` and
`streamingMiddleware` - and `executeStream()` early-returned the backend stream
whenever `streamingMiddleware` was empty. `Bridge.use()` only ever wrote to
`middleware`, and `MiddlewareStack` was `private` on the Bridge, so
`streamingMiddleware` was *always* empty through the public API. Every
middleware registered with `bridge.use()` - retry, caching, logging, telemetry,
cost tracking, validation, security - ran for `chat()` and did nothing at all
for `chatStream()`, while `getMiddleware()` kept reporting it as registered. For
a chat app, where streaming is the normal path, that meant PII redaction and
prompt-injection detection quietly never ran.

**`bridge.use()` now runs on both paths.** The stack keeps one ordered
registry and adapts each `Middleware` onto the stream via a new exported
`adaptMiddlewareToStreaming()`, preserving the onion shape:

- the request phase (before `await next()`) runs before the backend is called;
- chunks pass straight through - no buffering, no added latency;
- the response phase (after `await next()`) runs once the stream has been
  consumed, against a real `IRChatResponse` assembled from the delivered chunks,
  so logging, telemetry, cost tracking, caching and conversation history see
  genuine content, usage and finish reason rather than a stub.

**Request rewrites now reach the backend.** `Bridge` called the backend with the
request it had captured before the chain ran, so a middleware that reassigned
`context.request` - `createValidationMiddleware`'s PII redaction and
sanitization, `createTransformMiddleware`, `createSecurityMiddleware`,
`createConversationHistoryMiddleware` - had its rewrite thrown away on *both*
paths. `chat()`, `chatStream()`, `executeIR()` and `executeIRStream()` now read
`context.request` when they call the backend.

**New: `bridge.useStreaming(mw)`** for stream-native middleware that transforms
chunks directly, plus `removeStreamingMiddleware()` and
`getStreamingMiddleware()`. `createStreamingCostTrackingMiddleware()` -
previously unreachable through `Bridge` at all - can now be registered.
`use()` and `useStreaming()` registrations interleave in registration order.

**Documented limitations of the adapted path** (a middleware that needs the
assembled response cannot behave identically on a stream, and this does not
pretend otherwise):

- The chunks have already reached the consumer when the response phase runs, so
  **modifications a middleware makes to the assembled response are dropped**.
  The response is explicitly marked: `metadata.custom.assembledFromStream` is
  `true` and an `info`-severity `capability-unsupported` `IRWarning` states the
  drift. Use `useStreaming()` to change what the consumer sees.
- Errors thrown *after* `next()` surface while the consumer iterates the stream,
  not from the `chatStream()` call. Errors thrown *before* `next()` propagate
  from `chatStream()` exactly as they do from `chat()`.
- A middleware that short-circuits without calling `next()` (a cache hit) has
  its response replayed as a synthetic stream, with a `capability-unsupported`
  warning on the start chunk noting the chunk boundaries are synthetic.
- A partially delivered stream cannot be restarted: a second `next()` call
  throws a `MiddlewareError` rather than silently advancing the chain.
- A consumer that abandons the stream still runs the response phase, with a
  partial response whose `finishReason` is `cancelled`.

`MiddlewareOptions.supportsStreaming` was left unused. It belongs to a
`MiddlewareWithMetadata` builder that does not exist anywhere in the repo, and
it is an opt-*in* boolean - which would mean middleware defaults to being
skipped on streams, the very bug being fixed. The opt-in that is actually
needed is the opposite one, chunk-level control, and the `StreamingMiddleware`
type plus `useStreaming()` already express it. The field's doc comment now says
so.

(#46)
