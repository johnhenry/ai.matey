---
'@johnhenry/aimatey-middleware': patch
---

Require a target noun in the default `disregard` prompt-injection pattern, which matched
ordinary developer text and threw on it under a bare `createValidationMiddleware({})` (#98).

## The pattern had no object

Every other entry in `DEFAULT_INJECTION_PATTERNS` requires something to be acted on. This
one did not:

```js
/disregard\s+(all|any|previous|above)/i
```

The verb plus a single modifier was the whole test, so all of these were classified as
prompt-injection attacks:

| text | before | after |
| --- | --- | --- |
| `disregard all warnings from the linter` | attack | ok |
| `please disregard any errors in the previous build log` | attack | ok |
| `disregard all of that, I mislabelled the ticket` | attack | ok |
| `you can disregard any files under vendor/` | attack | ok |
| `the parser should disregard any instructions it does not recognise` | attack | ok |

`preventPromptInjection` defaults to `true` and `injectionAction` to `'block'`, so under a
bare `createValidationMiddleware({})` each of those threw a `ValidationError` rather than
reaching the model. `createSecurityMiddleware` defaults the action to `'warn'` (#55), so
there the same sentences produced a spurious warning instead. Neither default changes here.

This is the class of false positive #67 removed - it is the same shape as the bare
`\bDAN\b` and bare `developer\s+mode` patterns that issue fixed, where a token with a
common innocent sense was treated as sufficient evidence on its own. `disregard` was
simply missed at the time, and #81 then rebuilt the sibling `ignore` pattern without
revisiting it.

## The fix

`ignore` and `disregard` are the same attack written two ways, so they are now the same
regex, built once and applied to both verbs. The shape is the two-branch one #81
introduced:

1. **Prior-context branch** - a word referring to the conversation so far (`previous`,
   `prior`, `earlier`, `above`, `preceding`, `foregoing`), any stack of scope words and
   determiners in front of it, and a target noun behind it. The noun is what `disregard`
   was missing, and requiring it is the whole fix.
2. **Scope-only branch** - `all` plus the narrower legacy noun set, so the bare
   `disregard all instructions` shape still lands.

Sharing one builder is deliberate: the two patterns drifting apart is what produced this
bug, and hand-maintaining two copies of the same vocabulary would let it happen again.

### Recall is unchanged or better

Everything the old pattern caught with a real object is still caught, and the vocabulary
#81 added now applies to this verb too - `disregard the above instructions`,
`disregard your previous instructions`, `disregard every previous instruction`,
`disregard earlier instructions` and `disregard these previous instructions` were all
**missed** before and are detected now.

One shape is deliberately given up: `any` no longer reaches the scope-only branch, matching
the restriction `ignore` already had. `the parser should disregard any instructions it does
not recognise` is a real sentence, and `any` still reaches the prior-context branch, so
`disregard any previous instructions` - what an attacker actually writes - is still caught.

### Both halves are tested

`tests/unit/detection-false-positives.test.ts` gains a precision corpus and a recall corpus
for this verb, plus the end-to-end assertion that `createValidationMiddleware({})` stops
throwing on the reported sentences while still throwing on a genuine attempt. Reverting the
pattern alone fails 20 of them - 12 precision, 6 recall, 2 end to end.

The residual is the same one `ignore` documents and does not solve: no regex separates a
user retracting their own instructions from an attacker, because the two sentences are the
same sentence. It stays pinned as a known verdict rather than papered over.

### Cost

`detection-performance.test.ts` measures every pattern in the exported records against
adversarial input, so the new pattern is covered automatically; a `disregard`-prefix corpus
is added because the existing ones contain no `disregard` and would have exercised it only
at its first character. Measured on `'disregard all of the previous '` repeated, the
pattern is linear - 0.018 ms at 15 KB, 0.069 ms at 60 KB, 0.264 ms at 240 KB - and the full
injection record costs 0.26 ms on a 60 KB message, against a 50 ms budget.
