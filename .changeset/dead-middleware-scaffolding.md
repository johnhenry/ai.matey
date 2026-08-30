---
'@johnhenry/aimatey-types': minor
---

Remove the dead `MiddlewareOptions` and `MiddlewareWithMetadata` types (#63).

Both were exported from `@johnhenry/aimatey-types` and referenced by nothing -
two declarations, zero uses. All 16 factories in `@johnhenry/aimatey-middleware`
return plain `Middleware` functions, and no registration path ever accepted a
metadata wrapper, so neither type was usable even in principle.

`MiddlewareOptions.supportsStreaming` was the reason to delete rather than keep.
It read like the switch controlling whether a middleware ran on streaming
requests - exactly the question #46 was about - while being inert, so it cost
every reader the time to work out that it did nothing. It was also opt-**in**: a
middleware would default to *not* running on streams, which is the bug #46
fixed, not a design anyone would want now. #50 added a doc comment saying the
flag was decorative, which patched over the problem rather than resolving it.

Nothing in the repository referenced either type; the `MiddlewareWithMetadata`
builder they imply survives only in `specs/001-universal-ai-adapter/contracts/`,
which declares its own copies and is unaffected. Removing an exported type is
breaking in the strictest sense, hence `minor` (the breaking-change bump on a 0.x
package) rather than `patch`.

The `Middleware` / `StreamingMiddleware` function types and
`bridge.use()` / `bridge.useStreaming()` are unchanged and remain the whole
registration surface. `packages/ai.matey.types/src/middleware.ts` now carries a
note in place of the removed block, explaining why there is no metadata wrapper.
