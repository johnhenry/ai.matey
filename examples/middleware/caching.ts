/**
 * Caching Middleware Example
 *
 * Shows how to cache responses to reduce API calls and costs.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { AnthropicBackendAdapter } from 'ai.matey.backend';
import { createCachingMiddleware, InMemoryCacheStorage } from 'ai.matey.middleware';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add caching middleware
  bridge.use(
    createCachingMiddleware({
      storage: new InMemoryCacheStorage(),
      ttl: 3600, // 1 hour
      shouldCache: (request) => !request.stream, // Don't cache streaming requests
    })
  );

  console.log('First request (will hit API)...');
  const start1 = Date.now();
  const response1 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2?',
      },
    ],
  });
  const duration1 = Date.now() - start1;
  console.log(`Response: ${response1.choices[0].message.content}`);
  console.log(`Duration: ${duration1}ms\n`);

  console.log('Second request (will use cache)...');
  const start2 = Date.now();
  const response2 = await bridge.chat({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2?',
      },
    ],
  });
  const duration2 = Date.now() - start2;
  console.log(`Response: ${response2.choices[0].message.content}`);
  console.log(`Duration: ${duration2}ms (cached!)\n`);

  console.log(`Speedup: ${(duration1 / duration2).toFixed(2)}x faster`);
}

main().catch(console.error);
