/**
 * Logging Middleware Example
 *
 * Shows how to add logging to track requests and responses.
 */

import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  createLoggingMiddleware,
} from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add logging middleware
  bridge.use(
    createLoggingMiddleware({
      level: 'info',
      logRequests: true,
      logResponses: true,
      logErrors: true,
      redactFields: ['apiKey', 'api_key', 'authorization'],
    })
  );

  console.log('Making request with logging...\n');

  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What are the three laws of robotics?',
      },
    ],
  });

  console.log('\nFinal response:', response.choices[0].message.content);
}

main().catch(console.error);
