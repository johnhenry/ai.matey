/**
 * Streaming Example
 *
 * Shows how to use streaming responses with ai.matey.
 */

import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  console.log('Streaming response:');
  console.log('---');

  // Request with streaming enabled
  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Write a haiku about coding.',
      },
    ],
    stream: true,
  });

  // Process stream chunks
  for await (const chunk of stream) {
    if (chunk.choices?.[0]?.delta?.content) {
      process.stdout.write(chunk.choices[0].delta.content);
    }
  }

  console.log('\n---');
  console.log('Stream complete!');
}

main().catch(console.error);
