---
'ai.matey.backend': minor
'ai.matey.frontend': minor
---

Complete non-streaming tool-calling support. The OpenAI backend now sends `tools`/`tool_choice`,
converts assistant `tool_use` blocks to `tool_calls`, expands `tool_result` blocks into
`role: 'tool'` messages, and parses `tool_calls` from responses (malformed arguments degrade to
`{}`). The Anthropic backend now sends `tools`/`tool_choice`. Frontend adapters accept
`tools`/`tool_choice` in their native formats and round-trip tool calls and tool results through
the IR. OpenAI streaming requests now request usage accounting via `stream_options.include_usage`.
