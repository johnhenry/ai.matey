---
'@johnhenry/aimatey-utils': minor
'@johnhenry/aimatey-backend': patch
---

Keep Hugging Face's `repetition_penalty` inside its accepted domain (#87).

`packages/backend/src/providers/huggingface.ts` mapped IR `frequencyPenalty`
with `frequencyPenalty ? 1 + frequencyPenalty : undefined`, which had two
defects on one line -- the same falsy-zero class as #42 (Gemini temperature),
missed by that fix.

- **`frequencyPenalty: 0` was dropped.** Zero is falsy, so an explicit `0` --
  a valid neutral value, distinct from "unset", and the value used by the IR's
  own documented example -- became `undefined`.

- **Negatives left the parameter's domain.** Negatives are truthy, so they
  passed the guard and went through `1 + x`: `-1` produced
  `repetition_penalty: 0` and `-2` produced `-1`.

The second defect was worse than "inaccurate". `repetition_penalty` is a
strictly positive *multiplicative* parameter, and Hugging Face enforces that:
text-generation-inference rejects the request when
`repetition_penalty <= 0.0` (`ValidationError::RepetitionPenalty`; its OpenAPI
schema declares `exclusive_minimum = 0.0`), and `transformers`'
`RepetitionPenaltyLogitsProcessor` raises `` `penalty` has to be a strictly
positive float ``. So any `frequencyPenalty <= -1` produced a request the
provider refuses outright, not merely a differently-tuned generation.

**The mapping.** IR `frequencyPenalty` is *additive* on `-2..2` with neutral
at `0`; HF `repetition_penalty` is *multiplicative* on `(0, inf)` with neutral
at `1.0`, where `> 1` discourages repetition and `0 < p < 1` *encourages* it.
The two agree in sense but not in shape, so the fix is not just a corrected
guard -- `1 + x` is the wrong shape for the negative half, because it walks
out of the domain at `x = -1`. The new mapping is piecewise and
reciprocal-symmetric, so `f(-x) === 1 / f(x)`:

```text
  x >= 0  ->  1 + x        in [1, 3]
  x <  0  ->  1 / (1 - x)  in [1/3, 1)
```

It is continuous at `0` (both branches give `1`), monotonically increasing
across the IR range, and strictly positive everywhere, so it needs no clamp to
an arbitrary epsilon to stay in domain. Reciprocal is also how `transformers`
itself inverts this parameter (`self.penalty = 1 / penalty`). Positive
penalties keep their existing `1 + x` wire values, so no currently-accepted
request changes behaviour.

**Why the bumps are what they are.** `backend` is `patch`: no request that
worked before changes its generation. `frequencyPenalty: 0` now sends an
explicit `1.0` where it previously omitted the field, but `1.0` is exactly
TGI's documented default for an absent `repetition_penalty`, so the model sees
the same thing; positives are unchanged; and the only requests whose outcome
changes are the negative ones, which previously failed validation at the
provider. `utils` is `minor` because it gains new public API.

**The shared helper.** The transform lives in
`packages/ai.matey.utils/src/parameter-normalizer.ts` as
`normalizeRepetitionPenalty()`, exercised directly by unit tests, rather than
inline in the adapter. It has exactly one caller today and is not expected to
gain many -- every other provider takes OpenAI-style additive
`frequency_penalty` straight through. It is shared anyway because that module
already exports `normalizePenalty()`, whose linear `-2..2 -> {min, max}` remap
is an active trap for this parameter: it sends neutral `0` to the midpoint of
the target range rather than to `1.0`, and any target minimum at or below zero
reproduces exactly the out-of-domain bug being fixed here. A correctly named,
documented helper sitting beside it is what stops the next adapter author from
reaching for the wrong one.
