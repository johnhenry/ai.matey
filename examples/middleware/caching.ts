/**
 * Caching Middleware Example
 *
 * Shows how to cache responses to reduce API calls and costs.
 */

import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend';
import { createCachingMiddleware, InMemoryCacheStorage } from '@johnhenry/aimatey-middleware';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add caching middleware.
  //
  // `unidentified: 'share'` because this script is a single-user demo: every
  // request comes from the same person, so one shared cache is correct. A
  // server answering for many users passes each caller's identity instead
  // (`bridge.chat(request, { principal: userId })`) and leaves this off.
  bridge.use(
    createCachingMiddleware({
      storage: new InMemoryCacheStorage(),
      unidentified: 'share',
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
