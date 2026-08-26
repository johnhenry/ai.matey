/**
 * Fallback Routing - Automatic Failover
 *
 * Demonstrates:
 * - Automatic failover when primary backend fails
 * - Priority-based backend selection
 * - Graceful degradation strategies
 * - Backend health monitoring
 * - High-availability patterns
 *
 * Prerequisites:
 * - At least 2 API keys in web.env.local.mjs
 * - Router will try primary, fallback to secondary
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/04-routing/02-fallback.ts
 *
 * Expected Output:
 *   Demonstrates automatic failover from primary to backup backend
 *   when the primary fails or is unavailable.
 */

import { Router } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
import { GeminiBackendAdapter } from '@johnhenry/aimatey-backend/gemini';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayResponse, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Fallback Routing',
    'Automatic failover for high-availability AI applications',
    [
      'At least 2 API keys in web.env.local.mjs',
      'Primary backend will be tried first, fallback used if it fails'
    ]
  );

  const keys = loadAPIKeys();

  // Example 1: Simulate Primary Failure
  console.log('\n📝 Example 1: Primary Backend Failure');
  console.log('═'.repeat(60) + '\n');

  // Intentionally create a failing primary backend
  const backends1 = [
    // Primary: Invalid key (will fail)
    new AnthropicBackendAdapter({ apiKey: 'invalid-key' }),
  ];

  // Add working fallback if available
  if (keys.openai) {
    backends1.push(new OpenAIBackendAdapter({ apiKey: keys.openai }));
    console.log('✓ Primary: Anthropic (invalid key - will fail)');
    console.log('✓ Fallback: OpenAI (working)\n');
  } else if (keys.anthropic) {
    backends1[0] = new OpenAIBackendAdapter({ apiKey: 'invalid-key' });
    backends1.push(new AnthropicBackendAdapter({ apiKey: keys.anthropic }));
    console.log('✓ Primary: OpenAI (invalid key - will fail)');
    console.log('✓ Fallback: Anthropic (working)\n');
  } else {
    console.log('⚠️  Need at least one working API key\n');
    process.exit(1);
  }

  const router1 = new Router(new OpenAIFrontendAdapter(), {
    backends: backends1,
    strategy: 'priority', // Try in order
    fallbackOnError: true, // Auto-failover enabled
  });

  // Listen to backend switches
  router1.on('backend:switch', (event: any) => {
    console.log(`🔄 Backend Switch: ${event.from || 'none'} → ${event.to || 'fallback'}`);
  });

  router1.on('backend:error', (event: any) => {
    console.log(`⚠️  Backend Error: ${event.backend || 'unknown'} - ${event.error?.message || 'unknown error'}`);
  });

  console.log('Making request (will automatically fail over)...\n');

  try {
    const response1 = await router1.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain what automatic failover means in one sentence.',
        },
      ],
      max_tokens: 100
    });

    displayResponse(response1, 'Success via Fallback Backend');
  } catch (error) {
    console.log('✗ All backends failed\n');
  }

  // Example 2: Multi-Tier Fallback
  console.log('\n📝 Example 2: Multi-Tier Fallback (3 backends)');
  console.log('═'.repeat(60) + '\n');

  const backends2: any[] = [];

  // Add all available backends in priority order
  if (keys.anthropic) {
    backends2.push(new AnthropicBackendAdapter({ apiKey: keys.anthropic }));
    console.log('✓ Priority 1: Anthropic (primary)');
  }

  if (keys.openai) {
    backends2.push(new OpenAIBackendAdapter({ apiKey: keys.openai }));
    console.log('✓ Priority 2: OpenAI (secondary)');
  }

  if (keys.gemini) {
    backends2.push(new GeminiBackendAdapter({ apiKey: keys.gemini }));
    console.log('✓ Priority 3: Google Gemini (tertiary)');
  }

  if (backends2.length < 2) {
    console.log('\n⚠️  Skipped: Need at least 2 working backends\n');
  } else {
    console.log('');

    const router2 = new Router(new OpenAIFrontendAdapter(), {
      backends: backends2,
      strategy: 'priority',
      fallbackOnError: true,
    });

    let currentBackend = '';
    router2.on('backend:selected', (event: any) => {
      currentBackend = event.backend || 'unknown';
      console.log(`✓ Using backend: ${currentBackend}`);
    });

    const response2 = await router2.chat({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2?',
        },
      ],
      max_tokens: 20
    });

    console.log(`\nResponse from ${currentBackend}:`);
    console.log('─'.repeat(60));
    console.log(response2.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');
  }

  // Example 3: Health-Based Fallback
  console.log('📝 Example 3: Continuous Availability');
  console.log('═'.repeat(60) + '\n');

  if (backends2.length >= 2) {
    const router3 = new Router(new OpenAIFrontendAdapter(), {
      backends: backends2,
      strategy: 'priority',
      fallbackOnError: true,
      maxRetries: 3, // Retry on each backend
    });

    console.log('Making 5 requests with failover protection...\n');

    for (let i = 1; i <= 5; i++) {
      try {
        const response = await router3.chat({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: `Request ${i}: Quick math ${i}×2 = ?` }],
          max_tokens: 20
        });

        console.log(`Request ${i}: ✓ ${response.choices[0].message.content?.substring(0, 40) || ''}`);
      } catch (error) {
        console.log(`Request ${i}: ✗ Failed`);
      }
    }

    console.log('');

    // Get routing stats
    const stats = router3.getStats();
    console.log('Availability Stats:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(stats, null, 2));
    console.log('');
  }

  console.log('💡 Benefits of Fallback Routing:');
  console.log('   ✓ Automatic recovery from failures');
  console.log('   ✓ High availability (99.9%+ uptime)');
  console.log('   ✓ Graceful degradation');
  console.log('   ✓ No single point of failure');
  console.log('   ✓ Transparent to application code\n');

  console.log('🎯 Best Use Cases:');
  console.log('   • Production applications requiring high uptime');
  console.log('   • Mission-critical services');
  console.log('   • Multi-region deployments');
  console.log('   • Provider independence\n');

  console.log('⚙️  Advanced Patterns:');
  console.log('   • Circuit breakers (temporary backend disable)');
  console.log('   • Health checks (proactive failure detection)');
  console.log('   • Retry with exponential backoff');
  console.log('   • Geographic failover');
  console.log('   • Cost-aware fallback (try cheap first)\n');
}

main().catch(error => {
  displayError(error, 'Fallback routing example');
  process.exit(1);
});
