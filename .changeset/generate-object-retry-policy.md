---
'@johnhenry/aimatey-utils': minor
---

Stop `generateObject` spending its whole retry budget re-asking a question that has already
been answered, and make the retries it does spend worth something.

`createGenerateObject` treated *every* failure as retryable. The request was re-sent
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
that conforms to the JSON Schema it was *actually given*, and a lossy Zod → JSON Schema
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

This compares *payloads*, not error sets. Zod issues carry no input value, so `'x'` and
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
and `NaN` made *zero* provider calls before throwing a generic error while `Infinity`
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
   covering a *retry* needs the whole sequence re-recorded. `repairPrompt: false` restores
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
   identical retries this replaces were cache *hits*; an informed retry is a miss. A
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
