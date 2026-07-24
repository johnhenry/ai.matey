---
'ai.matey.backend': patch
---

Add `OmniRouteBackendAdapter` for [OmniRoute](https://github.com/diegosouzapw/OmniRoute), a
self-hosted AI gateway fronting 290+ providers (90+ free) behind one OpenAI-compatible endpoint.
Extends `OpenAIBackendAdapter` (same pattern as `LMStudioBackendAdapter`), since OmniRoute
speaks the OpenAI wire format verbatim. Defaults to `http://localhost:20128/v1` and the special
`auto` model (lets OmniRoute pick a healthy provider from your configured pool); no API key is
required for local/keyless-free usage. `estimateCost()` returns `null` since the actual routed
provider/cost isn't knowable from the request alone.
