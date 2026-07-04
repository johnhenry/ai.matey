/**
 * Agentic tool loop: the model calls your tools until it can answer.
 *
 * Run: npx tsx examples/tools/run-tools.ts (requires OPENAI_API_KEY)
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { OpenAIBackendAdapter } from 'ai.matey.backend';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! })
);

const result = await bridge.runTools({
  prompt: 'What is the weather in San Francisco and New York? Which is warmer?',
  maxIterations: 5,
  tools: {
    get_weather: {
      description: 'Get the current temperature for a city, in Fahrenheit',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City name' } },
        required: ['city'],
      },
      // Handlers run in parallel when the model requests several tools at once
      execute: ({ city }) => ({
        city,
        temperature: city === 'San Francisco' ? 64 : 78,
        conditions: 'sunny',
      }),
    },
  },
  onStepFinish: (step) => {
    console.log(`step ${step.iteration}: ${step.toolCalls.length} tool call(s)`);
  },
});

console.log('\nAnswer:', result.text);
console.log('Iterations:', result.steps.length, '| Tokens:', result.totalUsage.totalTokens);
