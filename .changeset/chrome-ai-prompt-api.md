---
'ai.matey.backend.browser': minor
---

Rewrite `ChromeAIBackendAdapter` to target Chrome's modern Prompt API (`LanguageModel` global,
Chrome 138+) instead of the now-defunct pre-138 origin-trial API (`window.ai.languageModel`).

- Multi-turn history (including system messages) maps onto `initialPrompts`; the final message
  becomes the `prompt()`/`promptStreaming()` call.
- `responseFormat.schema` maps to the Prompt API's `responseConstraint`, reported via
  `capabilities.structuredOutput: 'native'` and `response.metadata.custom.responseFormatEnforced`.
- New `checkAvailability()` method exposes the modern tri-state
  (`unavailable`/`downloadable`/`downloading`/`available`) directly, with `healthCheck()` kept as
  a boolean convenience wrapper. An optional `onDownloadProgress` config callback surfaces model
  download progress.
- `session.inputUsage`/`inputQuota` are surfaced under `metadata.custom` rather than fabricating
  an `IRUsage` split the API doesn't provide.
- Dropped `tools`, non-text content, and a non-`user`-final-turn each surface an `IRWarning`
  instead of silently misbehaving.

(#21)
