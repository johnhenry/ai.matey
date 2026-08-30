---
'@johnhenry/aimatey-middleware': minor
---

Fix a reachable denial of service in the default `email` PII pattern (#80) and detect
`"ignore all previous instructions"`, the canonical prompt injection, which the default
injection pattern missed (#81).

Both defaults run on every user message under a default configuration - since #55
`createSecurityMiddleware()` redacts by default and wires in injection detection - so
neither of these was a latent edge case.

## The email pattern was quadratic (#80)

`/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g` matched its local-part class
greedily from every starting position, scanned forward for an `@`, failed, backtracked and
restarted one character along. On text with no `@` in it at all the work was O(n²):

| input (`'1.1.1'` repeated) | before | after |
| --- | --- | --- |
| 10 KB | 37 ms | 0.04 ms |
| 20 KB | 152 ms | 0.07 ms |
| 40 KB | 640 ms | 0.15 ms |
| 60 KB | 1504 ms | 0.22 ms |

Doubling the input quadrupled the time. Node is single-threaded per process, so a 60 KB
message did not make one request slow, it blocked every concurrent request on the instance
for a second and a half - and the payload is version strings, which looks like nothing.

The match is now anchored to the start of a run of local-part characters with a lookbehind.
`@` is not a local-part character, so if the maximal run is not followed by `@`, no shorter
suffix of it is either: every restart inside a run is provably wasted work. Stating that
invariant lets the engine examine each run once. Cost is now linear - 240 KB measures 4x
60 KB rather than 16x.

Bounding the local part at RFC 5321's 64 octets, the other option on the issue, was measured
and rejected: it only bounds the blowup (~8 ms on the same input, 40x worse than this) and
it silently stops matching over-long local parts instead of redacting them.

**The other default patterns were audited the same way.** Worst case at 60 KB across eleven
adversarial corpora, after: `email` 0.23 ms, `ipAddress` 0.32 ms, `phone` 0.25 ms, `apiKey`
0.12 ms, `ssn` 0.09 ms, `creditCard` 0.02 ms, and every injection pattern at or below
0.10 ms. `phone` and `ssn` had never been measured before; both are fine. Nothing else needed
changing.

`tests/unit/detection-performance.test.ts` now enforces this. It iterates the exported
pattern records rather than a hard-coded list, so a pattern added later is measured
automatically, and it asserts the *shape* of the cost curve (4x input must cost under 10x,
where linear is 4x and quadratic is 16x) as well as an absolute budget - a correctness test
cannot catch a pattern that finds exactly the right answer while taking 1.5 s to do it, and
the shape assertion additionally catches a quadratic pattern that happens to stay under the
budget at 60 KB but would not at 600 KB.

Also corrects the TLD class, which was `[A-Z|a-z]`. The `|` was a literal member of the
character class, so `foo@bar.|a` was reported as an email address.

## The canonical injection string was not detected (#81)

`ignore\s+(previous|above|all)\s+(instructions|prompts?|commands?)` accepted exactly one of
`previous` / `above` / `all` and then required the noun immediately. `"ignore all previous
instructions"` stacks two of them, so the phrasing that appears in essentially every
published injection example did not match, while the variants an attacker is less likely to
use did:

```
"ignore previous instructions"      -> true
"ignore all previous instructions"  -> false   <-- the canonical form
"ignore all instructions"           -> true
"ignore above instructions"         -> true
```

Now detected: `all previous`, `any previous`, `the previous`, `these previous`, `your
previous`, `all your previous`, `all of the previous`, `all prior`, `every previous`,
`earlier`, `preceding`, `foregoing`, and the `rules`, `directives` and `guidelines` nouns.

**Precision was tested as deliberately as recall**, which is the whole point of #67. The
pattern is two branches over named vocabulary lists: one requires a word referring to the
conversation so far, and one is byte-for-byte the noun set the old pattern accepted after a
bare `all`. Keeping them separate is what protects precision - a scope word on its own is
not a signal. `"ignore all whitespace when comparing"`, `"How do I make eslint ignore all
rules in one file?"` and `"we ignore every prompt token past the limit"` are ordinary things
to ask a coding assistant, and none of them match: `rules` is not in the legacy noun set and
`every` is not in the legacy branch. 18 such sentences are pinned as must-not-match beside
22 must-match attacks, and every false-positive case from #67 still passes.

Measured before shipping, as #81 asked: 0.07 ms on 60 KB of adversarial input against the
old pattern's 0.03 ms, linear to 240 KB.

One residual is pinned rather than fixed: `"you can ignore the previous instructions I gave
you, I was wrong"` is a genuine user and now matches, because catching `the previous` -
which the issue asked for by name - necessarily brings it along. No regex separates those
two sentences. That is an argument for the `'warn'` default `createSecurityMiddleware`
already chose (#55), which is **unchanged**, not for a cleverer pattern.

## Why `minor` rather than `patch`

Nothing is added, removed or renamed, and no signature changes - `DEFAULT_PII_PATTERNS` and
`DEFAULT_INJECTION_PATTERNS` keep their exact types. #67 shipped a comparable detector change
as `patch`.

But #67 made the detectors fire *less*, which can only turn a throw into a pass. This makes
one of them fire *more*, and under `createValidationMiddleware({})` a prompt-injection match
throws by default. A message that got through yesterday can be rejected today, and a caller
whose traffic contains phrasing like `"ignore the previous instructions"` will see new
`ValidationError`s from a version bump they read as a defect repair. That is observable
behaviour, not a bug fix, so it takes the bump that says so.

Tests: 2218 -> 2465 passing, 95 files. Reverting the email pattern alone fails 11; reverting
the injection pattern alone fails 19.
