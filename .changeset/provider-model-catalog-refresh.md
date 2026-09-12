---
'@johnhenry/aimatey-backend': patch
---

Refresh the default OpenAI/Anthropic/Gemini model catalogs and add current-generation Azure OpenAI pricing entries.

**Retired/retiring model IDs removed from `DEFAULT_OPENAI_MODELS`**: `gpt-4o`, `gpt-4o-mini`,
`gpt-4-turbo`, `gpt-3.5-turbo` are all on OpenAI's own retirement schedule (some already
unreachable, the rest by Oct/Dec 2026). Replaced with `gpt-6-astra`, OpenAI's current flagship,
alongside the existing `gpt-5.6-sol`/`terra`/`luna` tier.

**`DEFAULT_ANTHROPIC_MODELS` updated to the current lineup**: added `claude-fable-5-1` (current
top tier), `claude-opus-5`, and `claude-haiku-4-5-20251001` (used elsewhere in this adapter as the
runtime default, but was missing from this catalog entirely - a real inconsistency). Removed
confirmed-retired snapshots: `claude-3-5-sonnet-20241022` (retired 2025-10-28),
`claude-3-5-haiku-20241022` (retired 2026-02-19), `claude-sonnet-4-20250522` and
`claude-opus-4.1-20250805` (both deprecated/retiring). `claude-opus-4.5-20251124` and
`claude-sonnet-4.5-20250929` are kept since they're still served, one generation behind current.

**`DEFAULT_GEMINI_MODELS`**: removed `gemini-2.0-flash`/`gemini-2.0-flash-lite` (shut down
2026-06-01 per Google's own migration guidance). `gemini-3-pro` renamed to `gemini-3.1-pro`,
the current agentic/coding flagship. Left `gemini-2.5-flash`/`gemini-2.5-pro` in place -
Google's own deprecation page has flip-flopped on a 2.5 shutdown date, so removing them now would
be guessing, not verifying.

**Azure OpenAI's `estimateCost()` pricing table**: added entries for `gpt-6-astra` and the
`gpt-5.6-*` family. The existing `gpt-4o`/`gpt-4-turbo`/etc. entries and the `gpt-4o` default
deployment-name fallback are deliberately left alone - Azure deployment IDs are arbitrary names
the resource owner chose, not a selectable provider model list, so an older deployment may well
still be named `gpt-4o` long after OpenAI's own API retires that name (same reasoning already
documented in the provider-default-model-fixes changeset).

Not touched: Mistral's default catalog. Research on Mistral's exact current model IDs was
aggregator-sourced rather than verified against Mistral's own docs, so no changes were made there
rather than guess.
