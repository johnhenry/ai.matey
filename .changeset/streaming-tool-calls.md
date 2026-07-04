---
'ai.matey.backend': minor
'ai.matey.frontend': minor
'ai.matey.utils': minor
---

Streaming tool-call support end-to-end. OpenAI and Anthropic backends now emit `tool_use` IR chunks
for streamed tool-call deltas (previously dropped with a console warning) and assemble complete
`ToolUseContent` blocks on the final `done` chunk. The Anthropic backend reports the real
provider stop reason (previously fabricated, e.g. `max_tokens` streams reported `stop`) and
captures usage from every `message_delta`. The OpenAI backend folds the trailing
`stream_options.include_usage` chunk into the done chunk. Frontend adapters re-emit tool deltas in
native formats (OpenAI index-based `tool_calls` deltas; Anthropic `content_block_start`/
`input_json_delta` events — the leading text block is now opened lazily so tool-only streams do not
fabricate an empty text block). `StreamAccumulator` assembles streamed tool calls.

Note: when tools are streamed, the done chunk's `message.content` is now a structured
`MessageContent[]` (text + tool_use blocks) rather than a plain string, and finish reasons are now
truthful (`tool_calls`/`length` where `stop` was previously reported).
