---
'ai.matey.core': minor
'ai.matey.types': minor
'ai.matey.http.core': minor
---

Router emits `model-substituted` warnings (metadata + new `RouterConfig.onWarning` callback) when
hybrid translation falls back to a backend default model. http.core gains a framework-agnostic
`GenericRateLimiter`; `RouteMatcher.match()` accepts any structurally-compatible request.
