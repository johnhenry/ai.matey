# @johnhenry/aimatey-middleware

## 0.1.1

### Patch Changes

- bc0b9ea: Fix `TypeError: createHash is not a function` in browsers, webviews, Capacitor and Electron renderers (#48).

  `caching.ts` and `embeddings.ts` derived their cache keys with Node's
  `crypto.createHash('sha256')`, imported by the bare specifier `'crypto'`. Both
  modules are re-exported from the package barrel, so _any_ import from
  `@johnhenry/aimatey-middleware` pulled Node `crypto` into the module graph.
  Bundlers externalize it for browser targets ("Module "crypto" has been
  externalized for browser compatibility"), leaving `createHash` undefined, and
  the first cache lookup threw.

  The cache key is an index over `JSON.stringify(...)` of the request, not a
  security primitive, so it no longer needs a cryptographic hash. It is now
  produced by `stableHash`, a dependency-free 128-bit non-cryptographic hash
  (FNV-1a 64-bit run as two independently-seeded lanes, finalized with Murmur3's
  `fmix32`). It is synchronous — `CacheKeyGenerator` keeps its existing signature,
  unlike `crypto.subtle.digest` — deterministic across engines and platforms, and
  hashes UTF-16 code units so emoji, CJK, combining marks and even lone
  surrogates are all handled without throwing and without collapsing together.

  **Cache keys change.** Keys produced by this version differ from the previous
  SHA-256 ones, so every existing cache entry misses once and is then repopulated.
  Persistent/shared `CacheStorage` implementations will accumulate the old entries
  until their TTL expires; clear the cache on deploy if that matters to you.
  Custom `keyGenerator` functions are unaffected.

  Note that `stableHash` is deliberately **not** cryptographic. Anything in your
  own code that needs collision resistance against an adversary should keep using
  `node:crypto` (server-side) or `crypto.subtle` (universal).

- Updated dependencies [6e79fa1]
- Updated dependencies [213b23e]
- Updated dependencies [0ac4957]
  - @johnhenry/aimatey-core@0.2.0
  - @johnhenry/aimatey-types@0.2.0
  - @johnhenry/aimatey-errors@0.1.1
  - @johnhenry/aimatey-utils@0.1.1

## 0.1.0

### Minor Changes

- Republish from current main with a real fresh build.

  The 0.0.0 scope-import publishes (2026-08-26) shipped stale dist output --
  local npm publish without a rebuild, so the tarballs were missing everything
  after mid-July: the OmniRoute/GitHub Models/DashScope/Moonshot/SambaNova/
  Inception providers, litert-lm, the embeddings types module, and the
  provider-default-model fixes. This release republishes every package from
  current main (which also includes the 2026-08-26 audit fixes) via the CI
  release workflow, which always builds fresh before publishing.

### Patch Changes

- Updated dependencies
  - @johnhenry/aimatey-core@0.1.0
  - @johnhenry/aimatey-errors@0.1.0
  - @johnhenry/aimatey-types@0.1.0
  - @johnhenry/aimatey-utils@0.1.0

> Previously published as `ai.matey.middleware`, last unscoped version `0.3.1`.

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
  - ai.matey.errors@0.2.1
  - ai.matey.types@0.5.1
  - ai.matey.utils@0.4.2

## 0.3.0

### Minor Changes

- dae4d01: Embeddings support: `bridge.embed()` / `router.embed()` with batch chunking, dimension
  normalization, and an embed middleware chain; provider implementations for OpenAI, Mistral,
  Gemini, Cohere, Ollama, Together, Fireworks, DeepInfra, NVIDIA, and LM Studio; caching and
  cost-tracking embedding middleware.

### Patch Changes

- 2912b7d: Introduce a shared, data-driven model registry in `ai.matey.utils` as the single source of truth
  for model metadata (pricing, context windows, capabilities, quality/latency). The registry ships
  with a mid-2026 seed (GPT-5.x/o-series, Claude 4.x, Gemini 2.5/3, Grok, current Mistral/DeepSeek,
  plus embedding models) and is runtime-extensible via `registerModels()` / `overrideModelPricing()`,
  with alias and longest-prefix fallback so new dated snapshots of known families still resolve.

  `ai.matey.core`'s model-pricing API is now a thin delegate over the registry (no API break; legacy
  models keep their prices, marked `deprecated`). Capability inference recognizes current families.
  Cost-tracking middleware consults the registry before provider-level defaults. `useTokenCount`
  consults the registry for context windows. Backend default models updated:
  `claude-3-haiku-20240307` → `claude-sonnet-4-5-20250929` (Anthropic), `gpt-3.5-turbo` →
  `gpt-5-mini` (OpenAI) — note this changes behavior for requests that omit a model. `estimateCost()`
  on both backends now prices the actual requested model. Refreshed `deepseek-chat` pricing.

- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [f227db2]
- Updated dependencies [2912b7d]
- Updated dependencies [aef9f4a]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
- Updated dependencies [58ebc03]
  - ai.matey.types@0.3.0
  - ai.matey.utils@0.3.0
  - ai.matey.core@0.3.0
