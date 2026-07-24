/**
 * Structured Output Example
 *
 * Request schema-constrained JSON output via `responseFormat`. OpenAI,
 * Anthropic, and Gemini map this to their native structured-output
 * mechanisms; every other backend falls back to prompt injection + JSON
 * extraction. See docs/IR-FORMAT.md#structured-output for the full matrix.
 *
 * `responseFormat` is an IR-level field - none of the client-facing frontend
 * formats (OpenAI, Anthropic, ...) currently translate their own
 * structured-output syntax into it, so this uses `bridge.executeIR()` to pass
 * an `IRChatRequest` straight through, bypassing frontend translation.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  const response = await bridge.executeIR({
    messages: [
      {
        role: 'user',
        content: 'Extract the name and age from: John is 30.',
      },
    ],
    responseFormat: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      },
    },
    parameters: { model: 'claude-sonnet-5' },
    metadata: {
      requestId: 'req_1',
      timestamp: Date.now(),
      provenance: { frontend: 'openai' },
    },
  });

  console.log('Response:', response);
  // response.message.content -> '{"name":"John","age":30}'
  // response.metadata.custom.responseFormatEnforced -> true (native) or false (fallback)
}

main().catch(console.error);
