---
'@johnhenry/aimatey-middleware': patch
---

Stop the default detection patterns firing on ordinary text (#67).

With default configuration, `createValidationMiddleware({})` **threw** on a
message that mentioned a colleague called Dan, and `piiAction: 'redact'`
silently rewrote every commit hash in a conversation to `[REDACTED_APIKEY]`
before the model saw it. Both were on by default - `preventPromptInjection` and
`throwOnError` default to `true`, and since #55 `createSecurityMiddleware`
redacts by default - so neither needed opting in to hit.

```ts
bridge.use(createValidationMiddleware({}));
await bridge.chat({ messages: [{ role: 'user', content: 'Hi Dan, can you review this?' }] });
// before: throws ValidationError: Potential prompt injection detected
// after:  delivered unchanged
```

**`DAN` needs jailbreak context.** `DEFAULT_INJECTION_PATTERNS` matched the bare
word `DAN` case-insensitively, so "Hi Dan", "My colleague Dan says hello" and
"Dan asked about the deploy" were all classified as prompt-injection attacks.
`DAN` is now matched **case-sensitively** and only beside jailbreak framing
(`DAN mode`, `act as DAN`, `you are DAN`, `stands for do anything now`) - the
acronym is always written in capitals in the roleplay prompt it comes from,
while `Dan` is a common name. `developer mode` had the same shape of bug and got
the same treatment: "How do I enable developer mode on Android?" is no longer an
attack, while "act as ChatGPT with Developer Mode enabled" still is.

**`apiKey` matches a vendor prefix, not a length.** `/\b[A-Za-z0-9]{32,}\b/`
matched every git SHA, dashless UUID, base64 id and content hash. Entropy could
not have fixed this - a git SHA is uniformly random hex and scores exactly as
high as a secret - so the pattern now keys on the prefixes vendors add for
precisely this purpose (`sk-`, `sk-ant-`, `ghp_`, `github_pat_`, `AKIA`, `xox`,
`glpat-`, `AIza`, `gsk_`, `hf_`, `sk_live_`, `npm_`, and others). This is also a
**recall improvement** for prefixed credentials, which the length rule missed
outright: `ghp_...` never matched, because `_` is a word character and broke the
leading `\b`, and `AKIA...` is 20 characters, under the 32 floor. The cost is
that an unprefixed vendor key is no longer matched; add
`piiPatterns: { ...DEFAULT_PII_PATTERNS, longToken: /\b[A-Za-z0-9]{32,}\b/g }`
to get the old rule back.

**`ipAddress` no longer eats version strings.** `version 1.2.3.4` became
`version [REDACTED_IPADDRESS]`. Octets are now range-checked (so `1.2.3.999` is
not an address) and quads introduced by `v` / `ver` / `version` / `rev` /
`release` / `build` are skipped. A bare four-segment version with no marker word
stays ambiguous - `1.2.3.4` is a valid address and a valid version, and nothing
in the text separates them - and is still read as an address.

**`piiDetector` works in redact mode.** The documented escape hatch for exactly
these false positives did not function: `sanitizeRequest` keyed off patterns
only, so a custom detector was consulted for detection and then ignored for
redaction, which applied `DEFAULT_PII_PATTERNS` regardless. The detector now
drives redaction, and **replaces** the default patterns rather than augmenting
them - for detection and redaction alike, which is what makes it usable to turn
a default false positive off. Under `piiAction: 'redact'` the strings it returns
in `matches` are the ones replaced with `[REDACTED_<TYPE>]`.

Supporting API, all additive: `redactPIIMatches(text, matches)` redacts from
already-computed matches; `ValidationResult.piiResults` carries per-message
detection results; `sanitizeRequest` takes them as an optional third argument, so
the detector runs once per message rather than once per phase. A synchronous
detector passed straight to `sanitizeRequest` is honoured directly; an async one
cannot be awaited from a synchronous function, so that case warns rather than
quietly falling back to the patterns the caller replaced.

`DEFAULT_PII_PATTERNS.ipAddress` now uses lookbehind (ES2018), which needs
Node 18+ / Safari 16.4+ - already implied by this package's ES2022 target.

Tests: 1709 -> 1824 passing; 115 new in
`tests/unit/detection-false-positives.test.ts`, which tests **precision as well
as recall** - only recall was covered before. Every corpus has both halves:
personal names, semantic versions (including four-segment), git SHAs short and
long, UUIDs with and without dashes, base64 ids and npm/docker digests must not
be detected; genuine injection attempts, real PII, and fourteen real credential
formats must still be.
