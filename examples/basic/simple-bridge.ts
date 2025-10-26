/**
 * Simple Bridge Example
 *
 * Shows the most basic usage of ai.matey - connecting OpenAI frontend to Anthropic backend.
 */

import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge: OpenAI format -> Anthropic execution
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Make request using OpenAI format
  const response = await bridge.chat({
    model: 'gpt-4', // Will be mapped to Claude model
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log('Response:', response);
}

main().catch(console.error);
