---
'@johnhenry/aimatey-middleware': patch
---

Fix `TypeError: createHash is not a function` in browsers, webviews, Capacitor and Electron renderers (#48).

`caching.ts` and `embeddings.ts` derived their cache keys with Node's
`crypto.createHash('sha256')`, imported by the bare specifier `'crypto'`. Both
modules are re-exported from the package barrel, so *any* import from
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
