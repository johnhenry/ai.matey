# ai.matey.backend.browser

## 0.5.0

### Minor Changes

- 19f5982: Rewrite `ChromeAIBackendAdapter` to target Chrome's modern Prompt API (`LanguageModel` global,
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

## 0.4.0

### Minor Changes

- New LiteRT-LM backend adapter: run Gemma on-device in the browser via WebGPU
  (`@litert-lm/core`, optional peer). Streaming-native with engine caching per model URL,
  AbortSignal cancellation, and semantic-drift warnings for the Web SDK's dropped features
  (sampler params, tools, non-text content). Registry entries for Gemma-4 E2B/E4B. Also:
  node-llama-cpp is now properly declared as an optional peer dependency of
  ai.matey.native.node-llamacpp.

### Patch Changes

- Updated dependencies
  - ai.matey.utils@0.4.1

## 0.3.0

### Minor Changes

- 7b80cb3: Multimodal attachment content types in the IR: `AudioContent`, `DocumentContent`, and
  `VideoContent` join the `MessageContent` union, with provider mappings for OpenAI
  (`input_audio` for base64 audio; text fallbacks elsewhere), Anthropic (native `document`
  blocks), and Gemini (`inline_data`/`file_data` parts). The Chrome AI backend now supports the
  Chrome 138+ API surface (`create()`/`availability()`/`params()`) alongside the legacy Chrome
  129-137 methods (`createTextSession()`/`capabilities()`), detected at runtime. (#10)

### Patch Changes

- Updated dependencies [7b80cb3]
  - ai.matey.types@0.4.0
