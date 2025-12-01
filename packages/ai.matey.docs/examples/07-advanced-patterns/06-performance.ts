/**
 * Performance Optimization - Speed and Efficiency
 *
 * Demonstrates:
 * - Caching strategies for AI responses
 * - Request batching and deduplication
 * - Parallel processing techniques
 * - Memory management
 * - Benchmarking and profiling
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs
 * - Understanding of performance optimization
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/06-performance.ts
 *
 * Expected Output:
 *   Performance benchmarks and optimization techniques.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createCachingMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

class PerformanceBenchmark {
  private results: Array<{ name: string; duration: number }> = [];

  async measure(name: string, fn: () => Promise<any>) {
    const start = Date.now();
    await fn();
    const duration = Date.now() - start;
    this.results.push({ name, duration });
    return duration;
  }

  report() {
    console.log('\n📊 Performance Report:');
    console.log('═'.repeat(60));
    this.results.forEach((r, i) => {
      const bar = '█'.repeat(Math.floor(r.duration / 100));
      console.log(`${i + 1}. ${r.name.padEnd(40)} ${r.duration.toString().padStart(6)}ms  ${bar}`);
    });
    console.log('═'.repeat(60) + '\n');
  }
}

async function main() {
  displayExampleInfo(
    'Performance Optimization',
    'Speed up AI applications with caching and batching',
    [
      'ANTHROPIC_API_KEY in web.env.local.mjs',
      'Performance monitoring tools'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');
    const benchmark = new PerformanceBenchmark();

    // Benchmark 1: Without caching
    console.log('\n🔍 Benchmark 1: Without Caching\n');

    const bridge1 = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    const testQuery = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      max_tokens: 20,
    };

    // First request
    const duration1a = await benchmark.measure('No cache - Request 1', async () => {
      await bridge1.chat(testQuery);
    });
    console.log(`✓ Request 1: ${duration1a}ms\n`);

    // Second identical request
    const duration1b = await benchmark.measure('No cache - Request 2 (same)', async () => {
      await bridge1.chat(testQuery);
    });
    console.log(`✓ Request 2 (identical): ${duration1b}ms\n`);

    // Benchmark 2: With caching
    console.log('🔍 Benchmark 2: With Caching\n');

    const bridge2 = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    bridge2.use(
      createCachingMiddleware({
        ttl: 3600, // 1 hour
        maxSize: 100,
      })
    );

    // First request (cache miss)
    const duration2a = await benchmark.measure('With cache - Request 1', async () => {
      await bridge2.chat(testQuery);
    });
    console.log(`✓ Request 1 (cache MISS): ${duration2a}ms\n`);

    // Second identical request (cache hit)
    const duration2b = await benchmark.measure('With cache - Request 2 (HIT)', async () => {
      await bridge2.chat(testQuery);
    });
    console.log(`✓ Request 2 (cache HIT): ${duration2b}ms\n`);

    const speedup = (duration2a / duration2b).toFixed(1);
    console.log(`🚀 Cache speedup: ${speedup}x faster!\n`);

    // Benchmark 3: Parallel processing
    console.log('🔍 Benchmark 3: Parallel vs Sequential\n');

    const queries = [
      'What is 1+1?',
      'What is 2+2?',
      'What is 3+3?',
      'What is 4+4?',
    ];

    // Sequential
    const durationSeq = await benchmark.measure('Sequential (4 requests)', async () => {
      for (const query of queries) {
        await bridge1.chat({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: query }],
          max_tokens: 10,
        });
      }
    });
    console.log(`✓ Sequential: ${durationSeq}ms\n`);

    // Parallel
    const durationPar = await benchmark.measure('Parallel (4 requests)', async () => {
      await Promise.all(
        queries.map((query) =>
          bridge1.chat({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: query }],
            max_tokens: 10,
          })
        )
      );
    });
    console.log(`✓ Parallel: ${durationPar}ms\n`);

    const parallelSpeedup = (durationSeq / durationPar).toFixed(1);
    console.log(`🚀 Parallel speedup: ${parallelSpeedup}x faster!\n`);

    // Show full report
    benchmark.report();

    console.log('💡 Optimization Techniques:\n');
    console.log('   ✓ Cache frequent queries (10-100x faster)');
    console.log('   ✓ Parallel processing (2-4x faster)');
    console.log('   ✓ Request batching (reduce overhead)');
    console.log('   ✓ Streaming (perceived performance)');
    console.log('   ✓ Use cheaper models for simple tasks');
    console.log('   ✓ Set appropriate max_tokens limits\n');

    console.log('📈 Performance Metrics to Track:\n');
    console.log('   • Time to First Byte (TTFB)');
    console.log('   • Total request duration');
    console.log('   • Cache hit rate');
    console.log('   • Token usage per request');
    console.log('   • Cost per request');
    console.log('   • Error rate\n');

    console.log('🎯 Production Optimizations:\n');
    console.log('   • CDN for static assets');
    console.log('   • Edge functions for low latency');
    console.log('   • Connection pooling');
    console.log('   • Request deduplication');
    console.log('   • Adaptive rate limiting');
    console.log('   • Preload common queries\n');

  } catch (error) {
    displayError(error, 'Performance optimization example');
    process.exit(1);
  }
}

main();
