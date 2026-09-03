---
'@johnhenry/aimatey-utils': patch
---

Refresh the model registry seed to 2026-09-03 (65 -> 87 entries, 25 -> 33 deprecated).

Six weeks of releases and price changes were missing, and the previous pass had seeded
several numbers it explicitly marked as estimates. Those estimates turned out to be wrong.
Nothing was deleted: the id set after this change is a strict superset of the id set before
it, and every newly-deprecated entry keeps its prices for historical cost tracking.

## The corrections that were costing money

| Entry | Was | Now | Effect of the old value |
| --- | --- | --- | --- |
| `claude-sonnet-5` | $3 / $15 / $0.30 | $2 / $10 / $0.20 | Over-priced the mainstream Sonnet model by 50% |
| `claude-fable-5-1` | *missing* | $10 / $50 / $0.25 | Prefix-matched onto `claude-fable-5`, billing cache reads at 4x |
| `claude-3-5-haiku-20241022` | $1 / $5 | $0.80 / $4 / $0.08 | Haiku 4.5's price on a Haiku 3.5 entry |
| `claude-opus-4-8` context | 200K / 64K out | 1M / 128K out | Understated the window by 5x |
| `grok-4.5` | 1M, $1.25 / $2.50 | 500K, $2 / $6 / $0.30 | Under-billed output 2.4x, overstated context 2x |
| `gemini-3.6-flash` | $1.20 / $7.50 | $0.75 / $3.75 | Estimate, ~60% high |
| `gemini-3.5-flash-lite` output | $1.50 | $2.50 | Estimate, 40% low |
| `deepseek-v4-flash` / `-pro` | pre-2026-08-16 | peak rates | Repriced by DeepSeek 2026-08-16 |
| Mistral `-latest` aliases | four retired models | current models | `mistral-small-latest` priced a model retired 2025-11-30 |

`claude-sonnet-5` is the single highest-value fix: the file had bet on an increase to $3/$15
on 2026-09-01, and Anthropic's pricing page now states the $2/$10 launch pricing "is now the
standard price" and that the scheduled increase "will not occur".

The Mistral alias migration is a live lookup bug rather than a staleness nit. Lookup resolves
exact, then alias, then longest prefix, so `mistral-small-latest` resolved to a retired
model's 32000-token window and $0.10/$0.30 prices. All four `-latest` aliases were moved onto
current models; three are backed by the verbatim `apiNames` arrays in Mistral's docs repo, and
the fourth (`codestral-latest` -> `codestral-2508`) is an inference flagged as such in the file.

## A capability flag that produced HTTP 400s

`deepseek-v4-flash` and `-pro` carried `vision: true`. DeepSeek's vision guide now states that
only vision models accept images and that others return a 400, so capability-based routing was
selecting a model guaranteed to fail on an image request. Both are now `vision: false`, and a
new `deepseek-v4-flash-vision-exp` entry carries the capability. The old flag was *sourced* in
July; the provider changed the rule.

## What the schema cannot express

Five pricing axes are now in live use that `{ inputPer1M, outputPer1M, cachedInputPer1M }`
cannot represent. Each is recorded as an inline comment next to the affected entry:

- **Whole-request tier repricing** (xAI): a request whose prompt reaches 200k bills at the
  higher rate for *all* tokens, so the flat field always under-bills such calls by exactly 2x.
- **Marginal long-context bands** (OpenAI >272K, Gemini >200k).
- **Modality-tiered input**: `gemini-embedding-2` spans $0.20 text to $12.00 video.
- **Peak / off-peak** (DeepSeek, off-peak exactly half). Peak is seeded so cost tracking
  cannot under-report.
- **Time-boxed pricing**: `gpt-5.6-sol` is promotional "at least through November 21, 2026",
  and the three Gemini Flash entries are at half rate through 2026-12-31.

## latency and qualityScore are omitted on all 22 new entries

No provider publishes either quantity on any page checked. The existing values are
hand-authored routing heuristics -- `gpt-5.6-sol`'s latency is byte-identical to `gpt-5.1`'s,
p95 sits at a near-constant 2.2-2.5x p50 file-wide, and no seed or refresh commit mentions
measuring them. Inheriting a sibling's values was considered and rejected: the existing
Anthropic ladder is provably inverted against Anthropic's published ordering (the file has
Fable faster than Opus; Anthropic ranks Fable "Slower" and Opus "Moderate"), so inheritance
would launder a known defect through a fresh citation. The header now records the omission as
deliberate so the next refresh does not helpfully fill it in.

## Sources

First-party provider pages only. OpenAI: model pages for gpt-5.6-sol/terra/luna/cyber,
gpt-5.5/5.4/5.2, the pricing page, changelog and deprecations table. Anthropic: the models
overview, per-model overview pages for opus-4-8 and fable-5, the pricing page and
model-deprecations. Google: Gemini API pricing, changelog, deprecations and DeepMind model
cards. xAI: docs.x.ai model pages, the models table and the May-15 retirement migration guide.
Mistral: the pricing page, model cards, the vision capability page and the models overview
legacy table. DeepSeek: pricing, updates and the vision guide. Moonshot: platform.kimi.ai
pricing and models pages (platform.moonshot.ai now 301-redirects there).

Numbers with no first-party page behind them were left untouched rather than adjusted from
memory, and are listed in the pull request.
