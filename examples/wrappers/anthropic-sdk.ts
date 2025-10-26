/**
 * Anthropic SDK Wrapper Example
 *
 * Use ai.matey's Anthropic SDK wrapper to switch backends.
 */

import { Anthropic } from 'ai.matey/wrappers';
import { Bridge, AnthropicFrontendAdapter, OpenAIBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge with OpenAI backend
  const bridge = new Bridge(
    new AnthropicFrontendAdapter(),
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    })
  );

  // Create Anthropic SDK-compatible client
  // This looks like Anthropic SDK but uses OpenAI backend!
  const client = new Anthropic({
    bridge,
    apiKey: 'unused', // Not needed, bridge handles auth
  });

  console.log('Using Anthropic SDK API with OpenAI backend...\n');

  // Standard Anthropic SDK call - but powered by OpenAI!
  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Explain what a software adapter pattern is.',
      },
    ],
  });

  console.log('Response:');
  console.log(message.content[0].text);

  console.log('\nStreaming example...');

  // Streaming also works
  const stream = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Write a short poem about bridges.',
      },
    ],
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }

  console.log('\n\nDone!');
}

main().catch(console.error);
