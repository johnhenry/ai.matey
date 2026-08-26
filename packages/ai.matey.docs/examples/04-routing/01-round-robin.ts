/**
 * Round-Robin Routing - Even Load Distribution
 *
 * Demonstrates:
 * - Distributing requests evenly across multiple backends
 * - Load balancing for high-traffic applications
 * - Monitoring backend usage statistics
 * - Automatic backend rotation
 * - Performance benefits of load distribution
 *
 * Prerequisites:
 * - At least 2 of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY in web.env.local.mjs
 * - @johnhenry/aimatey-core (Router) package installed
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/04-routing/01-round-robin.ts
 *
 * Expected Output:
 *   Multiple requests distributed evenly across available backends,
 *   with statistics showing balanced usage.
 */

import { Router } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
import { GeminiBackendAdapter } from '@johnhenry/aimatey-backend/gemini';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Round-Robin Routing',
    'Distribute requests evenly across multiple AI providers',
    [
      'At least 2 API keys in web.env.local.mjs',
      'Router will cycle through available backends'
    ]
  );

  const keys = loadAPIKeys();

  // Build available backends
  const backends: any[] = [];

  if (keys.anthropic) {
    backends.push(new AnthropicBackendAdapter({ apiKey: keys.anthropic }));
    console.log('✓ Anthropic backend added');
  }

  if (keys.openai) {
    backends.push(new OpenAIBackendAdapter({ apiKey: keys.openai }));
    console.log('✓ OpenAI backend added');
  }

  if (keys.gemini) {
    backends.push(new GeminiBackendAdapter({ apiKey: keys.gemini }));
    console.log('✓ Google Gemini backend added');
  }

  if (backends.length < 2) {
    console.log('\n⚠️  Need at least 2 backends for round-robin routing');
    console.log('   Set API keys in web.env.local.mjs\n');
    process.exit(1);
  }

  console.log(`\n✓ ${backends.length} backends configured\n`);

  // Create router with round-robin strategy
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends,
    strategy: 'round-robin', // Cycle through backends in order
    fallbackOnError: true, // Skip failed backends
  });

  console.log('═'.repeat(60));
  console.log('Round-Robin Strategy: Rotating through backends');
  console.log('═'.repeat(60) + '\n');

  // Track backend selection
  const backendUsage = new Map<string, number>();

  router.on('backend:selected', (event: any) => {
    const backend = event.backend || 'unknown';
    backendUsage.set(backend, (backendUsage.get(backend) || 0) + 1);
  });

  // Make multiple requests
  const numRequests = Math.max(6, backends.length * 2);

  console.log(`Making ${numRequests} requests with round-robin routing...\n`);

  for (let i = 1; i <= numRequests; i++) {
    try {
      console.log(`Request ${i}:`);

      const response = await router.chat({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `Count to ${i}`,
          },
        ],
        max_tokens: 50
      });

      const content = response.choices[0].message.content || '';
      console.log(`  Response: ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}\n`);
    } catch (error) {
      console.log(`  ✗ Failed\n`);
    }
  }

  // Show usage statistics
  console.log('═'.repeat(60));
  console.log('Backend Usage Statistics');
  console.log('═'.repeat(60) + '\n');

  if (backendUsage.size > 0) {
    console.log('Distribution:');
    console.log('─'.repeat(60));
    backendUsage.forEach((count, backend) => {
      const percentage = ((count / numRequests) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / 2));
      console.log(`${backend.padEnd(25)} ${count.toString().padStart(2)} requests (${percentage.padStart(5)}%)  ${bar}`);
    });
    console.log('─'.repeat(60) + '\n');

    // Check balance
    const counts = Array.from(backendUsage.values());
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avgCount)));
    const balanceScore = Math.max(0, 100 - (maxDeviation / avgCount) * 100);

    console.log(`Balance Score: ${balanceScore.toFixed(1)}% (100% = perfect balance)\n`);
  }

  // Get detailed router stats
  const stats = router.getStats();
  console.log('Detailed Router Stats:');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(stats, null, 2));
  console.log('');

  console.log('💡 Benefits of Round-Robin Routing:');
  console.log('   ✓ Even load distribution across providers');
  console.log('   ✓ Prevents overwhelming single provider');
  console.log('   ✓ Better rate limit management');
  console.log('   ✓ Improved overall availability');
  console.log('   ✓ Simple and predictable behavior\n');

  console.log('🎯 Best Use Cases:');
  console.log('   • High-volume applications');
  console.log('   • Multi-provider redundancy');
  console.log('   • Cost distribution across providers');
  console.log('   • A/B testing with equal distribution\n');

  console.log('⚙️  Configuration Options:');
  console.log('   • strategy: "round-robin"');
  console.log('   • fallbackOnError: Skip failed backends');
  console.log('   • healthCheck: Monitor backend health');
  console.log('   • weights: Add weight to certain backends\n');
}

main().catch(error => {
  displayError(error, 'Round-robin routing example');
  process.exit(1);
});
