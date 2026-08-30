---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-core': minor
---

Name middleware, so a failure says which one failed.

`MiddlewareError.middlewareName` existed, was typed and documented, and never
held a middleware name. The four sites that set it hardcoded the literal
`'unknown'`; the two that actually wrap a middleware failure omitted it. A
stack of eight middleware reported `Middleware execution failed: <message>`
with no indication of which one broke - the one piece of provenance the wrapper
exists to add was always either absent or a placeholder.

The blocker was that `MiddlewareStack` entries carried no name, so naming
middleware was the prerequisite.

`use()` and `useStreaming()` - on both `MiddlewareStack` and `Bridge` - now
take an optional second argument:

```ts
bridge.use(createRetryMiddleware({ maxAttempts: 3 }), { name: 'retry' });
```

and a failure reads:

```
Middleware "retry" failed: connection reset
```

The name is resolved at registration, in order:

1. `options.name`;
2. the function's own `.name` - free for `function rateLimit()` and for
   `const rateLimit = async (ctx, next) => ...`, and skipped when it carries no
   information (`middleware`, `handler`, `fn`, …);
3. the registration position, `middleware[3]`.

The position is the index across *both* `use()` and `useStreaming()`, so the
same middleware is named identically on the streaming and the non-streaming
path. It is never `'unknown'`: a position is less useful than a name and far
more useful than nothing. The four lock-guard errors now name the middleware
being added or removed instead of claiming `'unknown'`, and report no name at
all when the function is anonymous.

Every middleware factory in `@johnhenry/aimatey-middleware` ends in
`return async (context, next) => {…}`, which produces an anonymous function -
so pass `{ name }` for anything built by one, or it can only be identified by
position.

**API addition, fully backward compatible.** The new parameter is optional;
every existing `use(middleware)` and `useStreaming(middleware)` call keeps
working unchanged, and `remove()`/`getMiddleware()` identity is unaffected.
The only observable change is the wording of the failure message, which gained
the middleware's name.
