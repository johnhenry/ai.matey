---
'@johnhenry/aimatey-http': patch
---

Fix SSE streaming over the Node, Koa and Fastify HTTP adapters, which emitted zero chunks
and never closed the connection.

**The per-chunk guard contradicted the setup it was guarding.** `NodeResponseAdapter.stream()`
calls `sendSSEHeaders()`, which flushes the response headers and sets `headersSent`. The loop
that follows was guarded by `if (!this.isWritable()) break;`, and `isWritable()` was
`res.writable && !res.headersSent`. So the guard was false on the *first* iteration, every
time: the loop broke before writing anything, and because the `break` skipped the tail, the
`[DONE]` sentinel was never written and `res.end()` was never called. Against a real server a
streaming request returned `200` with correct SSE headers, an empty body, and a socket that
stayed open until it timed out. Every streaming request through these adapters behaved this
way — the feature had never worked.

`headersSent` is simply the wrong term in a per-chunk writability check. Once streaming has
started, headers being sent is the *expected* state, not a reason to stop. The check the loop
wants is whether the socket is still usable, so `isWritable()` is now
`res.writable && !res.writableEnded && !res.destroyed` — the same question
`canStillRespond()` in `node/listener.ts` already asks of the same socket.

**`!headersSent` was genuinely needed, but one level up.** It is a pre-flight concern: once
the status line is on the wire it can no longer be changed, so a *new* response cannot begin.
It now lives in a private `canStartResponse()` that `send()` and the top of `stream()` call,
which is exactly the predicate those two call sites evaluated before. Their behaviour is
unchanged; only the per-chunk guards inside the loop got the corrected meaning. In particular
`send()` still refuses to write a JSON body over a response whose headers have already gone
out, so an error surfacing after a stream has begun cannot trigger `ERR_HTTP_HEADERS_SENT`.

The only callers of `isWritable()` outside the adapters are the two rate-limit checks in
`CoreHTTPHandler.handle()`. Both run before anything has been written, where the old and new
predicates agree, so neither is affected.

**Koa and Fastify shared the defect and are fixed the same way.** `KoaResponseAdapter` drives
the same `ServerResponse` through the same SSE helpers, and its `ctx.response.headerSent` goes
true for the same reason. `FastifyResponseAdapter` folded its own `_headersSent` flag into
`isWritable()` and then set that flag two lines above the loop, so its guard was
unconditionally false — the same bug without even depending on the socket's real state. Both
were confirmed broken against real servers before the change and correct after.

The Express, Deno and Hono adapters are *not* affected. Express has the same predicate in its
`isWritable()` but its streaming loop consults `res.writable` directly rather than going
through it; Deno and Hono build a `ReadableStream` whose body loop never consults
`isWritable()` at all. All three were verified streaming correctly over real sockets and are
left alone.

Covered by tests that drive real servers over real sockets. The existing adapter suites build
hand-rolled mock `res` objects with no `headersSent` property at all, so `!res.headersSent`
read `!undefined` → `true`, the guard passed, and the mock happily recorded chunks: those
tests pass identically with and without this fix. This is the same reason the four defects
fixed in #43 went unnoticed. Each new test asserts all three symptoms together — that data
lines arrive, that the `[DONE]` sentinel is written, and that the response actually ends —
because a chunk-count assertion alone still passes against a socket left hanging open.

Fixes #89.
