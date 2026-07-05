# ai.matey.http

## 0.3.0

### Minor Changes

- d3fd2e2: Production HTTP endpoints: built-in `/health` + `/health/ready` + `/health/live`, Prometheus
  `/metrics`, OpenAI-compatible `/v1/embeddings`, per-route rate limits via `RouteConfig.rateLimit`,
  and a zero-dependency WebSocket streaming subpath (`ai.matey.http/websocket`).

### Patch Changes

- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [d3fd2e2]
- Updated dependencies [f227db2]
- Updated dependencies [2912b7d]
- Updated dependencies [aef9f4a]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
  - ai.matey.types@0.3.0
  - ai.matey.core@0.3.0
  - ai.matey.http.core@0.3.0

## 0.2.1

### Patch Changes

- Fix HTTP streaming implementation for Express
  - Implement SSE streaming manually for Express compatibility
  - Remove dependency on sendSSEHeaders/sendSSEChunk/sendSSEDone helpers
  - Add flushHeaders() call to ensure headers are sent immediately
  - Write chunks in proper SSE format: data: {json}\n\n
  - Send [DONE] marker when stream completes

  Verified working with OpenAI backend successfully streaming chunks.
