---
'@johnhenry/aimatey-backend': patch
---

Count multi-part message content, and stop re-multiplying a dollar amount, in `estimateCost()` (#40, #41)

The fixes themselves landed in `eb34ba4` without a changeset, so they would
have shipped with no version bump and no changelog line despite changing every
number `estimateCost()` returns. This records them.

**Multi-part content was priced as if it were empty (#40).** Seventeen provider
adapters (`ai21`, `anyscale`, `aws-bedrock`, `azure-openai`, `cerebras`,
`cloudflare`, `cohere`, `deepinfra`, `fireworks`, `inception`, `mistral`,
`moonshot`, `openrouter`, `perplexity`, `sambanova`, `together-ai`, `xai`)
counted input tokens with `typeof msg.content === 'string' ? msg.content : ''`.
Any message whose `content` is an array of blocks — which is every message
carrying an image, and any message split into multiple text blocks — collapsed
to the empty string, so its input tokens were counted as zero. The output-token
half of the estimate was unaffected, so the symptom was not a zero cost but a
silently *partial* one: the entire prompt vanished from the bill while the
completion still showed up.

```ts
const req = {
  messages: [{ role: 'user', content: [
    { type: 'text', text: 'a'.repeat(1800) },
    { type: 'image', source: { type: 'url', url: '...' } },
  ]}],
  parameters: { model: 'jamba-instruct', maxTokens: 1024 },
};
await ai21.estimateCost(req);
// before: 0.0007168  (450 input tokens dropped)
// after:  0.0009418  (identical to the same text sent as a plain string)
```

All seventeen now route through the existing `estimateTokens()` helper in
`packages/backend/src/shared.ts`, which already walked structured content
blocks correctly — the same helper `openai` and `anthropic` were using. No new
abstraction was introduced: the shared helper predates the bug, and the
seventeen call sites were simply not using it.

**Groq and NVIDIA multiplied dollars by a per-token rate (#41).** Both took
`super.estimateCost()` — `OpenAIBackendAdapter`'s, which returns a **dollar
amount** — and fed it in as a token count:

```ts
const estimatedInputTokens = (await super.estimateCost(request)) || 0;
const inputCost = (estimatedInputTokens * 1000 * 0.05) / 1_000_000;
```

A dollars-per-million-tokens rate applied to a dollar figure is dimensionally
meaningless, and the `* 1000` made it worse rather than cancelling. For a
450-token prompt Groq reported `$0.1024` against a true `$0.0001249` — 820x
over. Both adapters now call `estimateTokens(request)` directly, like every
other adapter, and no longer call `super.estimateCost()` at all.

Because the unit confusion came from a bare `number` crossing a boundary,
`shared.ts` already carries the antidote and it is worth preferring at new call
sites: `estimateCost(inputTokens, outputTokens, rates: CostRates)`, whose
`CostRates` fields are named `inputPer1M` / `outputPer1M` so the rate's unit is
visible at the call site rather than implied by a comment.

Consumers who route on cost are affected beyond the reported number:
`Router` accrues `estimateCost()` output per backend, so cost-optimised routing
was choosing between wrong figures — understated for any vision or multi-block
request, and wildly overstated for Groq.

Tests: `tests/unit/backend-estimate-cost-multipart.test.ts` (7 cases, including
a source-level sweep asserting no provider file has regressed to the string-only
check) and `tests/unit/groq-nvidia-estimate-cost.test.ts` (5 cases). Reverting
either fix fails 4 and 2 of those respectively.
