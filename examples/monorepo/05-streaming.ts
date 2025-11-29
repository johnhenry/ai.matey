/**
 * Streaming Example - Using Stream Utilities
 *
 * Shows streaming support across different packages:
 * - Core streaming types
 * - Stream conversion utilities
 * - Different backend streaming implementations
 */

// Core imports
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

// Stream utilities
import {
  asyncGeneratorToReadableStream,
  readableStreamToAsyncGenerator,
  collectStreamChunks,
} from 'ai.matey.utils';

// Types
import type { IRStreamChunk } from 'ai.matey.types';

async function main() {
  console.log('=== Streaming Examples ===\n');

  // Example 1: Basic async generator streaming
  console.log('1. Async Generator Streaming:');
  await asyncGeneratorExample();

  // Example 2: Different backend streaming
  console.log('\n2. Cross-Provider Streaming:');
  await crossProviderStreamingExample();

  // Example 3: Stream conversion
  console.log('\n3. Stream Conversion (AsyncGenerator <-> ReadableStream):');
  await streamConversionExample();
}

async function asyncGeneratorExample() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    })
  );

  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Count from 1 to 5 slowly, one number per response.',
      },
    ],
    stream: true,
  });

  process.stdout.write('Response: ');
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

async function crossProviderStreamingExample() {
  // OpenAI streaming
  const openaiStream = await streamFromProvider('openai', 'Tell me a very short joke.');
  console.log('OpenAI stream:');
  await printStream(openaiStream);

  // Anthropic streaming
  const anthropicStream = await streamFromProvider('anthropic', 'Tell me a very short joke.');
  console.log('Anthropic stream:');
  await printStream(anthropicStream);
}

async function streamFromProvider(
  provider: 'openai' | 'anthropic',
  prompt: string
): Promise<AsyncGenerator<IRStreamChunk>> {
  const backend =
    provider === 'openai'
      ? new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY || 'sk-...' })
      : new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...' });

  const bridge = new Bridge(new OpenAIFrontendAdapter(), backend);

  return bridge.chatStream({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });
}

async function printStream(stream: AsyncGenerator<IRStreamChunk>) {
  process.stdout.write('  ');
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

async function streamConversionExample() {
  // Create a simple async generator
  async function* simpleGenerator(): AsyncGenerator<IRStreamChunk> {
    const words = ['Hello', ' ', 'from', ' ', 'stream', '!'];
    for (const word of words) {
      yield {
        type: 'content' as const,
        content: word,
        index: 0,
      };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    yield {
      type: 'done' as const,
      finishReason: 'stop',
      index: 0,
    };
  }

  // Convert to ReadableStream
  const readableStream = asyncGeneratorToReadableStream(simpleGenerator());
  console.log('Converted AsyncGenerator to ReadableStream');

  // Convert back to AsyncGenerator
  const backToGenerator = readableStreamToAsyncGenerator<IRStreamChunk>(readableStream);
  console.log('Converted back to AsyncGenerator');

  // Collect all chunks
  const chunks = await collectStreamChunks(backToGenerator);
  console.log('Collected chunks:', chunks.length);

  // Print content
  const content = chunks
    .filter((c): c is IRStreamChunk & { type: 'content' } => c.type === 'content')
    .map((c) => c.content)
    .join('');
  console.log('Final content:', content);
}

main().catch(console.error);
