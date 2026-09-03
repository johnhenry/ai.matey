---
'@johnhenry/aimatey-middleware': patch
---

Set `ai.response.model` on OpenTelemetry spans, which was never set at all (#112).

## An attribute that could never be emitted

The OpenTelemetry middleware guarded the `ai.response.model` span attribute on
`response.metadata.provenance?.backendModel`. `IRProvenance` has no `backendModel` field --
it is four flat optionals (`frontend`, `backend`, `middleware`, `router`) -- so the condition
was **always falsy** and the attribute was never set on any span, for any provider, ever.
Grepping the monorepo returned two hits for `backendModel`, both of them the dead read itself,
and two for `RESPONSE_MODEL`: its definition and the single use inside the dead branch.

No compiler could see it. `opentelemetry.ts` declares the optional OpenTelemetry handle as
`let api: any`, and the response was produced through it:

```ts
const response = await api.context.with(spanContext, async () => next());
```

so `response` was `any` and every property access on it was unchecked -- even though
`MiddlewareNext` is precisely typed as `() => Promise<IRChatResponse>`. The type information
existed and was discarded by routing the call through the `any`.

## Which model the attribute means

Per the OpenTelemetry GenAI semantic conventions, `request.model` is "the name of the GenAI
model a request is being made to" (`gpt-4`) and `response.model` is "the name of the model
that generated the response" (`gpt-4-0613`). The two attributes exist in order to differ: a
provider may resolve an alias to a dated snapshot, and ai.matey's own router may substitute a
model outright (the `model-substituted` warning category).

That rules out filling it from the request's `parameters.model`, which would make
`ai.response.model` a duplicate of `ai.request.model` by construction and would assert a model
that never served in exactly the substitution case the attribute exists to record -- turning a
silent absence into a confident falsehood.

## What changed

- `ai.response.model` is now taken from the model the provider actually served, read from
  `IRChatResponse.raw.model`. Every backend adapter preserves the provider's response body
  verbatim in `raw`, and `model` is the conventional key across the OpenAI- and
  Anthropic-shaped providers (`OpenAIResponse.model`, `AnthropicResponse.model`).
- When the served model cannot be determined the attribute is **left unset** rather than
  defaulted, so a consumer can distinguish "not reported" from "reported as X".
- `response` is now annotated `IRChatResponse`, so reads against it are type-checked. The
  previous dead read is now a compile error (`TS2339: Property 'backendModel' does not exist
  on type 'IRProvenance'`) rather than silently-dead code.

## Follow-up

Reading `raw` couples the middleware to provider payload shapes. The IR has no typed field for
the served model, which is also why `providers/openrouter.ts` invented
`metadata.custom.actualModel` -- a second write with no reader anywhere in the monorepo. A
first-class served-model field on the response would give both a home; it is deferred because
it changes `IRProvenance`/`IRMetadata`, which are being restructured concurrently. Tracked in
#113.
