---
'ai.matey.patterns': minor
'ai.matey.core': patch
---

New `ai.matey.patterns` package: complexity routing, parallel aggregation, failover middleware,
cost optimization with budget windows, and batch processing. Router's `dispatchParallel` now
actually honors the `fastest` strategy (previously returned the first-registered success).
