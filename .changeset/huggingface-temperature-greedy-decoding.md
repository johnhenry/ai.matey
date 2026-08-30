---
'@johnhenry/aimatey-backend': patch
---

Express greedy decoding to Hugging Face the way Hugging Face spells it, instead of
sending a `temperature` it rejects (#93).

`packages/backend/src/providers/huggingface.ts` contradicted itself inside a single
object literal. For `temperature: 0` it computed `do_sample: false` — **correctly**,
since that is how greedy decoding is expressed for this provider — and then sent
`temperature: 0` alongside it, which is exactly what the provider rejects. So the IR's
deterministic setting, and the one callers reach for most deliberately, was the one
that hard-failed on a provider the library advertises as supported.

**What text-generation-inference actually does**, read from its source rather than from
its docs:

- **`temperature` is validated unconditionally.** `router/src/validation.rs` does
  `let temperature = temperature.unwrap_or(1.0); if temperature <= 0.0 { return
  Err(ValidationError::Temperature) }` — "`temperature` must be strictly positive".
  That check runs before and independently of `do_sample`, so `do_sample: false` does
  **not** excuse the zero: the request fails validation in the router and never reaches
  the model. An *omitted* temperature defaults to `1.0` and passes.

- **`top_p`/`top_k` are neither rejected nor ignored under `do_sample: false` — they
  override it.** TGI's server picks its decoding strategy in
  `server/text_generation_server/utils/tokens.py`:

  ```python
  has_warpers = (
      (temperature is not None and temperature != 1.0)
      or (top_k is not None and top_k != 0)
      or (top_p is not None and top_p < 1.0)
      or (typical_p is not None and typical_p < 1.0)
  )
  sampling = do_sample or has_warpers
  self.choice = Sampling(seed, device) if sampling else Greedy()
  ```

  `sampling = do_sample or has_warpers`, so any `top_k != 0` or `top_p < 1.0` silently
  *promotes* the request back to `Sampling()` however explicitly `do_sample: false` was
  set. The batched `HeterogeneousNextTokenChooser` promotes the same way, per request
  (`do_sample = [sample or x != 0 for x, sample in zip(top_k, do_sample)]`). Sending
  them on a greedy request would therefore have defeated the greedy request.

**The fix.** An explicit `temperature: 0` now omits `temperature`, `top_p` and `top_k`
together and sends `do_sample: false`. TGI's own defaults for the three absent fields
(`1.0`, `1.0`, `0`) collapse `has_warpers` to `false`, so `do_sample` is what decides,
and the request decodes greedily as asked. Greedy decoding is one payload *shape* for
this provider, not three independent parameters, which is why the three fields are
dropped as a unit.

Only an explicit `temperature: 0` counts as greedy intent. An unset temperature already
omitted `temperature`, and still forwards `top_p`/`top_k` exactly as before — it is not
a request to decode greedily, so that path is deliberately untouched.

**Why `patch`.** This follows #87 (`backend: patch`, "no request that previously worked
changes behaviour") and #89 (`http: patch` for a code path that had never worked at
all). The reasoning holds exactly here: every request whose payload changes is one with
`temperature: 0`, and every such request is refused by TGI's router today with
`ValidationError::Temperature`, so none of them can be working. Requests with a positive
temperature, and requests with no temperature at all, are byte-identical on the wire.
The only outcomes that change are failures becoming successes. Unlike #87 this adds no
public API, so there is no `utils` bump to go with it.

**Why the transform stayed in the adapter.** #87 put `normalizeRepetitionPenalty()` in
`parameter-normalizer.ts` despite having one caller, because the neighbouring
`normalizePenalty()` was an active trap that would silently reproduce the bug. That
justification does not transfer. This change is not a value transform that a second
adapter could reach for wrongly — it is a decision about which keys to omit from a
text-generation-inference payload, and `huggingface.ts` is the only adapter in the repo
that emits that `{ inputs, parameters }` envelope. Hoisting a one-provider protocol
detail into shared utils would invent an abstraction with no second caller and no
sibling to disambiguate it from, so the logic lives at its one call site with the
provider behaviour documented beside it.
