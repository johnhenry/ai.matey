---
'ai.matey.frontend': patch
'ai.matey.types': patch
---

Remove vestigial `ai.matey.backend` runtime dependency from `ai.matey.frontend` (frontend adapters
never imported it). Document `StreamToolUseChunk` delta semantics and add an optional `index` field
identifying the tool call's position within the assistant message.
