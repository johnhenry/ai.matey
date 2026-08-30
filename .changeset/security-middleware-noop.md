---
'@johnhenry/aimatey-middleware': minor
'@johnhenry/aimatey-types': minor
---

Make `createSecurityMiddleware` actually secure the request (#55).

`createSecurityMiddleware` computed a `securityHeaders` object, wrote it to
`request.metadata.custom.securityHeaders`, and returned. Nothing in the
repository ever read that key - no backend adapter consulted it, and none of the
24 providers attached it to an outgoing request. Registered on a Bridge, a
middleware named `createSecurityMiddleware` passed every request through
untouched: `card 4111 1111 1111 1111` reached the backend verbatim. It made an
application look protected in code review while doing nothing at runtime.

**Request protection.** The middleware now sanitizes message content, redacts
PII, and detects prompt injection *before* the request reaches the backend, on
both `chat()` and `chatStream()`:

```ts
bridge.use(createSecurityMiddleware());
await bridge.chat({ messages: [{ role: 'user', content: 'card 4111 1111 1111 1111' }] });
// backend receives: "card [REDACTED_CREDITCARD]"
```

New `SecurityConfig` options: `redactPII` (default `true`), `piiPatterns`,
`promptInjectionAction` (`'warn'` default, or `'block' | 'log' | 'ignore'`),
`injectionPatterns`, `sanitizeContent` (default `true`), `sanitizer`,
`logWarnings`. `createProductionSecurityMiddleware` blocks injection attempts;
`createDevelopmentSecurityMiddleware` warns. The default is `'warn'` rather than
`'block'` because `DEFAULT_INJECTION_PATTERNS` is deliberately broad - it matches
the bare word `DAN`, so blocking by default would reject innocent prompts.

**One PII implementation, not two.** `createSecurityMiddleware` delegates to
`createValidationMiddleware` rather than reimplementing `detectPII` /
`redactPII` / `detectPromptInjection` / `sanitizeRequest`. The two middleware
are now preset vs. knobs: security is a small, safe-by-default, security-only
surface; validation keeps the full configuration (message and token limits,
allowed models, moderation callbacks, `piiAction: 'block' | 'warn'`). Security
deliberately does *not* inherit validation's data-quality rules - an empty
message is not a security failure.

**Redaction is recorded, not silent.** When redaction changes content, a
`content-redacted` `IRWarning` naming the PII types found is appended to
`request.metadata.warnings`. `WarningCategory` gains the `'content-redacted'`
member for it.

**The header policy.** `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Frame-Options` and friends are browser *response* headers; merging them into
`BackendAdapterConfig.headers` would send them upstream to a provider API, where
they mean nothing. They are still computed, and now have real consumers:

- `buildSecurityHeaders(config)` - exported pure function, for
  `createCoreHandler({ bridge, headers: buildSecurityHeaders() })`, which does
  apply them to HTTP responses.
- `getSecurityHeaders(request)` - exported reader for the metadata key, which is
  still written under `SECURITY_HEADERS_METADATA_KEY` for back-compat.

Also adds `ValidationConfig.injectionAction` (`'block'` default - existing
behaviour unchanged - plus `'warn' | 'log' | 'ignore'`), mirroring `piiAction`,
and `ValidationConfig.logPrefix` so console output names the middleware that
produced it.

**Behavioural change.** A `createSecurityMiddleware` that previously passed
everything through now mutates the request by default. That is why this is a
`minor` rather than a `patch`: on a 0.x package a minor is the breaking-change
bump, and this changes what an existing registration does. Pass
`redactPII: false, sanitizeContent: false, promptInjectionAction: 'ignore'` to
restore the old pass-through behaviour, though at that point the middleware only
computes a header policy.

Tests: 1667 -> 1709 passing; 42 new in `tests/unit/security-middleware.test.ts`,
including the issue's reproduction on both `chat()` and `chatStream()`, which
fails against the previous implementation.
