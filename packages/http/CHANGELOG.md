# ai.matey.http

## 0.3.1

### Patch Changes

- 73aa9f1: Fix broken CJS entry points across the whole package family. Every package declares
  `"type": "module"` for ESM subpath resolution, but shipped `dist/cjs/` builds with no nested
  override - Node walked up to the package root, saw `"type": "module"`, and misinterpreted the
  compiled CommonJS as ESM, so `require("ai.matey.x")` failed with `Cannot find module './y.js'`
  on every package in the family (ESM `import` was unaffected). Each package's build now emits a
  `dist/cjs/package.json` containing `{"type":"commonjs"}` (via a new
  `scripts/fix-cjs-package-json.js` post-build step) to correctly scope the CJS build's module
  type. No source or `exports` map changes - verified via `npm pack` + fresh install against the
  exact repro in #23, both direct `require()` and the `require` export condition on subpaths (e.g.
  `ai.matey.backend.browser/chrome-ai`).

  (#23)

- Updated dependencies [73aa9f1]
  - ai.matey.core@0.3.3
  - ai.matey.http.core@0.3.1
  - ai.matey.types@0.5.1

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
