# @johnhenry/aimatey-utils

## 0.2.0

### Minor Changes

- 22b9273: Stop `generateObject` spending its whole retry budget re-asking a question that has already
  been answered, and make the retries it does spend worth something.

  `createGenerateObject` treated _every_ failure as retryable. The request was re-sent
  unchanged - same prompt, same tool definition, validation errors never fed back - so a
  request that could not be satisfied failed identically `maxRetries` times and the caller
  paid for the whole budget to learn nothing. The reproduction in #69 is three billed
  provider calls producing three byte-identical error sets and one generic error at the end.

  Three mechanisms replace that, and one case they were all designed around.

  **The case that must not break.** `temperature` defaults to `0.7`, so a retry is a genuine
  second chance: a model that returns `'x'`, then `'y'`, then `30` against `z.number()` is
  sampling, not being deterministic, and it still succeeds in three calls. Nothing here bails
  on a first validation failure. The distinguishing signal is repetition, not failure.

  **Gate A - the request cannot be satisfied as sent.** When the provider returns a value
  that conforms to the JSON Schema it was _actually given_, and a lossy Zod → JSON Schema
  conversion explains why Zod still rejects it, no further attempt can validate. This is the
  #66 case: `z.date()` is sent as `{type:'string',format:'date-time'}`, the model returns an
  ISO string - the correct answer to that question - and no JSON value is both a legal string
  and a JS `Date`. That now costs one call instead of three, and the error names the field
  and the cause instead of reading as a model failure.

  Both halves of the test are required. A conversion warning alone is only a correlation: a
  `z.date()` field that failed because the model returned `null` is an ordinary retryable
  mistake. Conformance alone is worse - `'not-an-email'` conforms to `{type:'string'}`, so a
  conformance-only gate would stop on the first failure of every `.refine()`, `.email()` and
  `.min()`, which is exactly the legitimate retry above.

  The conformance check answers `true`, `false` or `unknown`, and only a confident `true` can
  stop a retry. `allOf`, unrecognised `type`s and missing subschemas all answer `unknown` and
  fall through to the previous behaviour.

  **Gate B - the provider repeated itself.** If two successive attempts return the identical
  payload, resampling is not producing anything new and the remaining attempts will reproduce
  it. The issue's own reproduction now costs two calls instead of three.

  This compares _payloads_, not error sets. Zod issues carry no input value, so `'x'` and
  `'y'` against `z.number()` produce byte-identical error sets while the model is genuinely
  resampling; keying on errors would stop that model on attempt 2 and break the case above.
  Object keys are sorted before comparison, so the same data in a different key order counts
  as the same answer rather than as progress.

  **The repair prompt - making a retry a different question.** The validation errors and the
  rejected arguments are fed back, so attempt 2 asks the model to correct named fields rather
  than re-asking the original question. The correction replaces the previous one rather than
  accumulating, so the prompt grows exactly once and is bounded by `maxRepairPromptChars`
  regardless of `maxRetries`.

  **Four adjacent defects in the same loop are fixed with them.** Every transport error was
  retried, including authentication failures and rejected requests, which fail identically on
  every attempt; `signal` was only passed to the transport, so an abort landing between
  attempts started another one; `maxRetries` was used unchecked as a loop bound, so `0`, `-1`
  and `NaN` made _zero_ provider calls before throwing a generic error while `Infinity`
  looped without bound; and serialising Zod issues used bare `JSON.stringify`, which throws
  on a `bigint` or a cycle.

  ## New options

  All optional and additive. `GenerateObjectOptions` gains:
  - `stopWhenRetryCannotHelp` (default `true`) - set `false` to spend the whole budget
    regardless, restoring the previous call counts exactly.
  - `repairPrompt` (default `true`) - `false` restores the previous identical-request retry;
    a function replaces the built-in wording. A new exported `RepairPromptContext` describes
    what that function receives.
  - `maxRepairPromptChars` (default `2000`).

  ## Released as minor, and what to check

  Additive public API plus observable behaviour changes, so this is not a patch even though
  it is a bug fix. In descending order of blast radius:
  1. **The request on attempts 2 and later changes.** The first request is byte-identical to
     before, so a recorded fixture covering only the success path is unaffected; a fixture
     covering a _retry_ needs the whole sequence re-recorded. `repairPrompt: false` restores
     the old wire exactly.
  2. **Provider call counts on failure drop** from `maxRetries` to 1 (Gate A) or 2 (Gate B).
     Anything asserting "three calls" needs updating.
  3. **The thrown error is now a `ValidationError`** rather than a bare `Error`. It still
     extends `Error`, so `instanceof Error`, `.message` and `toThrow(/.../)` keep working,
     and it adds `isRetryable: false` and structured `validationDetails` so callers need not
     parse the message. `err.constructor === Error` breaks.
  4. **The message text changes** - a headline sentence is prepended before
     `Validation failed: [...]`. The "lossy conversion" sentence from #66 is preserved
     verbatim.
  5. **A cost regression under caching.** The default cache key hashes `messages`, so the
     identical retries this replaces were cache _hits_; an informed retry is a miss. A
     three-attempt failure that previously made one real backend call now makes two. The
     mechanism that makes retrying meaningful is the one that defeats the cache. Gate B caps
     it at two, and `repairPrompt: false` restores the old behaviour for callers who would
     rather keep the hit.

  **Set `repairPrompt: false` when extracting from untrusted content.** The correction
  replays the model's own rejected output into the next user turn, and that output may quote
  text from the document being extracted. The replayed block is fenced, labelled as data,
  sanitised and truncated, which reduces that exposure without eliminating it. This is a new
  surface that did not exist when every retry re-sent the original prompt unchanged.

  `streamObject` is unchanged - it has no retry loop.

- 32415cc: Keep Hugging Face's `repetition_penalty` inside its accepted domain (#87).

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
  strictly positive _multiplicative_ parameter, and Hugging Face enforces that:
  text-generation-inference rejects the request when
  `repetition_penalty <= 0.0` (`ValidationError::RepetitionPenalty`; its OpenAPI
  schema declares `exclusive_minimum = 0.0`), and `transformers`'
  `RepetitionPenaltyLogitsProcessor` raises `` `penalty` has to be a strictly
positive float ``. So any `frequencyPenalty <= -1` produced a request the
  provider refuses outright, not merely a differently-tuned generation.

  **The mapping.** IR `frequencyPenalty` is _additive_ on `-2..2` with neutral
  at `0`; HF `repetition_penalty` is _multiplicative_ on `(0, inf)` with neutral
  at `1.0`, where `> 1` discourages repetition and `0 < p < 1` _encourages_ it.
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

- bb69513: Convert Zod unions, records, dates, literals, nullables and a dozen other types to real JSON
  Schema instead of silently degrading them to `{ type: 'string' }` (#66), and attach an
  `IRWarning` whenever the conversion is still lossy.

  `zodToJsonSchema` handled `ZodObject`, `ZodOptional`, `ZodString`, `ZodNumber`, `ZodBoolean`,
  `ZodArray` and `ZodEnum`. **Everything else fell through to `return { type: 'string' }`** — and
  that JSON Schema _is_ the tool contract sent to the provider. The model was told to return a
  string for a field that had to be a union, record, date or literal; it obliged;
  `validateWithSchema` then rejected the response. Because the conversion is deterministic, every
  `generateObject` retry re-sent the same wrong contract and got the same wrong answer, so a
  correct user schema burned all `maxRetries` provider calls (and the tokens) and threw
  `Validation failed: …` with nothing pointing at the schema. This reaches users through the
  documented `Bridge.generateObject`/`Bridge.streamObject` API.

  Worst case was `z.string().nullable()`: reported as a _required string_, so a model correctly
  returning `null` failed validation with nothing in the schema to explain why.

  Now converted: `union` and `discriminatedUnion` (`anyOf`), `intersection` (`allOf`), `record`
  (`object` + `additionalProperties`), `date` (`string`/`date-time`), `literal` (single-member
  `enum`), `nullable` (`anyOf` with `{ type: 'null' }`), `optional`/`nullish`/`default`/`catch`
  (dropped from `required`, `default` carried through), `tuple` (`prefixItems` +
  `minItems`/`maxItems`), `set`, `map`, `null`, `any`/`unknown` (`{}`), numeric and native enums,
  `readonly`/`branded`/`lazy`/`pipe`/`transform`/`refine` (unwrapped to the type the model must
  actually produce), and nested/recursive objects (cycles terminate instead of overflowing the
  stack).

  `nullable` deliberately stays in `required`: `z.string().nullable()` rejects `undefined`, so the
  key must be present and it is the _value_ that may be null. Only `optional`-like modifiers leave
  `required` — the same split Zod's own `z.toJSONSchema()` makes. Dropping a nullable field from
  `required` would reproduce #66 in the other direction.

  **Lossy conversions are now loud.** Anything with no JSON Schema representation (`bigint`,
  `symbol`, `never`, `z.custom()`, an unrecognized node) converts to `{}` — "any value", which
  claims nothing — plus an `IRWarning` (`category: 'content-type-unsupported'`) naming the type
  and the field path. `date`, `set` and `map` convert to their closest JSON form _and_ warn,
  because Zod will reject what comes back over the wire (`z.date()` does not accept the ISO string
  it asks for — use `z.coerce.date()`). The warnings surface in three places: on
  `ToolDefinition.warnings` (present only when non-empty, so a faithful conversion returns exactly
  the shape it always did), on `IRChatRequest.metadata.warnings` for
  `generateObject`/`streamObject` (the IR channel for semantic drift, so middleware and logs see
  it), and appended to the `Validation failed: …` error, so the failure says the schema is a lossy
  conversion instead of looking like a model error.

  The type discriminator no longer depends on class names. It read
  `_def.typeName || schema.constructor.name`, and **Zod v4 has no `typeName`** — so on the major
  most consumers install, every branch rested on a class _identifier_. A name-mangling minifier
  would not have broken one branch, it would have broken all of them at once and converted every
  field of every schema to `{ type: 'string' }`, silently, in production only. The tag now comes
  from string _data_ Zod stores in `_def` (`typeName` on v3, `type` on v4), with `constructor.name`
  kept only as a last resort. Verified against real zod@3.25.76 and zod@4.4.3, including through an
  esbuild bundle built with `minify` and `keepNames: false`.

  `minor` rather than `patch`: the emitted JSON Schema changes for a dozen type families, and the
  exported types widen with it — `JSONSchema.type` becomes optional (an empty schema is how "any
  value" is spelled), `JSONSchema.enum` widens to `unknown[]`, `anyOf`/`allOf`/`prefixItems`/
  `additionalProperties`/`format`/`default` are added, and `ToolDefinition` gains optional
  `warnings`. Nothing is removed and no signature changes, but that is more than a defect repair.

  Zod v4's native `z.toJSONSchema()` was evaluated and deliberately not used: the declared peer
  range is `zod@^3.0.0 || ^4.0.0` and v3 has no equivalent, the namespace form is unreachable from
  a package that (since #59) holds no reference to `zod` at all, and the v4 instance method emits a
  different contract (`$schema`, `additionalProperties: false`, `$ref`/`$defs`, `oneOf`, and a
  throw on `z.date()`/`z.bigint()`) that would change what every existing caller sends to their
  provider.

### Patch Changes

- 9fd19f4: Fix package readmes that documented APIs which do not exist (#61).

  These readmes ship in the published tarball (`files: ["dist", "readme.md", ...]`),
  so the wrong examples reached npm:
  - `@johnhenry/aimatey-middleware`: the quick-start built a bridge with
    `new Bridge({ frontend, backend, middleware: [...] })`. `Bridge` takes
    positional arguments and `BridgeConfig` has no `middleware` field, so that
    snippet produced a bridge with **no middleware, silently** - the same
    fail-quiet mode as #46, reached by following the readme. Middleware is
    registered with `bridge.use()`. Also corrected `initialDelayMs`/`maxDelayMs`
    to `initialDelay`/`maxDelay`, `ttlMs` to `ttl`, and `detectPromptInjection`
    to `preventPromptInjection`.
  - `@johnhenry/aimatey-frontend` and `@johnhenry/aimatey-http`: the same
    `new Bridge({ frontend, backend })` object form, corrected to the real
    positional constructor.
  - `@johnhenry/aimatey-http-core`: the entire quick-start and API reference
    described `createCorsMiddleware`, `validateApiKey` and `parseRequestBody`,
    none of which exist. Replaced with the real `CoreHTTPHandler` class and its
    `CoreHandlerOptions`.
  - `@johnhenry/aimatey-testing`: listed `MockBackendAdapter`, `createMockResponse`
    and `assertChatRequest` as its exports; none exist in this package. Replaced
    with the real fixture / assertion / property-testing surface, and a pointer to
    `MockBackendAdapter` in `@johnhenry/aimatey-backend-browser/mock`.
  - `@johnhenry/aimatey-utils`: documented `asyncGeneratorToReadableStream` and
    `readableStreamToAsyncGenerator`, which do not exist. Replaced with the real
    `splitStream` / `teeStream` helpers.
  - `@johnhenry/aimatey-react-core`: `OpenAIBackend` -> `OpenAIBackendAdapter`.

- 8b89edb: Document two concurrency fixes that changed observable behaviour without a changelog entry,
  and pin both with tests that do not depend on timing (#36, #37).

  The code fixes landed in #45 but carried no changeset, so they were on course to be
  published as silent behaviour changes. Both alter what a caller observes, so both are
  recorded here.

  **`Router` "first success" parallel dispatch no longer settles on the first _failure_
  (#36).** `dispatchParallel({ strategy: 'first' })` awaited `Promise.race()` over per-backend
  promises that are wrapped to always fulfill - carrying `{ success: false, error }` when the
  backend threw - so the race returned whichever backend _settled_ first regardless of
  outcome. A backend that failed fast decided the result, and the dispatch threw
  `ALL_BACKENDS_FAILED` while a slower backend was still in flight and about to succeed.
  `fallbackParallel()` had the same defect through `Promise.race()` over the raw rejecting
  promises. That is the exact inverse of what "first success" promises, and it bit hardest in
  the case the strategy exists for: a fast-failing cheap backend paired with a slower reliable
  one.

  Both now race on fulfilment. `fallbackParallel()` uses `Promise.any()`; `dispatchParallel()`
  uses a `raceFirstSuccess()` helper, because its legs never reject and `Promise.any()` cannot
  see the `success` flag. `ALL_BACKENDS_FAILED` is now raised only once _every_ backend has
  failed, and names all of them rather than just the first to give up.

  What changes for callers: a parallel dispatch that used to fail can now succeed, and one
  that fails takes as long as its slowest backend rather than its fastest. Anything relying on
  a parallel dispatch failing fast will see it wait. `cancelOnFirstSuccess` still aborts the
  losing backends, but only on an actual success - a failure no longer cancels the field.

  **`splitStream()` no longer drops chunks produced before a split starts iterating (#37).**
  Each consumer's resolver defaulted to a no-op function. The eager producer treats a non-null
  resolver as "a consumer is parked waiting", so it handed chunks to that no-op and shifted
  them off the queue before any real consumer had begun. A split that started iterating even
  slightly late silently lost its prefix and then ended cleanly, so the loss looked like a
  short stream rather than an error. The sibling `teeStream()` had it right, defaulting to
  `null`; `splitStream()` now matches.

  The semantics this implies are now stated on the function rather than left to be discovered:
  **a split that subscribes late receives buffered history back to the stream's first chunk.**
  Splits are not live subscriptions. Draining one split fully before touching another is well
  defined and both see identical sequences. The alternative - treating a late first `next()` as
  an error - was rejected because a split exists to fan out to consumers whose start times the
  caller does not control, and there is no subscribe step to hook, only a first `next()`. The
  documented cost is memory: unread chunks are retained per split, so a split that is never
  iterated pins the whole stream.

  A dead `chunks` accumulator that appended every chunk and was never read has been removed
  alongside, so retention now matches what the documentation describes.

  Patch rather than minor in both cases: no API, option or type changed, and each is a bug fix
  restoring the behaviour the existing names and docs already promised.

- 0abfa0b: Fix `ReferenceError: require is not defined` in the ESM build of the structured-output
  utilities, and the misleading "Zod is not installed" error it produced (#59).

  `structured-output.ts` checked whether the optional peer dependency `zod` was available
  by calling `require('zod')`. `require` is not defined in an ES module, and this package
  declares `"type": "module"` — so in the ESM build (what Node picks for `import`, and what
  every bundler resolves) that call threw, the surrounding `catch` swallowed the
  `ReferenceError`, and the fallback error fired instead. The result: `schemaToToolDefinition`,
  `validateWithSchema`, `Bridge#generateObject` and `Bridge#streamObject` all failed with
  "Zod is required for structured output features but is not installed" — **including for
  consumers who had Zod installed and working**. Only the CJS build ever worked. A Vite
  build reproduced it with no warning at all: Rollup passed `require("zod")` straight through
  into the browser bundle, so the first structured-output call threw at runtime in the page.

  The probe is gone rather than rewritten. This module never used the `z` namespace it was
  loading: every entry point is handed a schema the caller built, so the schema _is_ the
  injected Zod instance — the same injectable pattern `@johnhenry/aimatey-mcp` uses for MCP
  clients. What replaces it is a structural check on that argument (Zod v3 and v4 both expose
  `_def`/`parse`/`safeParse`), which behaves identically in ESM, CJS, Node, Deno, Bun and
  every browser.

  Consequences:
  - **No public signature changes and nothing becomes async.** A dynamic `await import('zod')`
    would have worked too, but `schemaToToolDefinition` and `validateWithSchema` are
    synchronous exports, so it would have forced a breaking change on the whole structured-output
    surface for a value that was never used. Hence `patch`, not `minor`/`major`.
  - `@johnhenry/aimatey-utils` now holds **no runtime reference to `zod` at all** (the remaining
    `import` is type-only). Nothing for a bundler to externalize, and no `zod` code in a bundle
    for consumers who never touch structured output. `zod` stays an optional peer dependency.
  - The error message changed. Passing something that is not a Zod schema now says so
    precisely — naming the parameter and what arrived — and still points at `npm install zod`.
    It covers both causes: Zod absent, and Zod present but a plain object/JSON Schema passed by
    mistake. Previously the second case died with `TypeError: Cannot read properties of
undefined (reading 'typeName')`.
  - `generateObject` and `streamObject` now validate the schema **before** the retry loop and
    before any provider call, so a bad schema costs zero requests instead of `maxRetries` of them.

- Updated dependencies [3467132]
- Updated dependencies [681fa2d]
- Updated dependencies [30629d4]
- Updated dependencies [f8d20bf]
- Updated dependencies [eb8580b]
- Updated dependencies [e800f3d]
- Updated dependencies [582a4e5]
- Updated dependencies [71e5631]
  - @johnhenry/aimatey-types@0.3.0
  - @johnhenry/aimatey-errors@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [6e79fa1]
- Updated dependencies [213b23e]
- Updated dependencies [0ac4957]
  - @johnhenry/aimatey-types@0.2.0
  - @johnhenry/aimatey-errors@0.1.1

## 0.1.0

### Minor Changes

- Republish from current main with a real fresh build.

  The 0.0.0 scope-import publishes (2026-08-26) shipped stale dist output --
  local npm publish without a rebuild, so the tarballs were missing everything
  after mid-July: the OmniRoute/GitHub Models/DashScope/Moonshot/SambaNova/
  Inception providers, litert-lm, the embeddings types module, and the
  provider-default-model fixes. This release republishes every package from
  current main (which also includes the 2026-08-26 audit fixes) via the CI
  release workflow, which always builds fresh before publishing.

### Patch Changes

- Updated dependencies
  - @johnhenry/aimatey-errors@0.1.0
  - @johnhenry/aimatey-types@0.1.0

> Previously published as `ai.matey.utils`, last unscoped version `0.5.0`.

## 0.5.0

### Minor Changes

- 5b44733: July 23 2026 provider refresh, plus a real bug fix.

  **Bug fix (Anthropic)**: Claude Opus 4.7+ (including 4.8) and Claude Sonnet 5 return HTTP 400 if
  `temperature`/`top_p`/`top_k` are set to a non-default value. `AnthropicBackendAdapter` now omits
  these params for those models (new exported `supportsSamplingParams()` helper) and surfaces a
  `parameter-unsupported` `IRWarning` instead of forwarding a request that would be rejected.

  **Default model bumps** (all confirmed stale/deprecated against provider docs as of 2026-07-23):
  - OpenAI: `gpt-5-mini` → `gpt-5.6-terra` (the dated `gpt-5-mini-2025-08-07` snapshot is deprecated,
    shuts down 2026-12-11)
  - Anthropic: `claude-sonnet-4-5-20250929` → `claude-sonnet-5` (Anthropic's current default)
  - xAI: `grok-4.3` → `grok-4.5`
  - Moonshot: `moonshot-v1-8k` → `kimi-k3` (2.8T-param flagship, 1,048,576 context, native
    multimodal - `multiModal`/`maxContextTokens` updated accordingly)
  - Gemini: `gemini-2.0-flash-lite` → `gemini-3.6-flash`

  **Aggregator adapter defaults** (OpenRouter, Fireworks, Together AI route to many vendors' models
  rather than owning a single lineage - their defaults were verified directly against each
  platform's live catalog on 2026-07-23, not assumed):
  - OpenRouter: `anthropic/claude-3-haiku` → `anthropic/claude-haiku-4.5` (Claude 3 Haiku is retired
    on Anthropic's own API and EOL on Bedrock 2026-09-10; `anthropic/claude-haiku-4.5` confirmed
    live via OpenRouter's public `/api/v1/models` endpoint, pricing matches Anthropic's own rate
    exactly)
  - Fireworks AI: `accounts/fireworks/models/llama-v3p1-8b-instruct` →
    `accounts/fireworks/models/deepseek-v4-flash` (confirmed listed on fireworks.ai/models);
    `maxContextTokens` raised 128000 → 1000000 to match
  - Together AI: `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` → `deepseek-ai/DeepSeek-V4-Pro`
    (confirmed listed on together.ai/models); `maxContextTokens` raised 128000 → 1000000 to match

  **Registry additions** (`ai.matey.utils`'s `MODEL_REGISTRY_SEED`): `gpt-5.6-sol/terra/luna`
  (marking the deprecated dated GPT-5/o3 snapshots - `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `o3` -
  `deprecated: true`), `claude-opus-4-8`, `claude-fable-5`, `grok-4.5`, `gemini-3.6-flash`,
  `gemini-3.5-flash-lite`, and a new Moonshot AI section (`kimi-k3`, pricing confirmed via
  OpenRouter's live catalog). Some pricing figures for other brand-new SKUs (Gemini 3.6
  Flash/3.5 Flash-Lite, Grok 4.5, Fable 5, Opus 4.8) are estimates flagged in code comments, not
  independently confirmed - override via `registerModels()` if you have exact numbers.

  **Capability inference** (`ai.matey.core`): adds a `moonshot` family (`kimi`/`moonshot` name
  matching) so Kimi K3 and future Moonshot models get sensible capability defaults instead of
  falling through to nothing.

  **Known gaps, not addressed by this refresh** (see the research thread for detail): whether any
  new inference-speed/open-weight/regional LLM providers outside ai.matey's current 24 are worth
  adding, and the state of MCP/agent-interop/computer-use/prompt-caching/batch-API standardization
  across providers - both remain open follow-up research, not confirmed non-issues.

## 0.4.2

### Patch Changes

- 73aa9f1: Fix broken CJS entry points across the whole package family. Every package declares
  `"type": "module"` for ESM subpath resolution, but shipped `dist/cjs/` builds with no nested
  override - Node walked up to the package root, saw `"type": "module"`, and misinterpreted the
  compiled CommonJS as ESM, so `require("ai.matey.x")` failed with `Cannot find module './y.js'`
  on every package in the family (ESM `import` was unaffected). Each package's build now emits a
  `dist/cjs/package.json` containing `{"type":"commonjs"}` (via a new
  `scripts/fix-cjs-package-json.js` post-build step) to correctly scope the CJS build's module
  type. No source or `exports` map changes - verified via `npm pack` + fresh install against the
  exact repro in #23, both direct `require()` and the `require` export condition on subpaths (e.g.
  `ai.matey.backend.browser/chrome-ai`).

  (#23)

- Updated dependencies [73aa9f1]
  - ai.matey.errors@0.2.1
  - ai.matey.types@0.5.1

## 0.4.1

### Patch Changes

- New LiteRT-LM backend adapter: run Gemma on-device in the browser via WebGPU
  (`@litert-lm/core`, optional peer). Streaming-native with engine caching per model URL,
  AbortSignal cancellation, and semantic-drift warnings for the Web SDK's dropped features
  (sampler params, tools, non-text content). Registry entries for Gemma-4 E2B/E4B. Also:
  node-llama-cpp is now properly declared as an optional peer dependency of
  ai.matey.native.node-llamacpp.

## 0.4.0

### Minor Changes

- d9e1489: July 2026 provider refresh. DeepSeek: V4 generation (`deepseek-v4-flash`/`deepseek-v4-pro`, 1M
  context, 384K output) with image input enabled — the adapter now advertises `multiModal` and
  defaults to `deepseek-v4-flash`; `deepseek-chat`/`deepseek-reasoner` marked deprecated (provider
  retires them 2026-07-24). Registry adds `claude-sonnet-5` (1M context), `gemini-3.5-flash`,
  `gemini-3.1-pro-preview`, `grok-4.3`, `grok-4.20` variants, and `grok-build-0.1`; capability
  inference recognizes the claude-5 and deepseek-v4 families; xAI default model updated off the
  retired `grok-beta`.

## 0.3.0

### Minor Changes

- dae4d01: Embeddings support: `bridge.embed()` / `router.embed()` with batch chunking, dimension
  normalization, and an embed middleware chain; provider implementations for OpenAI, Mistral,
  Gemini, Cohere, Ollama, Together, Fireworks, DeepInfra, NVIDIA, and LM Studio; caching and
  cost-tracking embedding middleware.
- 2912b7d: Introduce a shared, data-driven model registry in `ai.matey.utils` as the single source of truth
  for model metadata (pricing, context windows, capabilities, quality/latency). The registry ships
  with a mid-2026 seed (GPT-5.x/o-series, Claude 4.x, Gemini 2.5/3, Grok, current Mistral/DeepSeek,
  plus embedding models) and is runtime-extensible via `registerModels()` / `overrideModelPricing()`,
  with alias and longest-prefix fallback so new dated snapshots of known families still resolve.

  `ai.matey.core`'s model-pricing API is now a thin delegate over the registry (no API break; legacy
  models keep their prices, marked `deprecated`). Capability inference recognizes current families.
  Cost-tracking middleware consults the registry before provider-level defaults. `useTokenCount`
  consults the registry for context windows. Backend default models updated:
  `claude-3-haiku-20240307` → `claude-sonnet-4-5-20250929` (Anthropic), `gpt-3.5-turbo` →
  `gpt-5-mini` (OpenAI) — note this changes behavior for requests that omit a model. `estimateCost()`
  on both backends now prices the actual requested model. Refreshed `deepseek-chat` pricing.

- b7e2312: Tool-calling helpers (`extractToolCalls`, `createToolResultMessage`, `validateToolArgs`, ...)
  and an agentic loop: `bridge.runTools({ prompt, tools })` executes model-requested tools and
  feeds results back until completion. `bridge.executeIR()` exposes the IR pipeline directly.
- 58ebc03: Streaming tool-call support end-to-end. OpenAI and Anthropic backends now emit `tool_use` IR chunks
  for streamed tool-call deltas (previously dropped with a console warning) and assemble complete
  `ToolUseContent` blocks on the final `done` chunk. The Anthropic backend reports the real
  provider stop reason (previously fabricated, e.g. `max_tokens` streams reported `stop`) and
  captures usage from every `message_delta`. The OpenAI backend folds the trailing
  `stream_options.include_usage` chunk into the done chunk. Frontend adapters re-emit tool deltas in
  native formats (OpenAI index-based `tool_calls` deltas; Anthropic `content_block_start`/
  `input_json_delta` events — the leading text block is now opened lazily so tool-only streams do not
  fabricate an empty text block). `StreamAccumulator` assembles streamed tool calls.

  Note: when tools are streamed, the done chunk's `message.content` is now a structured
  `MessageContent[]` (text + tool_use blocks) rather than a plain string, and finish reasons are now
  truthful (`tool_calls`/`length` where `stop` was previously reported).

### Patch Changes

- Updated dependencies [dae4d01]
- Updated dependencies [e7df1d0]
- Updated dependencies [2912b7d]
- Updated dependencies [78731bb]
- Updated dependencies [b7e2312]
  - ai.matey.types@0.3.0
