---
'ai.matey.types': minor
'ai.matey.backend': minor
'ai.matey.frontend': minor
'ai.matey.backend.browser': minor
---

Multimodal attachment content types in the IR: `AudioContent`, `DocumentContent`, and
`VideoContent` join the `MessageContent` union, with provider mappings for OpenAI
(`input_audio` for base64 audio; text fallbacks elsewhere), Anthropic (native `document`
blocks), and Gemini (`inline_data`/`file_data` parts). The Chrome AI backend now supports the
Chrome 138+ API surface (`create()`/`availability()`/`params()`) alongside the legacy Chrome
129-137 methods (`createTextSession()`/`capabilities()`), detected at runtime. (#10)
