---
'@johnhenry/aimatey-types': minor
---

Let `IRProvenance` nest, so an adapter that fronts another Router can say what actually
served the request (#110).

## One hop was all it could name

`IRProvenance` was four flat optional fields -- `frontend`, `backend`, `middleware[]`,
`router` -- with no slot holding another `IRProvenance`. That is enough for a request that
begins and ends in one process, and not enough for one that crosses a device boundary.

When a `BackendAdapter` fronts another aimatey instance -- a tunnel, a gateway, a
self-hosted relay, two Bridges composed in one app, a test double wrapping a real `Router`
-- the far side runs its *own* Router and picks its *own* backend. For
`phone -> desktop -> llama-cpp` the phone had two things it could say, and both were wrong:

| what the phone reports | what is lost |
| --- | --- |
| `backend: 'tunnel'` | `llama-cpp` -- the model that actually ran |
| `backend: 'llama-cpp'` | that another *device* ran it -- a false claim about this one |

The second is not merely lossy, it is untrue, and nothing in the type distinguished it from
a phone that genuinely ran llama-cpp locally.

## Why the ambiguity matters

Provenance is a privacy surface, not telemetry. A UI whose claim is that you are told when
a reply came from somewhere other than your own device renders a chip from exactly this
field. "Your own desktop" and "a third-party API" must not render the same -- and a field
that cannot separate them makes an honest chip impossible to build, however careful the UI
code is.

## What changed

- **`IRProvenance.upstream?: IRProvenance`** -- provenance reported by the next hop, set
  only when `backend` is itself a proxy. The chain nests to whatever depth the request
  actually travelled.
- **`withUpstreamProvenance(local, upstream)`**, exported from `@johnhenry/aimatey-types`
  -- attaches a far side beneath a proxy's own hop. It lives in the types package because
  `@johnhenry/aimatey-backend` depends on types and *not* on core, so a proxying adapter
  can reach it.

The helper exists to prevent the one-line version of the bug:

```ts
// WRONG -- the far side's backend silently becomes this process's backend.
metadata: { ...farResponse.metadata }

// RIGHT -- this adapter names itself, and the far side nests beneath it.
provenance: withUpstreamProvenance(
  { backend: this.metadata.name },
  farResponse.metadata.provenance
)
```

An `upstream` that is `undefined`, `{}`, or all-undefined is dropped rather than recorded.
Adapters that report no provenance conventionally return `{}` rather than `undefined`, and
an empty link would claim a hop exists while saying nothing about it -- stopping any
consumer that walks the chain looking for the far end.

## The Bridge needed no behaviour change, which is worth stating explicitly

`enrichResponse()` -> `resolveProvenance()` builds its result with `{ ...provenance, ... }`,
so an `upstream` written by the backend is already carried through untouched; the bridge
stamps its own `frontend` over the near hop and overwrites nothing beneath it. The change
there is a doc comment recording that the spread is load-bearing, plus tests that fail if
it stops being. A survey of every provenance reader in the monorepo found none that
rebuilds the object field-by-field, which is the pattern that would have dropped the chain.

The bridge could not build the chain itself in any case -- only the proxying adapter knows
it forwarded.

## Compatibility

Purely additive. `upstream` is optional, so every existing value stays valid and every
existing reader keeps compiling. The four flat fields keep describing the **nearest** hop,
which is already what their readers mean: `Bridge`'s `backendUsage` counter and its
circuit-breaker narrowing both key off `provenance.backend` to decide which adapter to stop
calling, and crediting or blaming a far-side backend this process cannot reach would be
wrong. A consumer that wants the far end walks `upstream` to the last link.

The IR stays plain JSON -- `ir.ts` still contains no `AbortSignal`, `Date`, `Map`, `Blob` or
function type -- so a nested chain survives the wire that a proxy has to cross to produce
one.
