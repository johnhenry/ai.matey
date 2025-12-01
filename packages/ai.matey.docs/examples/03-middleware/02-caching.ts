/**
 * Caching Middleware - Response Caching for Performance
 *
 * Demonstrates:
 * - Adding caching middleware to avoid redundant API calls
 * - Configuring cache TTL (time-to-live)
 * - Cache key generation strategies
 * - Measuring performance improvements
 * - Cost savings from caching
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - ai.matey.middleware package installed
 *
 * Run:
 *   npx tsx examples/03-middleware/02-caching.ts
 *
 * Expected Output:
 *   Two identical requests - first hits API, second serves from cache
 *   with dramatic speed improvement (milliseconds vs seconds).
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createCachingMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Caching Middleware',
    'Cache AI responses to improve performance and reduce costs',
    [
      'ANTHROPIC_API_KEY environment variable',
      'ai.matey.middleware package installed'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create bridge
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add caching middleware with configuration
    console.log('💾 Configuring caching middleware...\n');

    bridge.use(
      createCachingMiddleware({
        ttl: 3600,                    // Cache for 1 hour (in seconds)
        maxSize: 100,                 // Store up to 100 responses
        keyGenerator: (request) => {   // Custom cache key generation
          return JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
          });
        },
      })
    );

    console.log('✓ Caching middleware configured');
    console.log('  - TTL: 1 hour');
    console.log('  - Max size: 100 responses');
    console.log('  - Key: model + messages + temperature\n');

    const testRequest = {
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain caching in software systems in 2 sentences.',
        },
      ],
      temperature: 0.7,
      max_tokens: 100
    };

    // First request - will hit the API
    console.log('═'.repeat(60));
    console.log('Request #1: First request (cache MISS)');
    console.log('═'.repeat(60) + '\n');

    const start1 = Date.now();
    const response1 = await bridge.chat(testRequest);
    const duration1 = Date.now() - start1;

    console.log('📝 Response:');
    console.log('─'.repeat(60));
    console.log(response1.choices[0].message.content);
    console.log('─'.repeat(60));
    console.log(`⏱️  Duration: ${duration1}ms\n`);

    if (response1.usage) {
      console.log('📊 Token Usage:');
      console.log(`   Prompt: ${response1.usage.prompt_tokens}`);
      console.log(`   Completion: ${response1.usage.completion_tokens}`);
      console.log(`   Total: ${response1.usage.total_tokens}\n`);
    }

    // Second identical request - will use cache
    console.log('═'.repeat(60));
    console.log('Request #2: Identical request (cache HIT)');
    console.log('═'.repeat(60) + '\n');

    const start2 = Date.now();
    const response2 = await bridge.chat(testRequest);
    const duration2 = Date.now() - start2;

    console.log('📝 Response (from cache):');
    console.log('─'.repeat(60));
    console.log(response2.choices[0].message.content);
    console.log('─'.repeat(60));
    console.log(`⏱️  Duration: ${duration2}ms\n`);

    // Performance comparison
    console.log('📈 Performance Comparison:');
    console.log('─'.repeat(60));
    console.log(`First request:  ${duration1}ms (API call)`);
    console.log(`Second request: ${duration2}ms (cached)`);
    console.log(`Speedup:        ${(duration1 / duration2).toFixed(1)}x faster`);
    console.log(`Time saved:     ${duration1 - duration2}ms\n`);

    // Cost savings
    if (response1.usage) {
      const tokensPerRequest = response1.usage.total_tokens;
      const estimatedCostPerToken = 0.00003; // Example: $0.03 per 1K tokens
      const costPerRequest = tokensPerRequest * estimatedCostPerToken;

      console.log('💰 Cost Savings:');
      console.log(`   First request:  ~$${costPerRequest.toFixed(6)}`);
      console.log(`   Second request: $0 (cached)`);
      console.log(`   Saved:          ~$${costPerRequest.toFixed(6)}\n`);
      console.log(`   Note: With 1000 cached requests, save ~$${(costPerRequest * 1000).toFixed(2)}\n`);
    }

    console.log('💡 Benefits of Caching Middleware:');
    console.log('   ✓ Dramatically faster responses (10-100x)');
    console.log('   ✓ Reduced API costs (no tokens used)');
    console.log('   ✓ Lower rate limit usage');
    console.log('   ✓ Better user experience (instant responses)');
    console.log('   ✓ Works automatically with all requests');
    console.log('   ✓ Configurable TTL and cache size\n');

    console.log('🔧 Advanced Configuration Options:');
    console.log('   • storage: in-memory, Redis, or custom');
    console.log('   • ttl: per-request or global TTL');
    console.log('   • keyGenerator: custom cache key logic');
    console.log('   • maxSize: maximum cache entries');
    console.log('   • invalidation: manual or automatic cache clearing\n');

    console.log('⚠️  Cache Considerations:');
    console.log('   • Only cache deterministic requests (temperature=0)');
    console.log('   • Be mindful of sensitive data in responses');
    console.log('   • Monitor cache hit rates for optimization');
    console.log('   • Consider distributed caching for scaling\n');

  } catch (error) {
    displayError(error, 'Caching middleware example');
    process.exit(1);
  }
}

main();
