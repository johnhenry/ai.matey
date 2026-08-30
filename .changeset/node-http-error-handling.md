---
'@johnhenry/aimatey-http-core': minor
'@johnhenry/aimatey-http': patch
---

Give the Node HTTP adapter real error handling: correct status codes, a response for
oversized payloads, and no server internals on the wire.

**A malformed request no longer reads as a server fault.** The Node listener's catch sent
`sendError(res, err, 500)` — one hardcoded number for every failure. Unparseable JSON,
which is entirely the caller's doing, came back as `500` with the message
`Invalid JSON body: Expected property name or '}' in JSON at position 1`; so did a garbage
`Host` header, which makes `new URL()` throw a bare `TypeError` inside `parseRequest()`.
A client had no way to tell "fix your payload" from "the server is broken", and any retry
policy keyed on 5xx would dutifully replay a request that could never succeed.

The status now comes from `getHTTPStatusCode()`, the mapping that already existed in
`error-handler.ts` but was module-private, so every HTTP entry point can reach the one
taxonomy instead of hardcoding numbers at each catch site. It is now exported. The parser
raises typed errors — `ValidationError` for unparseable JSON and for a `Host`/URL that
cannot be parsed — so those map to `400` by class rather than by the accident of the word
"invalid" appearing in a message.

**An oversized body now gets a 413 instead of a dropped connection.** `readBody()` called
`req.destroy()` the moment the size limit was crossed. That tears down the socket the
response has to go out on, so the client received no status line at all — just a closed
connection, indistinguishable from a crash or a network fault. It now stops buffering and
keeps draining, which bounds memory the same way while leaving the response writable, and
rejects with an error that declares `httpStatus: 413`. Declaring the status is what lets
`getHTTPStatusCode()` answer 413 without inferring it from the word "large" in the message,
which would break the first time someone reworded it. Errors may now carry
`details.httpStatus` for exactly this purpose; it is read only from there, never from
`httpContext.statusCode`, because that records what an upstream *provider* answered and
echoing it would report a provider's 404 as our own.

**Error bodies no longer leak the server.** Every formatter — the two in
`response-formatter.ts` and the copy in `CoreHTTPHandler` — put `error.message` straight in
the response. A backend that failed with a message naming a source file handed the client
that path verbatim. `sanitizeErrorMessage()` (also newly exported) now stands in front of
all of them: 5xx becomes the canonical status text, since the caller can do nothing with
the detail and the detail is what an attacker wants, while 4xx keeps its message — the only
way a caller can correct the request — scrubbed of absolute paths, `file://` URLs, and
appended stack frames. The full error is still reported server-side.

**Server-side reporting follows the existing convention.** The listener called
`console.error` directly, bypassing the `logging`/`log` options the core handler already
honors, so a host that had configured a logger still got these errors on stderr. It now
routes through `log` when logging is enabled and falls back to `console.error` only when
nothing is configured.

**Two smaller hardening changes.** A client that hangs up mid-request is recognised
(`ECONNRESET`/`ECONNABORTED`/`EPIPE`, or Node's bare `Error: aborted`) and logged rather
than run through the error responder, which would only fail a second time writing to a dead
socket. And `req.setTimeout()`/`res.setTimeout()` moved inside the `try`: they sat above it,
where a bad `timeout` value would reject the handler promise that `http.Server` never
awaits — an unhandled rejection, fatal on Node >= 15, which is the failure this whole area
is supposed to prevent.

Covered by tests that drive a real `http.Server` over real sockets. The existing listener
suite builds mock `req`/`res` objects, and a mock never destroys a socket, aborts mid-body,
or reports `headersSent` — which is why these failure modes survived it. Each new test
asserts both the status code and that the server is still serving afterwards.
