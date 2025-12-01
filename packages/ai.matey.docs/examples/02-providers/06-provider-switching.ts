/**
 * Provider Switching - Dynamic Backend Selection
 *
 * Demonstrates:
 * - Switching between providers at runtime
 * - Router-based automatic provider selection
 * - Fallback strategies when a provider fails
 * - Load balancing across multiple providers
 * - Cost optimization through smart routing
 *
 * Prerequisites:
 * - At least 2 of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY
 * - ai.matey.core (Router) package installed
 *
 * Run:
 *   npx tsx examples/02-providers/06-provider-switching.ts
 *
 * Expected Output:
 *   Requests automatically routed to different providers based on
 *   availability, performance, and routing strategy.
 */

import { Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import { GroqBackendAdapter } from 'ai.matey.backend/groq';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Provider Switching - Dynamic Routing',
    'Automatically route requests to the best available provider',
    [
      'At least 2 API keys set in web.env.local.mjs',
      'Router supports: Anthropic, OpenAI, Google, Groq'
    ]
  );

  const keys = loadAPIKeys();

  // Build available backends
  const backends: any[] = [];

  if (keys.openai) {
    backends.push(new OpenAIBackendAdapter({ apiKey: keys.openai }));
    console.log('✓ OpenAI backend available');
  }

  if (keys.anthropic) {
    backends.push(new AnthropicBackendAdapter({ apiKey: keys.anthropic }));
    console.log('✓ Anthropic backend available');
  }

  if (keys.gemini) {
    backends.push(new GeminiBackendAdapter({ apiKey: keys.gemini }));
    console.log('✓ Google Gemini backend available');
  }

  if (keys.groq) {
    backends.push(new GroqBackendAdapter({ apiKey: keys.groq }));
    console.log('✓ Groq backend available');
  }

  if (backends.length < 2) {
    console.log('\n⚠️  Need at least 2 providers for routing.');
    console.log('   Set API keys in web.env.local.mjs\n');
    process.exit(1);
  }

  console.log(`\n✓ ${backends.length} providers configured for routing\n`);

  // Example 1: Round-Robin Load Balancing
  console.log('═'.repeat(60));
  console.log('Example 1: Round-Robin Load Balancing');
  console.log('═'.repeat(60) + '\n');

  const roundRobinRouter = new Router(new OpenAIFrontendAdapter(), {
    backends,
    strategy: 'round-robin', // Distribute load evenly
  });

  console.log('Strategy: Distribute requests evenly across all providers\n');

  // Track which backend handles each request
  let requestNum = 0;
  roundRobinRouter.on('backend:selected', (event: any) => {
    requestNum++;
    console.log(`Request ${requestNum} → ${event.backend || 'unknown backend'}`);
  });

  // Make 5 requests
  for (let i = 1; i <= Math.min(5, backends.length * 2); i++) {
    try {
      await roundRobinRouter.chat({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Request ${i}: What is ${i} squared?` }],
        max_tokens: 20
      });
    } catch (error) {
      console.log(`Request ${i} failed`);
    }
  }

  console.log('\n💡 Round-robin ensures even load distribution\n');

  // Example 2: Priority-Based Routing with Fallback
  console.log('═'.repeat(60));
  console.log('Example 2: Priority Routing with Fallback');
  console.log('═'.repeat(60) + '\n');

  const priorityRouter = new Router(new OpenAIFrontendAdapter(), {
    backends,
    strategy: 'priority', // Try in order
    fallbackOnError: true, // Auto-fallback if primary fails
  });

  console.log('Strategy: Try primary first, fallback to secondary if it fails\n');

  let currentBackend = '';
  priorityRouter.on('backend:switch', (event: any) => {
    const from = event.from || 'none';
    const to = event.to || 'unknown';
    console.log(`🔄 Switching: ${from} → ${to}`);
    currentBackend = to;
  });

  try {
    const response = await priorityRouter.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain priority routing in one sentence.',
        },
      ],
      max_tokens: 100
    });

    console.log(`\n✓ Response from: ${currentBackend}`);
    console.log('─'.repeat(60));
    console.log(response.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');
  } catch (error) {
    console.log('✗ All backends failed\n');
  }

  // Example 3: Cost-Optimized Routing
  console.log('═'.repeat(60));
  console.log('Example 3: Cost-Optimized Routing');
  console.log('═'.repeat(60) + '\n');

  // Manually prioritize backends by cost (cheapest first)
  const costOptimizedBackends = [...backends].sort((a, b) => {
    // Rough cost ordering: Groq < Gemini < Anthropic < OpenAI
    const costs: Record<string, number> = {
      'GroqBackendAdapter': 1,
      'GeminiBackendAdapter': 2,
      'AnthropicBackendAdapter': 3,
      'OpenAIBackendAdapter': 4,
    };
    const costA = costs[a.constructor.name] || 5;
    const costB = costs[b.constructor.name] || 5;
    return costA - costB;
  });

  const costRouter = new Router(new OpenAIFrontendAdapter(), {
    backends: costOptimizedBackends,
    strategy: 'priority', // Use cheapest available
  });

  console.log('Strategy: Route to cheapest provider first\n');
  console.log('Cost priority: Groq > Gemini > Anthropic > OpenAI\n');

  try {
    const response = await costRouter.chat({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Simple math: 7 + 8 = ?',
        },
      ],
      max_tokens: 20
    });

    console.log('✓ Response from cheapest available provider');
    console.log('─'.repeat(60));
    console.log(response.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');
  } catch (error) {
    console.log('✗ Request failed\n');
  }

  // Get routing statistics
  console.log('═'.repeat(60));
  console.log('Routing Statistics');
  console.log('═'.repeat(60) + '\n');

  const stats = roundRobinRouter.getStats();
  console.log(JSON.stringify(stats, null, 2));
  console.log('');

  console.log('💡 Routing Strategies:');
  console.log('─'.repeat(60));
  console.log('round-robin:   Even load distribution');
  console.log('priority:      Prefer specific providers');
  console.log('random:        Random selection');
  console.log('cost:          Optimize for cost');
  console.log('performance:   Optimize for speed');
  console.log('─'.repeat(60) + '\n');

  console.log('🎯 Use Cases:');
  console.log('   • High availability → Priority with fallback');
  console.log('   • Cost optimization → Cost-based routing');
  console.log('   • Load distribution → Round-robin');
  console.log('   • A/B testing → Random selection');
  console.log('   • Speed-critical → Performance-based\n');

  console.log('⚙️  Advanced Features:');
  console.log('   • Health checks and circuit breakers');
  console.log('   • Weighted routing (70% provider A, 30% provider B)');
  console.log('   • Time-based routing (night vs day)');
  console.log('   • Geographic routing');
  console.log('   • Feature-based routing (streaming, function calling)\n');
}

main().catch(error => {
  displayError(error, 'Provider switching example');
  process.exit(1);
});
