/**
 * Basic Bridge Example - Monorepo Package Imports
 *
 * This example demonstrates the new monorepo package structure.
 * Each package can be imported directly for optimal bundle sizes.
 */

// New monorepo imports - import only what you need
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Or use the umbrella package for backwards compatibility:
// import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge: OpenAI-compatible frontend -> Anthropic backend
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Make request using OpenAI format
  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log('Response:', response.choices[0].message.content);
}

main().catch(console.error);
