/**
 * Custom Routing Strategy - Build Your Own Logic
 *
 * Demonstrates:
 * - Creating custom routing strategies
 * - Context-aware routing decisions
 * - Model-specific provider selection
 * - Performance-based routing
 * - Advanced routing patterns
 *
 * Prerequisites:
 * - At least 2 API keys in web.env.local.mjs
 * - Understanding of Router architecture
 *
 * Run:
 *   npx tsx examples/04-routing/05-custom-strategy.ts
 *
 * Expected Output:
 *   Requests routed based on custom logic (model type, content,
 *   time of day, etc.) demonstrating flexible routing.
 */

import { Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import type { IRChatCompletionRequest } from 'ai.matey.types';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

/**
 * Custom Strategy 1: Route based on content complexity
 */
function complexityBasedStrategy(request: IRChatCompletionRequest, backends: any[]): number {
  const content = request.messages[request.messages.length - 1]?.content as string || '';
  const wordCount = content.split(' ').length;

  // Simple queries → cheapest provider
  if (wordCount < 10) {
    return backends.length - 1; // Last backend (cheapest in our setup)
  }

  // Medium complexity → middle tier
  if (wordCount < 30) {
    return Math.floor(backends.length / 2);
  }

  // Complex queries → best provider
  return 0; // First backend (best in our setup)
}

/**
 * Custom Strategy 2: Route based on model request
 */
function modelBasedStrategy(request: IRChatCompletionRequest, backends: any[]): number {
  const model = request.model;

  // Map model requests to specific providers
  if (model.includes('gpt-4')) {
    // GPT-4 requests → OpenAI if available
    const openaiIndex = backends.findIndex(b => b.constructor.name.includes('OpenAI'));
    if (openaiIndex >= 0) return openaiIndex;
  }

  if (model.includes('claude')) {
    // Claude requests → Anthropic if available
    const anthropicIndex = backends.findIndex(b => b.constructor.name.includes('Anthropic'));
    if (anthropicIndex >= 0) return anthropicIndex;
  }

  if (model.includes('gemini')) {
    // Gemini requests → Google if available
    const geminiIndex = backends.findIndex(b => b.constructor.name.includes('Gemini'));
    if (geminiIndex >= 0) return geminiIndex;
  }

  // Default to first backend
  return 0;
}

/**
 * Custom Strategy 3: Time-based routing (cost optimization)
 */
function timeBasedStrategy(request: IRChatCompletionRequest, backends: any[]): number {
  const hour = new Date().getHours();

  // Off-peak hours (night) → cheaper provider
  if (hour < 6 || hour > 22) {
    return backends.length - 1;
  }

  // Peak hours → balanced provider
  return Math.floor(backends.length / 2);
}

async function main() {
  displayExampleInfo(
    'Custom Routing Strategy',
    'Build intelligent routing logic for your use case',
    [
      'Multiple API keys for routing options',
      'Custom strategy examples included'
    ]
  );

  const keys = loadAPIKeys();

  // Build backends (ordered: best → cheapest)
  const backends: any[] = [];
  const backendNames: string[] = [];

  if (keys.anthropic) {
    backends.push(new AnthropicBackendAdapter({ apiKey: keys.anthropic }));
    backendNames.push('Anthropic (premium)');
  }

  if (keys.openai) {
    backends.push(new OpenAIBackendAdapter({ apiKey: keys.openai }));
    backendNames.push('OpenAI (standard)');
  }

  if (keys.gemini) {
    backends.push(new GeminiBackendAdapter({ apiKey: keys.gemini }));
    backendNames.push('Gemini (economical)');
  }

  if (backends.length < 2) {
    console.log('\n⚠️  Need at least 2 backends for custom routing\n');
    process.exit(1);
  }

  console.log(`\n✓ ${backends.length} backends available:\n`);
  backendNames.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}`);
  });
  console.log('');

  // Example 1: Complexity-Based Routing
  console.log('═'.repeat(60));
  console.log('Example 1: Complexity-Based Routing');
  console.log('═'.repeat(60) + '\n');

  console.log('Strategy: Route based on query complexity\n');

  const requests = [
    { content: 'What is 2+2?', complexity: 'simple' },
    { content: 'Explain quantum entanglement in simple terms.', complexity: 'medium' },
    { content: 'Provide a detailed analysis of the economic impacts of artificial intelligence on labor markets, including historical precedents and future projections.', complexity: 'complex' },
  ];

  for (const req of requests) {
    const backendIndex = complexityBasedStrategy({ model: 'gpt-4', messages: [{ role: 'user', content: req.content }] } as IRChatCompletionRequest, backends);

    console.log(`Query (${req.complexity}): "${req.content.substring(0, 50)}${req.content.length > 50 ? '...' : ''}"`);
    console.log(`→ Routed to: ${backendNames[backendIndex]}\n`);
  }

  // Example 2: Model-Based Routing
  console.log('═'.repeat(60));
  console.log('Example 2: Model-Based Routing');
  console.log('═'.repeat(60) + '\n');

  console.log('Strategy: Route to provider matching requested model\n');

  const modelRequests = [
    { model: 'gpt-4', desc: 'GPT-4 request' },
    { model: 'claude-3-sonnet', desc: 'Claude request' },
    { model: 'gemini-pro', desc: 'Gemini request' },
  ];

  for (const req of modelRequests) {
    const backendIndex = modelBasedStrategy({ model: req.model, messages: [{ role: 'user', content: 'test' }] } as IRChatCompletionRequest, backends);

    console.log(`${req.desc} (${req.model})`);
    console.log(`→ Routed to: ${backendNames[backendIndex]}\n`);
  }

  // Example 3: Time-Based Routing
  console.log('═'.repeat(60));
  console.log('Example 3: Time-Based Routing');
  console.log('═'.repeat(60) + '\n');

  const hour = new Date().getHours();
  const timeOfDay = hour < 6 || hour > 22 ? 'off-peak' : 'peak';

  console.log(`Current time: ${hour}:00 (${timeOfDay} hours)`);
  console.log('Strategy: Use cheaper providers during off-peak hours\n');

  const backendIndex = timeBasedStrategy({ model: 'gpt-4', messages: [{ role: 'user', content: 'test' }] } as IRChatCompletionRequest, backends);

  console.log(`→ Current routing: ${backendNames[backendIndex]}\n`);

  // Example 4: Actual request with custom routing
  console.log('═'.repeat(60));
  console.log('Example 4: Live Request with Custom Routing');
  console.log('═'.repeat(60) + '\n');

  // For actual routing, we'd need to implement a custom Router class
  // For now, demonstrate manual selection
  const testContent = 'Explain custom routing strategies in AI systems.';
  const selectedIndex = complexityBasedStrategy({
    model: 'gpt-4',
    messages: [{ role: 'user', content: testContent }]
  } as IRChatCompletionRequest, backends);

  console.log(`Query: "${testContent}"`);
  console.log(`Selected: ${backendNames[selectedIndex]}\n`);

  try {
    const router = new Router(new OpenAIFrontendAdapter(), {
      backends,
      strategy: 'priority', // Would be custom in production
    });

    const response = await router.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: testContent }],
      max_tokens: 150
    });

    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(response.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');
  } catch (error) {
    console.log('✗ Request failed\n');
  }

  console.log('💡 Custom Strategy Use Cases:');
  console.log('   ✓ Complexity-based (simple → cheap, complex → premium)');
  console.log('   ✓ Model-specific (route to native provider)');
  console.log('   ✓ Time-based (off-peak → cheap)');
  console.log('   ✓ User-based (free tier → cheap, paid → premium)');
  console.log('   ✓ Geographic (route to nearest provider)');
  console.log('   ✓ Feature-based (streaming → provider A, functions → provider B)\n');

  console.log('🔧 Implementation Tips:');
  console.log('   • Analyze request content for complexity signals');
  console.log('   • Track provider performance metrics');
  console.log('   • Implement fallback logic for failed routes');
  console.log('   • Cache routing decisions for repeated patterns');
  console.log('   • Monitor cost and performance of each strategy\n');

  console.log('📊 Advanced Patterns:');
  console.log('   • ML-based routing (predict best provider)');
  console.log('   • Multi-factor scoring (cost + speed + quality)');
  console.log('   • A/B test different strategies');
  console.log('   • Dynamic strategy adjustment based on feedback');
  console.log('   • Hybrid strategies (combine multiple rules)\n');
}

main().catch(error => {
  displayError(error, 'Custom routing strategy example');
  process.exit(1);
});
