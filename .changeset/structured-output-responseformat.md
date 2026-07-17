---
'ai.matey.types': minor
'ai.matey.backend': minor
---

Add `responseFormat` to the IR request for per-provider structured/schema-constrained
output. `IRChatRequest.responseFormat` (`{ type: 'json_schema', schema, strict? }`) reuses
the existing `JSONSchema` type. OpenAI, Anthropic, Gemini, and their OpenAI-compatible
inheritors (Groq, DeepSeek, Inception, Moonshot, NVIDIA, LM Studio, SambaNova) map it to
their native structured-output mechanism; all other backends emulate it via prompt
injection and best-effort JSON extraction. `IRCapabilities.structuredOutput` and
`response.metadata.custom.responseFormatEnforced` let callers tell which path was used.
(#16)
