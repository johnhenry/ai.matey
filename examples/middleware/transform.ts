/**
 * Transform Middleware Example
 *
 * Shows how to transform requests and responses.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createTransformMiddleware, createSystemMessageInjector } from 'ai.matey.middleware/transform';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add transform middleware to inject system message
  bridge.use(
    createTransformMiddleware({
      transformRequest: createSystemMessageInjector(
        'You are a pirate. Always respond in pirate speak with "Arrr" and nautical terms.'
      ),
    })
  );

  console.log('Making request with automatic system message injection...\n');

  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Tell me about the weather today.',
      },
    ],
  });

  console.log('Response (in pirate speak!):');
  console.log(response.choices[0].message.content);
}

main().catch(console.error);
