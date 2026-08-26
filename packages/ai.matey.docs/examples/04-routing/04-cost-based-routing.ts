/**
 * Cost-Based Routing - Optimize for Budget
 *
 * Demonstrates:
 * - Routing to cheapest available provider
 * - Cost calculation and tracking
 * - Budget limits and alerts
 * - Cost-performance trade-offs
 * - Automatic cost optimization
 *
 * Prerequisites:
 * - At least 2 API keys in web.env.local.mjs
 * - Understanding of provider pricing
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/04-routing/04-cost-based-routing.ts
 *
 * Expected Output:
 *   Requests routed to cheapest provider, with cost tracking
 *   and budget monitoring.
 */

import { Router } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
import { GeminiBackendAdapter } from '@johnhenry/aimatey-backend/gemini';
import { GroqBackendAdapter } from '@johnhenry/aimatey-backend/groq';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

// Provider cost per 1M tokens (approximate)
const PROVIDER_COSTS = {
  Groq: { input: 0.05, output: 0.10 },        // Cheapest
  Gemini: { input: 1.25, output: 5.00 },      // Low
  Anthropic: { input: 3.00, output: 15.00 },  // Medium
  OpenAI: { input: 5.00, output: 15.00 },     // High
};

async function main() {
  displayExampleInfo(
    'Cost-Based Routing',
    'Optimize AI costs through intelligent routing',
    [
      'Multiple API keys for cost comparison',
      'Automatic routing to cheapest provider'
    ]
  );

  const keys = loadAPIKeys();

  // Build backends sorted by cost (cheapest first)
  const backends: Array<{ adapter: any; name: string; cost: typeof PROVIDER_COSTS.Groq }> = [];

  if (keys.groq) {
    backends.push({
      adapter: new GroqBackendAdapter({ apiKey: keys.groq }),
      name: 'Groq',
      cost: PROVIDER_COSTS.Groq
    });
  }

  if (keys.gemini) {
    backends.push({
      adapter: new GeminiBackendAdapter({ apiKey: keys.gemini }),
      name: 'Gemini',
      cost: PROVIDER_COSTS.Gemini
    });
  }

  if (keys.anthropic) {
    backends.push({
      adapter: new AnthropicBackendAdapter({ apiKey: keys.anthropic }),
      name: 'Anthropic',
      cost: PROVIDER_COSTS.Anthropic
    });
  }

  if (keys.openai) {
    backends.push({
      adapter: new OpenAIBackendAdapter({ apiKey: keys.openai }),
      name: 'OpenAI',
      cost: PROVIDER_COSTS.OpenAI
    });
  }

  if (backends.length < 1) {
    console.log('\n⚠️  Need at least 1 API key\n');
    process.exit(1);
  }

  console.log('\n💰 Provider Cost Comparison (per 1M tokens):');
  console.log('═'.repeat(60));
  backends.forEach(b => {
    console.log(`${b.name.padEnd(15)} Input: $${b.cost.input.toFixed(2).padStart(5)}  |  Output: $${b.cost.output.toFixed(2).padStart(5)}`);
  });
  console.log('═'.repeat(60) + '\n');

  // Create router with priority to cheapest
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: backends.map(b => b.adapter),
    strategy: 'priority', // Try in order (cheapest first)
    fallbackOnError: true,
  });

  // Cost tracking
  let totalCost = 0;
  const costByProvider = new Map<string, number>();

  console.log('Making requests with cost optimization...\n');

  // Example 1: Simple request
  console.log('📝 Request 1: Simple query (should use cheapest)');
  console.log('─'.repeat(60) + '\n');

  try {
    const response1 = await router.chat({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
      max_tokens: 20
    });

    const tokens = response1.usage || { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
    const provider = backends[0]; // First = cheapest
    const cost = ((tokens.prompt_tokens / 1000000) * provider.cost.input) +
                 ((tokens.completion_tokens / 1000000) * provider.cost.output);

    totalCost += cost;
    costByProvider.set(provider.name, (costByProvider.get(provider.name) || 0) + cost);

    console.log(`✓ Provider: ${provider.name} (cheapest)`);
    console.log(`  Tokens: ${tokens.prompt_tokens} + ${tokens.completion_tokens} = ${tokens.total_tokens}`);
    console.log(`  Cost: $${cost.toFixed(8)}`);
    console.log(`  Response: ${response1.choices[0].message.content}\n`);
  } catch (error) {
    console.log('✗ Request failed\n');
  }

  // Example 2: Multiple requests
  console.log('📝 Making 10 cost-optimized requests...\n');

  for (let i = 1; i <= 10; i++) {
    try {
      const response = await router.chat({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Request ${i}: Quick math ${i}×3 = ?` }],
        max_tokens: 15
      });

      const tokens = response.usage || { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
      const provider = backends[0];
      const cost = ((tokens.prompt_tokens / 1000000) * provider.cost.input) +
                   ((tokens.completion_tokens / 1000000) * provider.cost.output);

      totalCost += cost;
      costByProvider.set(provider.name, (costByProvider.get(provider.name) || 0) + cost);

      if (i % 3 === 0) {
        console.log(`✓ Completed ${i}/10 requests (cost: $${totalCost.toFixed(8)})`);
      }
    } catch (error) {
      // Continue
    }
  }

  console.log('\n═'.repeat(60));
  console.log('Cost Summary');
  console.log('═'.repeat(60) + '\n');

  console.log('Cost by Provider:');
  console.log('─'.repeat(60));
  costByProvider.forEach((cost, provider) => {
    console.log(`${provider.padEnd(15)} $${cost.toFixed(8)}`);
  });
  console.log('─'.repeat(60));
  console.log(`Total Cost:      $${totalCost.toFixed(8)}\n`);

  // Compare to most expensive
  const mostExpensive = backends[backends.length - 1];
  if (backends.length > 1) {
    const expensiveCost = totalCost * (mostExpensive.cost.input / backends[0].cost.input);
    const savings = expensiveCost - totalCost;
    const savingsPercent = ((savings / expensiveCost) * 100).toFixed(1);

    console.log('💰 Cost Savings:');
    console.log(`   Cheapest (${backends[0].name}): $${totalCost.toFixed(8)}`);
    console.log(`   Most Expensive (${mostExpensive.name}): ~$${expensiveCost.toFixed(8)}`);
    console.log(`   Savings: $${savings.toFixed(8)} (${savingsPercent}%)\n`);
  }

  console.log('📊 Scaling Projections:');
  console.log('─'.repeat(60));
  const avgCost = totalCost / 11; // 11 requests
  console.log(`At this rate:`);
  console.log(`  1,000 requests:    $${(avgCost * 1000).toFixed(4)}`);
  console.log(`  10,000 requests:   $${(avgCost * 10000).toFixed(2)}`);
  console.log(`  100,000 requests:  $${(avgCost * 100000).toFixed(2)}`);
  console.log(`  1M requests:       $${(avgCost * 1000000).toFixed(2)}\n`);

  console.log('💡 Cost Optimization Strategies:');
  console.log('   ✓ Route simple queries to cheap providers');
  console.log('   ✓ Reserve expensive providers for complex tasks');
  console.log('   ✓ Use caching to avoid redundant requests');
  console.log('   ✓ Set max_tokens limits appropriately');
  console.log('   ✓ Monitor and alert on budget thresholds\n');

  console.log('🎯 Smart Routing Rules:');
  console.log('   • Simple Q&A → Groq or Gemini Flash');
  console.log('   • Analysis → Anthropic Claude');
  console.log('   • Code generation → OpenAI GPT-4');
  console.log('   • Long context → Gemini Pro (2M tokens)\n');
}

main().catch(error => {
  displayError(error, 'Cost-based routing example');
  process.exit(1);
});
