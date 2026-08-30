---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-core': minor
'@johnhenry/aimatey-middleware': minor
---

Scope cache entries to a caller, and stop caching requests that name none.

`createCachingMiddleware`'s default key was a hash of model, messages and parameters, and
`createEmbeddingCachingMiddleware`'s of input, model and parameters. Neither had any notion
of who was asking. One process answering for several users therefore had a single cache
bucket shared by all of them: the second user to send a prompt was handed the first user's
completion. That is a disclosure bug wearing a performance bug's clothes, and nothing in
the API made it visible - a caller who configured caching and nothing else got it (#44).

A `scopeKey` option was added in #45 so a deployment *could* scope entries by tenant. It
had to be opted into, which is the wrong way round for this failure mode: the deployment
that never heard of the option is exactly the one that is leaking.

**Identity is now a first-class IR field.** `IRMetadata.principal` is an opaque,
deployment-defined string - a tenant ID, a user ID, an API-key fingerprint, a composite
like `tenant-7:user-42`. It is compared verbatim, never parsed, and never sent to a
provider. `Bridge.chat()`, `chatStream()` and `embed()` set it from a typed request option:

```typescript
await bridge.chat(request, { principal: `tenant-${tenantId}:user-${userId}` });
```

It is deliberately not a convention inside `metadata.custom`. `custom` is an unstructured
bag whose keys mean whatever an application decided they mean, so no middleware can read
identity out of it safely; scoping that exists to keep users apart needs a field with one
defined meaning. (The previous documentation suggested `metadata.custom.tenantId`, which
worked only because you wrote both halves of the convention yourself.)

**The default is now to cache less.** The cache key mixes in a scope taken from `scopeKey`
if set, otherwise from `metadata.principal`. A request with neither is not cached at all:
it goes to the backend, the response comes back with a `cache-bypassed` warning on
`metadata.warnings` and `metadata.custom.cacheBypassed === true`, and nothing is written.
Nothing written is nothing that can later be read by the wrong caller.

The alternative default - keep sharing, and warn - was rejected. The two failure modes are
not symmetric: defaulting to sharing discloses one user's completion to another and does so
silently, while defaulting to bypassing costs cache hits until somebody sets one option and
says so in a warning on every response. The expensive mistake is the recoverable one.

**Single-tenant deployments say so once.** One process, one audience, every entry safe to
share - that is why caching was switched on, and it keeps working:

```typescript
bridge.use(createCachingMiddleware({ ttl: 3_600_000, unidentified: 'share' }));
```

`unidentified: 'share'` restores the pre-#44 behaviour for requests that carry no identity.
Requests that *do* carry a principal stay scoped to it even in this mode.

**Existing cache entries survive.** The scope is dropped from the hashed payload when it is
undefined, so `unidentified: 'share'` produces byte-identical keys to the ones this
middleware produced before caller scoping existed: an external cache (Redis and friends)
keeps every entry across the upgrade, and a test pins that. Deployments that adopt
principals get new keys for newly-scoped requests, which is the point - the old unscoped
entries are simply never read again rather than being served to somebody they do not belong
to.

Nothing here reintroduces a Node-only dependency: keys are still hashed with the pure-JS
`stableHash` that #48 moved to, so the middleware keeps working in browsers, webviews and
Electron renderers.

**Why minor rather than patch.** Two reasons, either of which would be enough. New public
API is added - `IRMetadata.principal`, `RequestOptions.principal`, `EmbedOptions.principal`,
`CachingConfig.unidentified`, `EmbeddingCachingConfig.unidentified`, and a `cache-bypassed`
member on `WarningCategory`. And a deployment that upgrades without reading anything sees
its cache stop serving hits until it supplies a principal or opts into sharing. That is a
behaviour change in the safe direction, but it is a behaviour change, and it should not
arrive in a patch that reads as "no action required".

A custom `keyGenerator` is unaffected: supplying one still takes over key derivation
entirely, `scopeKey`, `principal` and `unidentified` are all bypassed, and the generator
remains responsible for mixing in caller identity itself.
