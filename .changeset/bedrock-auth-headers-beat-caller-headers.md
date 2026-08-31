---
'@johnhenry/aimatey-backend': patch
---

Stop caller-supplied headers overwriting AWS Bedrock's computed SigV4 material (#103).

## Auth failed open

`getHeaders()` ended with:

```ts
return { ...headers, ...this.config.headers };
```

`this.config.headers` was spread **last**, so any caller-supplied header won over the ones
signing had just computed -- `Authorization`, `X-Amz-Date` and `X-Amz-Security-Token`
included. A caller who set any of them replaced the SigV4 material *after* the signature had
been calculated over the real values. The request then failed with a generic AWS signature
error that points nowhere near `config.headers`, so the cause was invisible from the call
site.

## Precedence is now explicit

Lowest to highest:

1. transport defaults (`Content-Type`, `Accept`)
2. `config.headers` from the caller
3. the computed SigV4 material

```ts
return { ...defaultHeaders, ...this.config.headers, ...authHeaders };
```

The auth headers are built into their own object so they can be applied after the caller's,
rather than being mixed into the defaults before them.

**Caller headers still beat the transport defaults.** That is deliberate. The reported defect
is about auth, and demoting `config.headers` beneath *everything* -- which the minimal
one-line reversal would have done -- would silently remove `Content-Type` / `Accept`
overrides that work today and are none of signing's business.

**When no AWS credentials are configured, nothing changes.** The auth object is empty, so a
caller supplying their own `Authorization` (a fronting proxy, a sidecar signer) still gets it
through. There is no signature to protect in that case.

| config | before | after |
| --- | --- | --- |
| creds + caller `Authorization` | caller's wins, AWS rejects it | computed signature wins |
| creds + caller `X-Amz-Date` | caller's wins, signature invalid | computed date wins |
| creds + caller `X-Custom-*` | passed through | passed through |
| creds + caller `Accept` | caller's wins | caller's wins |
| no creds + caller `Authorization` | caller's wins | caller's wins |

## Scope

The signed set remains `host` + `x-amz-date` (+ the session token when present), and caller
headers are still not part of it. That is legal SigV4 -- you sign what you declare in
`SignedHeaders` -- and is unchanged here. The defect was the override, not the coverage.

Header names differing only in case (`authorization` vs `Authorization`) are still not
normalized; `Record<string, string>` can hold both and `fetch` would collide them on the
wire. That is a separate surface from the precedence bug fixed here.

`patch`, not `minor`: the only behaviour that changes is a combination that could not have
worked -- a caller overriding the signature material while the adapter was signing produced
an AWS rejection, not a working request.
