/**
 * Multiple Providers - Comparing AI Providers
 *
 * Demonstrates:
 * - Sending the same request to multiple providers
 * - Comparing response quality and characteristics
 * - Measuring performance differences
 * - Cost comparison across providers
 * - Choosing the right provider for your use case
 *
 * Prerequisites:
 * - At least 2 of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY
 * - ai.matey.backend package installed
 *
 * Run:
 *   npx tsx examples/02-providers/05-multiple-providers.ts
 *
 * Expected Output:
 *   Side-by-side comparison of responses from multiple providers,
 *   with performance metrics and cost estimates.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

interface ProviderTest {
  name: string;
  bridge: Bridge;
  estimatedCost: number;
}

async function main() {
  displayExampleInfo(
    'Multiple Providers - Comparison',
    'Compare responses from different AI providers',
    [
      'At least 2 API keys set in web.env.local.mjs or environment',
      'Supports: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY'
    ]
  );

  const keys = loadAPIKeys();

  // Set up available providers
  const providers: ProviderTest[] = [];

  if (keys.anthropic) {
    providers.push({
      name: 'Anthropic (Claude Sonnet)',
      bridge: new Bridge(
        new OpenAIFrontendAdapter(),
        new AnthropicBackendAdapter({ apiKey: keys.anthropic })
      ),
      estimatedCost: 0.003, // $3 per 1M input tokens
    });
  }

  if (keys.openai) {
    providers.push({
      name: 'OpenAI (GPT-4)',
      bridge: new Bridge(
        new OpenAIFrontendAdapter(),
        new OpenAIBackendAdapter({ apiKey: keys.openai })
      ),
      estimatedCost: 0.005, // $5 per 1M input tokens
    });
  }

  if (keys.gemini) {
    providers.push({
      name: 'Google (Gemini Pro)',
      bridge: new Bridge(
        new OpenAIFrontendAdapter(),
        new GeminiBackendAdapter({ apiKey: keys.gemini })
      ),
      estimatedCost: 0.0025, // $2.50 per 1M input tokens
    });
  }

  if (providers.length < 2) {
    console.log('⚠️  Need at least 2 providers to compare.');
    console.log('   Set API keys in web.env.local.mjs for:');
    console.log('   • ANTHROPIC_API_KEY');
    console.log('   • OPENAI_API_KEY');
    console.log('   • GOOGLE_API_KEY\n');
    process.exit(1);
  }

  console.log(`\n🔍 Testing ${providers.length} providers:\n`);
  providers.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
  });
  console.log('');

  // Test question
  const testRequest = {
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Explain the benefits of using a universal AI adapter pattern in 3 bullet points.',
      },
    ],
    temperature: 0.7,
    max_tokens: 200
  };

  console.log('═'.repeat(60));
  console.log('Test Question:');
  console.log('═'.repeat(60));
  console.log(testRequest.messages[0].content);
  console.log('═'.repeat(60) + '\n');

  // Run tests
  const results: Array<{
    provider: string;
    response: string;
    duration: number;
    tokens: { prompt: number; completion: number; total: number };
    cost: number;
  }> = [];

  for (const provider of providers) {
    console.log(`\n📝 Testing: ${provider.name}`);
    console.log('─'.repeat(60) + '\n');

    try {
      const start = Date.now();
      const response = await provider.bridge.chat(testRequest);
      const duration = Date.now() - start;

      const content = response.choices[0].message.content || '';
      const tokens = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      // Estimate cost (very rough)
      const cost = (tokens.total_tokens / 1000000) * provider.estimatedCost;

      console.log(content);
      console.log('');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🪙  Tokens: ${tokens.prompt_tokens} + ${tokens.completion_tokens} = ${tokens.total_tokens}`);
      console.log(`💰 Est. Cost: $${cost.toFixed(6)}\n`);

      results.push({
        provider: provider.name,
        response: content,
        duration,
        tokens: {
          prompt: tokens.prompt_tokens,
          completion: tokens.completion_tokens,
          total: tokens.total_tokens,
        },
        cost,
      });
    } catch (error) {
      console.log(`✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }

  // Comparison table
  if (results.length > 0) {
    console.log('\n═'.repeat(60));
    console.log('Comparison Summary');
    console.log('═'.repeat(60) + '\n');

    console.log('Performance:');
    console.log('─'.repeat(60));
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.provider.padEnd(30)} ${r.duration}ms`);
    });
    console.log('');

    console.log('Token Efficiency:');
    console.log('─'.repeat(60));
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.provider.padEnd(30)} ${r.tokens.total} tokens`);
    });
    console.log('');

    console.log('Cost:');
    console.log('─'.repeat(60));
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.provider.padEnd(30)} $${r.cost.toFixed(6)}`);
    });
    console.log('');

    // Find winners
    const fastest = results.reduce((prev, curr) =>
      curr.duration < prev.duration ? curr : prev
    );
    const cheapest = results.reduce((prev, curr) =>
      curr.cost < prev.cost ? curr : prev
    );
    const mostTokens = results.reduce((prev, curr) =>
      curr.tokens.total > prev.tokens.total ? curr : prev
    );

    console.log('🏆 Results:');
    console.log('─'.repeat(60));
    console.log(`⚡ Fastest: ${fastest.provider} (${fastest.duration}ms)`);
    console.log(`💰 Cheapest: ${cheapest.provider} ($${cheapest.cost.toFixed(6)})`);
    console.log(`📝 Most Detailed: ${mostTokens.provider} (${mostTokens.tokens.total} tokens)`);
    console.log('');
  }

  console.log('💡 Provider Selection Guide:');
  console.log('─'.repeat(60));
  console.log('Anthropic Claude:');
  console.log('  • Best for: Analysis, coding, long context');
  console.log('  • Strengths: Reasoning, instruction following');
  console.log('  • Cost: Medium');
  console.log('');
  console.log('OpenAI GPT:');
  console.log('  • Best for: General purpose, creative writing');
  console.log('  • Strengths: Versatility, function calling');
  console.log('  • Cost: Medium-High');
  console.log('');
  console.log('Google Gemini:');
  console.log('  • Best for: Long documents, multimodal tasks');
  console.log('  • Strengths: Context length (2M tokens), speed');
  console.log('  • Cost: Low-Medium');
  console.log('─'.repeat(60) + '\n');

  console.log('🎯 Choosing a Provider:');
  console.log('   • Complex reasoning → Anthropic Claude Opus');
  console.log('   • General purpose → OpenAI GPT-4 or Claude Sonnet');
  console.log('   • Speed & cost → Gemini Flash or Claude Haiku');
  console.log('   • Long context → Google Gemini Pro (2M tokens)');
  console.log('   • Privacy → Local models (Ollama, LM Studio)\n');
}

main().catch(error => {
  displayError(error, 'Multiple providers example');
  process.exit(1);
});
