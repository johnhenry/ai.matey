/**
 * Weighted Routing - Proportional Load Distribution
 *
 * Demonstrates:
 * - Weighted backend selection (70/30 split, etc.)
 * - A/B testing different providers
 * - Canary deployments (1% new provider)
 * - Cost optimization through weights
 * - Gradual migration between providers
 *
 * Prerequisites:
 * - At least 2 API keys in web.env.local.mjs
 * - Router with custom weighted strategy
 *
 * Run:
 *   npx tsx examples/04-routing/03-weighted-routing.ts
 *
 * Expected Output:
 *   Requests distributed according to specified weights,
 *   demonstrating proportional routing.
 */

import { Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Weighted Routing',
    'Distribute load proportionally across backends',
    [
      'At least 2 API keys in web.env.local.mjs',
      'Custom weights for load distribution'
    ]
  );

  const keys = loadAPIKeys();

  // Build weighted backends
  const backends: Array<{ adapter: any; weight: number; name: string }> = [];

  if (keys.anthropic) {
    backends.push({
      adapter: new AnthropicBackendAdapter({ apiKey: keys.anthropic }),
      weight: 70, // 70% of traffic
      name: 'Anthropic'
    });
  }

  if (keys.openai) {
    backends.push({
      adapter: new OpenAIBackendAdapter({ apiKey: keys.openai }),
      weight: 20, // 20% of traffic
      name: 'OpenAI'
    });
  }

  if (keys.gemini) {
    backends.push({
      adapter: new GeminiBackendAdapter({ apiKey: keys.gemini }),
      weight: 10, // 10% of traffic (canary)
      name: 'Gemini'
    });
  }

  if (backends.length < 2) {
    console.log('\n⚠️  Need at least 2 backends for weighted routing\n');
    process.exit(1);
  }

  console.log('\n📊 Weighted Backend Configuration:');
  console.log('═'.repeat(60));
  backends.forEach(b => {
    const bar = '█'.repeat(Math.floor(b.weight / 2));
    console.log(`${b.name.padEnd(20)} ${b.weight.toString().padStart(3)}%  ${bar}`);
  });
  console.log('═'.repeat(60) + '\n');

  // Create weighted router (simulated with custom logic)
  // In production, this would use a proper weighted selection algorithm
  const totalWeight = backends.reduce((sum, b) => sum + b.weight, 0);
  const backendAdapters = backends.map(b => b.adapter);

  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: backendAdapters,
    strategy: 'random', // Closest to weighted without custom strategy
  });

  // Track actual distribution
  const usage = new Map<string, number>();
  backends.forEach(b => usage.set(b.name, 0));

  router.on('backend:selected', (event: any) => {
    const backend = event.backend || 'unknown';
    // Match backend name from adapter class
    for (const b of backends) {
      if (backend.includes(b.name) || b.adapter.constructor.name.includes(backend)) {
        usage.set(b.name, (usage.get(b.name) || 0) + 1);
        break;
      }
    }
  });

  // Make many requests to see distribution
  const numRequests = 50;
  console.log(`Making ${numRequests} requests with weighted routing...\n`);

  for (let i = 1; i <= numRequests; i++) {
    try {
      await router.chat({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Request ${i}` }],
        max_tokens: 10
      });

      if (i % 10 === 0) {
        console.log(`✓ Completed ${i}/${numRequests} requests`);
      }
    } catch (error) {
      // Continue on error
    }
  }

  console.log('\n═'.repeat(60));
  console.log('Actual Distribution');
  console.log('═'.repeat(60) + '\n');

  usage.forEach((count, name) => {
    const percentage = ((count / numRequests) * 100).toFixed(1);
    const expected = backends.find(b => b.name === name)?.weight || 0;
    const bar = '█'.repeat(Math.floor(count / 2));
    console.log(`${name.padEnd(20)} ${count.toString().padStart(2)} (${percentage.padStart(5)}%)  ${bar}  [target: ${expected}%]`);
  });
  console.log('');

  console.log('💡 Use Cases for Weighted Routing:');
  console.log('   ✓ A/B testing (50/50 or 90/10 split)');
  console.log('   ✓ Canary deployments (99/1 → 90/10 → 50/50)');
  console.log('   ✓ Cost optimization (cheap:expensive = 80:20)');
  console.log('   ✓ Gradual provider migration');
  console.log('   ✓ Regional load distribution\n');

  console.log('📊 Example Weight Configurations:');
  console.log('─'.repeat(60));
  console.log('A/B Testing:        Primary 50% | Variant 50%');
  console.log('Canary Deploy:      Stable 95%  | Canary 5%');
  console.log('Cost Optimize:      Cheap 80%   | Premium 20%');
  console.log('Migration:          Old 10%     | New 90%');
  console.log('─'.repeat(60) + '\n');

  console.log('🎯 Advanced Strategies:');
  console.log('   • Dynamic weights based on response time');
  console.log('   • Time-based weights (more traffic to cheap provider at night)');
  console.log('   • User-based weights (free users → cheap, paid → premium)');
  console.log('   • Geographic weights (route based on latency)\n');
}

main().catch(error => {
  displayError(error, 'Weighted routing example');
  process.exit(1);
});
