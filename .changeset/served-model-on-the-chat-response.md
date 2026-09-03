---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-backend': minor
'@johnhenry/aimatey-frontend': minor
'@johnhenry/aimatey-middleware': patch
---

Carry the served model on the chat response instead of improvising it per provider (#113).

## The gap

The IR had no typed place to record **which model answered**. `IRParameters.model` is the
request side, so the only source was the provider's own payload in `raw` -- which couples any
generic reader to provider payload shapes. Two independent improvisations existed because of
it: `openrouter`'s `metadata.custom.actualModel` (a write with no reader) and the dead
`provenance.backendModel` read removed by #112.

## `IRProvenance.servedModel`

```ts
{ frontend: 'openai', backend: 'openai-backend', servedModel: 'gpt-4-0613' }
```

**On provenance, not flat on the response**, because the served model is the one response
fact whose value genuinely differs per hop. In `phone -> desktop -> llama-cpp` the model that
answered belongs to the last hop, and the tunnel served nothing at all:

```ts
{
  backend: 'tunnel',                                     // no servedModel: it forwarded
  upstream: { backend: 'llama-cpp', servedModel: 'qwen2.5-7b-instruct' }
}
```

A flat field -- on `IRChatResponse` or on `IRMetadata` -- could record only one of those two,
reintroducing one field over the exact ambiguity #110 removed from `backend`. A consumer
could not tell whether the phone ran qwen locally or the desktop did, which for a privacy
surface is not a rounding error.

The symmetry argument for a top-level `IRChatResponse.model` (matching `IREmbedResponse`) was
considered and rejected: `IREmbedResponse.model` is **required** and falls back to the
*requested* model (`backend/src/shared.ts:349`, `json.model ?? model`), so it does not mean
"the model that served" and copying it here would have meant asserting a model that never ran
in precisely the substitution case this field exists to record.

`resolveServedModel(provenance)` ships alongside `withUpstreamProvenance` in the types
package (which `backend` depends on and `core` does not) and walks a chain **nearest-first**.
Because a forwarding hop leaves its own `servedModel` unset, that returns the far end in the
canonical proxy chain, while still resolving to a nearer hop that did report when the far one
is a provider that reports nothing.

`servedModel` is assigned as a **plain key**, not with the conditional-spread idiom used
elsewhere in these metadata blocks. Excess-property checking does not see through a spread of
a conditional expression, so a misspelled key written that way compiles silently -- which is
how the non-existent `provenance.backendModel` survived until #112. Deleting the declaration
now produces 18 `error TS2353`s, one per write site.

## Provider coverage, stated plainly

**26 of 30** backend adapters populate it; **4** correctly leave it `undefined`.

- **Direct (18):** ai21, anthropic, anyscale, azure-openai, cerebras, cloudflare, dashscope,
  deepinfra, fireworks, gemini, github-models, mistral, ollama, openai, openrouter,
  perplexity, together-ai, xai.
- **Inherited (8):** deepseek, groq, inception, lmstudio, moonshot, nvidia, omniroute,
  sambanova -- all extend `OpenAIBackendAdapter` and none overrides `toIR()`.
- **Absent (4):** cohere (v1 `/chat` returns no model field), aws-bedrock (Converse returns
  none, and an inference profile deliberately does not disclose it), huggingface
  (`{ generated_text }` only), replicate (`version` is what you *sent*, so echoing it back
  would look like coverage and be wrong).

**Gemini is the one that changes.** #112's `raw.model` read could never see it: Gemini has no
top-level `model` key at all, and reports the served model as `modelVersion` ("Output only.
The model version used to generate the response"). `GeminiResponse` now declares that field
and `toIR()` maps it, so the difference is the adapter's problem rather than tracing's.

## OpenTelemetry

`ai.response.model` now reads the typed field first. `raw.model` is kept strictly as a
**fallback** -- an out-of-tree `BackendAdapter` written before the field existed still
compiles while setting only `raw`, and a cache or fixture may predate it; dropping the
fallback would take those from "attribute set" to "attribute unset". It is deliberately not
extended with per-provider keys: teaching it `raw.modelVersion` for Gemini would re-couple
tracing to payload shapes in the same change that decouples it.

When neither source reports, the attribute stays **absent** -- never filled from
`parameters.model`. #112's rule is unchanged and still enforced by test.

## `'model-substituted'` is now verifiable end to end

The router emits that warning when it routes to a model other than the one requested. A
consumer was told a substitution happened but could not learn *what* answered without parsing
`raw` per provider. Both halves are now on the response: `warning.originalValue` is what was
asked for, `resolveServedModel(...)` is what answered.

## Behaviour changes worth naming

1. **The frontend wire projection.** `frontend/adapters/openai.ts` and `anthropic.ts` emitted
   `provenance.backend` as the payload's `model`, so an HTTP client of an aimatey server was
   handed `"model": "openai-backend"` in an otherwise OpenAI-shaped response. They now emit
   the served model, falling back to the old value so nothing that had a value loses one.
   **This changes bytes on the wire** and is the literal "improvising it per provider" of the
   issue title. **It applies to `chat()` only.** `chatStream()` builds its payload on a
   different path and still emits the backend adapter's name as `model` for every provider,
   so a client that streams sees no change from this release and a client that does both sees
   the two disagree. Closing that needs a served model on `StreamDoneChunk`, which has no
   metadata slot today -- a separate change, not an oversight of this one.
2. **Two more dead reads fixed.** `frontend/adapters/mistral.ts` and `ollama.ts` read
   `metadata.custom.model`, whose only writer in the monorepo is Anthropic's *stream start
   chunk* -- so on an `IRChatResponse` they always took their constant fallback
   (`'mistral-small'` / `'unknown'`). Same defect class as #112, in two more places.
3. **`metadata.custom.actualModel` is kept**, as a deprecated alias computed from the same
   read so the two cannot disagree. Removal is uniquely un-warnable here: `custom` is
   `Record<string, unknown>`, so an external consumer loses the key with no compile error and
   no lint warning, just `undefined` rendered into a UI. Removed in the next major.

Not breaking at the type level: the property is optional, `exactOptionalPropertyTypes` is
off, and there is no `satisfies IRProvenance`, `Required<IRProvenance>` or
`keyof IRProvenance` anywhere in the tree.

## Not in scope

**Streaming.** OpenAI-shaped adapters emit their `start` chunk before any provider bytes are
parsed, so covering streams needs a new `metadata` chunk emission -- an ordering-sensitive
change across ~20 adapters. Anthropic alone could have been done for free, but that would
make `chat()` and `chatStream()` agree for one provider and disagree for the rest, which is
worse than deferring uniformly. Filed as follow-up.
