/**
 * Multi-Backend Router Example - Cross-Package Usage
 *
 * Shows how to use packages from different categories together:
 * - Core (Router)
 * - Frontend adapters
 * - Multiple backend adapters
 */

// Direct package imports for tree-shaking
import { Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
import { GroqBackendAdapter } from 'ai.matey.backend/groq';

async function main() {
  // Create router with multiple backends
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: [
      // Priority 1: OpenAI
      new OpenAIBackendAdapter({
        apiKey: process.env.OPENAI_API_KEY || 'sk-...',
      }),
      // Priority 2: Anthropic
      new AnthropicBackendAdapter({
        apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
      }),
      // Priority 3: Gemini
      new GeminiBackendAdapter({
        apiKey: process.env.GOOGLE_API_KEY || 'AIza...',
      }),
      // Priority 4: Groq (fast inference)
      new GroqBackendAdapter({
        apiKey: process.env.GROQ_API_KEY || 'gsk_...',
      }),
    ],
    strategy: 'round-robin', // Distribute load across backends
    fallbackStrategy: 'next', // Auto-failover on errors
  });

  // Listen to routing events
  router.on('backend:switch', (event) => {
    console.log(`Switched to backend: ${event.data.backend}`);
  });

  router.on('request:retry', (event) => {
    console.log(`Retrying request: attempt ${event.data.attempt}`);
  });

  // Make multiple requests to see load balancing
  console.log('Making 5 requests with round-robin routing...\n');

  for (let i = 1; i <= 5; i++) {
    try {
      const response = await router.chat({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: `Request ${i}: What is ${i} + ${i}?`,
          },
        ],
      });

      console.log(`Request ${i} response:`, response.choices[0].message.content);
    } catch (error) {
      console.error(`Request ${i} failed:`, error);
    }
  }

  // Print routing statistics
  console.log('\nRouter Statistics:');
  console.log(JSON.stringify(router.getStats(), null, 2));
}

main().catch(console.error);
