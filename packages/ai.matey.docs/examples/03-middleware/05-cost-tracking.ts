/**
 * Cost Tracking Middleware - Monitor AI API Costs
 *
 * Demonstrates:
 * - Tracking token usage across requests
 * - Estimating costs based on model pricing
 * - Setting cost limits and budgets
 * - Generating usage reports
 * - Cost optimization strategies
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - ai.matey.middleware package installed
 *
 * Run:
 *   npx tsx examples/03-middleware/05-cost-tracking.ts
 *
 * Expected Output:
 *   Detailed cost tracking for multiple requests with running totals,
 *   per-request costs, and budget monitoring.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createCostTrackingMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Cost Tracking Middleware',
    'Monitor and control AI API costs with automatic tracking',
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

    // Track costs
    let totalCost = 0;
    let requestCount = 0;

    // Add cost tracking middleware with configuration
    console.log('💰 Configuring cost tracking middleware...\n');

    bridge.use(
      createCostTrackingMiddleware({
        // Model pricing (per 1M tokens)
        pricing: {
          'claude-3-5-sonnet-20241022': {
            input: 3.00,   // $3 per 1M input tokens
            output: 15.00, // $15 per 1M output tokens
          },
          'claude-3-haiku-20240307': {
            input: 0.25,   // $0.25 per 1M input tokens
            output: 1.25,  // $1.25 per 1M output tokens
          },
        },
        // Optional: Set a budget limit
        budgetLimit: 1.00, // $1 maximum
        onCostCalculated: (cost, tokens, model) => {
          totalCost += cost;
          requestCount++;
          console.log(`💵 Request #${requestCount}:`);
          console.log(`   Model: ${model}`);
          console.log(`   Tokens: ${tokens.prompt} prompt + ${tokens.completion} completion = ${tokens.total}`);
          console.log(`   Cost: $${cost.toFixed(6)}`);
          console.log(`   Running Total: $${totalCost.toFixed(6)}\n`);
        },
        onBudgetExceeded: (spent, limit) => {
          console.log(`⚠️  Budget Limit Exceeded!`);
          console.log(`   Spent: $${spent.toFixed(6)}`);
          console.log(`   Limit: $${limit.toFixed(6)}\n`);
        },
      })
    );

    console.log('✓ Cost tracking middleware configured');
    console.log('  - Pricing: Claude Sonnet ($3/$15) & Haiku ($0.25/$1.25)');
    console.log('  - Budget limit: $1.00');
    console.log('  - Real-time cost reporting enabled\n');

    console.log('═'.repeat(60));
    console.log('Making multiple requests to track costs...');
    console.log('═'.repeat(60) + '\n');

    // Request 1: Small request
    console.log('📝 Request 1: Small question');
    console.log('─'.repeat(60) + '\n');

    const response1 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2?',
        },
      ],
      max_tokens: 20
    });

    console.log('Response:', response1.choices[0].message.content + '\n');

    // Request 2: Medium request
    console.log('📝 Request 2: Medium question');
    console.log('─'.repeat(60) + '\n');

    const response2 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain the concept of middleware in 2 sentences.',
        },
      ],
      max_tokens: 100
    });

    console.log('Response:', response2.choices[0].message.content + '\n');

    // Request 3: Larger request
    console.log('📝 Request 3: Larger question');
    console.log('─'.repeat(60) + '\n');

    const response3 = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Describe the benefits of cost tracking in AI applications.',
        },
      ],
      max_tokens: 150
    });

    console.log('Response:', response3.choices[0].message.content + '\n');

    // Summary
    console.log('═'.repeat(60));
    console.log('Cost Summary');
    console.log('═'.repeat(60));
    console.log(`Total Requests: ${requestCount}`);
    console.log(`Total Cost: $${totalCost.toFixed(6)}`);
    console.log(`Average Cost: $${(totalCost / requestCount).toFixed(6)} per request`);
    console.log(`Budget Remaining: $${Math.max(0, 1.00 - totalCost).toFixed(6)}\n`);

    // Projections
    console.log('📊 Cost Projections:');
    console.log('─'.repeat(60));
    const avgCost = totalCost / requestCount;
    console.log(`At this rate, you could make:`);
    console.log(`  • ${Math.floor(10 / avgCost)} requests for $10`);
    console.log(`  • ${Math.floor(100 / avgCost)} requests for $100`);
    console.log(`  • ${Math.floor(1000 / avgCost)} requests for $1,000\n`);

    console.log('💡 Benefits of Cost Tracking:');
    console.log('   ✓ Real-time cost monitoring');
    console.log('   ✓ Budget enforcement and alerts');
    console.log('   ✓ Cost optimization insights');
    console.log('   ✓ Per-model cost comparison');
    console.log('   ✓ Usage pattern analysis');
    console.log('   ✓ Prevent unexpected bills\n');

    console.log('🔧 Advanced Features:');
    console.log('   • Per-user cost tracking');
    console.log('   • Daily/monthly budget limits');
    console.log('   • Cost alerts and notifications');
    console.log('   • Export to analytics platforms');
    console.log('   • Multi-model cost comparison');
    console.log('   • Automatic model switching for cost optimization\n');

    console.log('💡 Cost Optimization Tips:');
    console.log('   • Use smaller models (Haiku) for simple tasks');
    console.log('   • Set appropriate max_tokens limits');
    console.log('   • Enable caching for repeated requests');
    console.log('   • Batch similar requests together');
    console.log('   • Monitor and optimize prompt length\n');

  } catch (error) {
    displayError(error, 'Cost tracking middleware example');
    process.exit(1);
  }
}

main();
