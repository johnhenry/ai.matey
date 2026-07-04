/**
 * Complexity routing: cheap models for simple queries, capable models for
 * hard ones — plus rate-limited batch processing.
 *
 * Run: npx tsx examples/patterns/complexity-routing.ts
 * (requires OPENAI_API_KEY and ANTHROPIC_API_KEY)
 */

import { createComplexityRouter, createBatchProcessor } from 'ai.matey.patterns';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.backend';

const router = createComplexityRouter({
  tiers: [
    { backend: 'fast', maxComplexity: 40 },
    { backend: 'powerful', maxComplexity: 100 },
  ],
  backends: {
    fast: new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY!,
      defaultModel: 'gpt-5-mini',
    }),
    powerful: new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultModel: 'claude-sonnet-4-5-20250929',
    }),
  },
});

const bridge = new Bridge(new OpenAIFrontendAdapter(), router);

const processor = createBatchProcessor({
  execute: (prompt: string) =>
    bridge.chat({ model: 'auto', messages: [{ role: 'user', content: prompt }] }),
  concurrency: 3,
  requestsPerSecond: 5,
});

const prompts = [
  'What is 2+2?',
  'Explain step by step the trade-offs between optimistic and pessimistic locking, and design a hybrid scheme.',
];

const results = await processor.addAll(prompts);
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`\n[${prompts[index]}]\n${result.value.choices[0]?.message.content}`);
  }
});
processor.dispose();
