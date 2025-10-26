/**
 * Reverse Bridge Example
 *
 * Use Anthropic format with OpenAI backend - swap the frontend/backend!
 */

import { Bridge, AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge: Anthropic format -> OpenAI execution
  const bridge = new Bridge(
    new AnthropicFrontendAdapter(),
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    })
  );

  // Make request using Anthropic format
  const response = await bridge.chat({
    model: 'claude-3-5-sonnet-20241022', // Will be mapped to GPT model
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Explain quantum computing in simple terms.',
      },
    ],
  });

  console.log('Response:', response);
}

main().catch(console.error);
