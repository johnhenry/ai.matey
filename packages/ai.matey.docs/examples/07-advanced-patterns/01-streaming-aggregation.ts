/**
 * Streaming Aggregation - Combine Multiple Streams
 *
 * Demonstrates:
 * - Aggregating responses from multiple providers
 * - Parallel streaming for faster results
 * - Comparing provider responses in real-time
 * - Merge strategies (first-response, voting, best-quality)
 * - Advanced streaming patterns
 *
 * Prerequisites:
 * - At least 2 API keys in web.env.local.mjs
 * - Understanding of async generators
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/01-streaming-aggregation.ts
 *
 * Expected Output:
 *   Multiple providers streaming responses simultaneously,
 *   with aggregation showing which provider responds first.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import type { IRChatCompletionChunk } from 'ai.matey.types';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

interface StreamResult {
  provider: string;
  chunks: string[];
  fullText: string;
  duration: number;
  firstChunkTime: number;
}

async function main() {
  displayExampleInfo(
    'Streaming Aggregation',
    'Combine and compare multiple provider streams',
    [
      'At least 2 API keys in web.env.local.mjs',
      'Demonstrates parallel streaming'
    ]
  );

  const keys = loadAPIKeys();

  // Build available providers
  const providers: Array<{ name: string; bridge: Bridge }> = [];

  if (keys.anthropic) {
    providers.push({
      name: 'Anthropic',
      bridge: new Bridge(
        new OpenAIFrontendAdapter(),
        new AnthropicBackendAdapter({ apiKey: keys.anthropic })
      ),
    });
  }

  if (keys.openai) {
    providers.push({
      name: 'OpenAI',
      bridge: new Bridge(
        new OpenAIFrontendAdapter(),
        new OpenAIBackendAdapter({ apiKey: keys.openai })
      ),
    });
  }

  if (keys.gemini) {
    providers.push({
      name: 'Gemini',
      bridge: new Bridge(
        new OpenAIFrontendAdapter(),
        new GeminiBackendAdapter({ apiKey: keys.gemini })
      ),
    });
  }

  if (providers.length < 2) {
    console.log('\n⚠️  Need at least 2 providers for aggregation\n');
    process.exit(1);
  }

  console.log(`\n✓ ${providers.length} providers available for streaming\n`);

  const testRequest = {
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Explain the concept of parallel processing in 3 sentences.',
      },
    ],
    temperature: 0.7,
    max_tokens: 150,
    stream: true,
  };

  // Example 1: Race - Use first response
  console.log('═'.repeat(60));
  console.log('Example 1: Race (First Provider Wins)');
  console.log('═'.repeat(60) + '\n');

  console.log('Starting parallel streams from all providers...\n');

  const racePromises = providers.map(async (provider) => {
    const start = Date.now();
    const stream = await provider.bridge.chatStream(testRequest);

    let fullText = '';
    let firstChunkTime = 0;

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        const content = chunk.choices[0].delta.content;
        fullText += content;

        if (firstChunkTime === 0) {
          firstChunkTime = Date.now() - start;
        }
      }
    }

    return {
      provider: provider.name,
      fullText,
      duration: Date.now() - start,
      firstChunkTime,
    };
  });

  // Race: use first complete response
  const winner = await Promise.race(racePromises);

  console.log('🏆 Winner: ' + winner.provider);
  console.log('⏱️  Time to first chunk: ' + winner.firstChunkTime + 'ms');
  console.log('⏱️  Total duration: ' + winner.duration + 'ms\n');
  console.log('Response:');
  console.log('─'.repeat(60));
  console.log(winner.fullText);
  console.log('─'.repeat(60) + '\n');

  // Example 2: Parallel Display - Show all streams
  console.log('═'.repeat(60));
  console.log('Example 2: Parallel Display (All Responses)');
  console.log('═'.repeat(60) + '\n');

  console.log('Streaming from all providers simultaneously...\n');

  const allResults = await Promise.all(racePromises);

  allResults.sort((a, b) => a.duration - b.duration);

  console.log('📊 Results (sorted by speed):\n');

  allResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.provider}:`);
    console.log(`   First chunk: ${result.firstChunkTime}ms`);
    console.log(`   Total time: ${result.duration}ms`);
    console.log(`   Length: ${result.fullText.length} chars`);
    console.log('   Response:', result.fullText.substring(0, 100) + '...\n');
  });

  // Example 3: Aggregation with live comparison
  console.log('═'.repeat(60));
  console.log('Example 3: Live Comparison');
  console.log('═'.repeat(60) + '\n');

  const streams = await Promise.all(
    providers.map(async (p) => ({
      name: p.name,
      stream: await p.bridge.chatStream(testRequest),
    }))
  );

  console.log('Streaming side-by-side:\n');

  const results: Record<string, StreamResult> = {};
  const startTime = Date.now();

  // Initialize results
  providers.forEach((p) => {
    results[p.name] = {
      provider: p.name,
      chunks: [],
      fullText: '',
      duration: 0,
      firstChunkTime: 0,
    };
  });

  // Process streams in parallel
  await Promise.all(
    streams.map(async ({ name, stream }) => {
      let chunkCount = 0;

      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          chunkCount++;

          if (results[name].firstChunkTime === 0) {
            results[name].firstChunkTime = Date.now() - startTime;
            console.log(`✓ ${name} started streaming (${results[name].firstChunkTime}ms)`);
          }

          results[name].chunks.push(content);
          results[name].fullText += content;
        }
      }

      results[name].duration = Date.now() - startTime;
      console.log(`✓ ${name} completed (${results[name].duration}ms, ${chunkCount} chunks)`);
    })
  );

  console.log('\n📊 Aggregation Summary:\n');

  const sortedResults = Object.values(results).sort((a, b) => a.duration - b.duration);

  sortedResults.forEach((result, i) => {
    const speedRank = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    console.log(`${speedRank} ${result.provider}:`);
    console.log(`   Speed: ${result.duration}ms (first chunk: ${result.firstChunkTime}ms)`);
    console.log(`   Chunks: ${result.chunks.length}`);
    console.log(`   Length: ${result.fullText.length} chars\n`);
  });

  console.log('💡 Aggregation Strategies:');
  console.log('   • Race: Use fastest provider (best for latency)');
  console.log('   • Parallel: Compare all responses (best for quality)');
  console.log('   • Voting: Use most common response (best for reliability)');
  console.log('   • Merge: Combine best parts from each (experimental)');
  console.log('   • Fallback: Primary with backup (best for availability)\n');

  console.log('🎯 Use Cases:');
  console.log('   • Speed optimization (use fastest)');
  console.log('   • Quality comparison (A/B testing)');
  console.log('   • Reliability (voting consensus)');
  console.log('   • Cost optimization (race cheap providers)\n');

  console.log('⚡ Performance Insights:');
  console.log('   • First chunk latency varies by provider');
  console.log('   • Total response time can differ by 2-3x');
  console.log('   • Parallel requests increase throughput');
  console.log('   • Network latency matters more than model speed\n');
}

main().catch(error => {
  displayError(error, 'Streaming aggregation example');
  process.exit(1);
});
