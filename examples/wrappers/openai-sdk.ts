/**
 * OpenAI SDK Wrapper Example
 *
 * Use ai.matey's OpenAI SDK wrapper to switch backends without changing code.
 */

import { OpenAI } from 'ai.matey.wrapper/openai';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

async function main() {
  // Create bridge with Anthropic backend
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Create OpenAI SDK-compatible client
  // This looks like OpenAI SDK but uses your bridge!
  const client = new OpenAI({
    bridge,
    apiKey: 'unused', // Not needed, bridge handles auth
  });

  console.log('Using OpenAI SDK API with Anthropic backend...\n');

  // Standard OpenAI SDK call - but powered by Anthropic!
  const completion = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: 'What is the speed of light?',
      },
    ],
    temperature: 0.7,
    max_tokens: 150,
  });

  console.log('Response:');
  console.log(completion.choices[0].message.content);

  console.log('\nStreaming example...');

  // Streaming also works
  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Count from 1 to 5',
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
  }

  console.log('\n\nDone!');
}

main().catch(console.error);
