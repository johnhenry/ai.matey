---
'@johnhenry/aimatey-middleware': patch
'@johnhenry/aimatey-frontend': patch
'@johnhenry/aimatey-http': patch
'@johnhenry/aimatey-http-core': patch
'@johnhenry/aimatey-testing': patch
'@johnhenry/aimatey-utils': patch
'@johnhenry/aimatey-react-core': patch
---

Fix package readmes that documented APIs which do not exist (#61).

These readmes ship in the published tarball (`files: ["dist", "readme.md", ...]`),
so the wrong examples reached npm:

- `@johnhenry/aimatey-middleware`: the quick-start built a bridge with
  `new Bridge({ frontend, backend, middleware: [...] })`. `Bridge` takes
  positional arguments and `BridgeConfig` has no `middleware` field, so that
  snippet produced a bridge with **no middleware, silently** - the same
  fail-quiet mode as #46, reached by following the readme. Middleware is
  registered with `bridge.use()`. Also corrected `initialDelayMs`/`maxDelayMs`
  to `initialDelay`/`maxDelay`, `ttlMs` to `ttl`, and `detectPromptInjection`
  to `preventPromptInjection`.
- `@johnhenry/aimatey-frontend` and `@johnhenry/aimatey-http`: the same
  `new Bridge({ frontend, backend })` object form, corrected to the real
  positional constructor.
- `@johnhenry/aimatey-http-core`: the entire quick-start and API reference
  described `createCorsMiddleware`, `validateApiKey` and `parseRequestBody`,
  none of which exist. Replaced with the real `CoreHTTPHandler` class and its
  `CoreHandlerOptions`.
- `@johnhenry/aimatey-testing`: listed `MockBackendAdapter`, `createMockResponse`
  and `assertChatRequest` as its exports; none exist in this package. Replaced
  with the real fixture / assertion / property-testing surface, and a pointer to
  `MockBackendAdapter` in `@johnhenry/aimatey-backend-browser/mock`.
- `@johnhenry/aimatey-utils`: documented `asyncGeneratorToReadableStream` and
  `readableStreamToAsyncGenerator`, which do not exist. Replaced with the real
  `splitStream` / `teeStream` helpers.
- `@johnhenry/aimatey-react-core`: `OpenAIBackend` -> `OpenAIBackendAdapter`.
