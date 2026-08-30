---
'@johnhenry/aimatey-core': patch
'@johnhenry/aimatey-types': patch
---

Fix `MiddlewareContext.backend` and `.backendName` being documented but never populated.

Both fields were declared and documented - "backend that will process (or processed) the
request, available after routing decision" - and were `undefined` on every path, for every
backend type. The bridge simply never set them.

The cost is bigger than a missing field: **a middleware could not execute a turn of its
own**, which rules out the whole class of middleware that needs a second pass - an agentic
tool loop, retry with a modified request, failover. Middleware written against the
documented type reads `context.backend` and guards with `if (!backend) …`; through a real
`Bridge` that guard always fired. One consumer hit exactly this: the tool ran, the model
never saw the result, and stripping the tool-call syntax left the user with an empty reply.
Unit tests passed because a hand-built context had `backend` set, which is what the type
invites. Middleware that merely *branches* on `backendName` was hit more quietly - it took
its fallback path every time, with no error.

`Bridge` now populates both fields on all four paths (`chat`, `chatStream`, `executeIR`,
`executeIRStream`), through new optional `backend` parameters on `createMiddlewareContext`
and `createStreamingMiddlewareContext`.

**Which backend they name.** The fields are seeded before the chain runs and narrowed once
the routing decision resolves:

- Before dispatch they are whatever the bridge is about to call. For a router-backed bridge
  that is the router, because the provider genuinely has not been chosen yet - and it is
  the useful value there, since executing through the router routes an extra turn the same
  way the original request was routed.
- After a response comes back they are narrowed to the backend that actually served it,
  read from the response provenance the backend reports, with `backend` resolved through
  the router's registry so `backendName` always equals `backend.metadata.name`. On the
  streaming path the narrowing happens off the `start` chunk, early enough that the
  response phase of every middleware sees it.

That is what "available after routing decision" describes, and it means a follow-up turn
taken after `next()` goes to the backend that just answered - usually what a follow-up
wants. To re-route deliberately, execute through `bridge.getRouter()` instead. Narrowing is
driven from the bridge's innermost dispatch, so a middleware that calls `next()` more than
once sees the value for its most recent dispatch rather than a stale one.

Predicting the selected backend *before* dispatch was considered and rejected: `Router`
has no access to the middleware context (`BackendAdapter.execute()` takes only a request),
and calling `Router.selectBackend()` up front would advance round-robin and re-roll random
selection, so the context could name a backend other than the one that answered. Naming
the router until the answer is known is honest; guessing is not.

`backend` and `backendName` are no longer `readonly` on `MiddlewareContext`, since they are
refined in place as the decision resolves. Dropping `readonly` does not affect assignability,
so no existing implementation of the interface breaks.

`createFailoverMiddleware()` in `@johnhenry/aimatey-patterns` is **not** affected: it takes
its fallback adapters through `FailoverConfig.fallbacks` and never reads `context.backend`.
It was already working, and keeps working.
