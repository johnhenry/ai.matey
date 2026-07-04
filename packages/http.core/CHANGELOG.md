# ai.matey.http.core

## 0.3.0

### Minor Changes

- d3fd2e2: Production HTTP endpoints: built-in `/health` + `/health/ready` + `/health/live`, Prometheus
  `/metrics`, OpenAI-compatible `/v1/embeddings`, per-route rate limits via `RouteConfig.rateLimit`,
  and a zero-dependency WebSocket streaming subpath (`ai.matey.http/websocket`).
- 78731bb: Router emits `model-substituted` warnings (metadata + new `RouterConfig.onWarning` callback) when
  hybrid translation falls back to a backend default model. http.core gains a framework-agnostic
  `GenericRateLimiter`; `RouteMatcher.match()` accepts any structurally-compatible request.

### Patch Changes

- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [f227db2]
- Updated dependencies [2912b7d]
- Updated dependencies [aef9f4a]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
  - ai.matey.types@0.3.0
  - ai.matey.core@0.3.0
