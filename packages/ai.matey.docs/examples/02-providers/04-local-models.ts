/**
 * Local Models - Ollama and LM Studio
 *
 * Demonstrates:
 * - Running AI models locally with Ollama
 * - Using LM Studio for local inference
 * - Benefits of local models (privacy, cost, speed)
 * - Hybrid local + cloud strategies
 * - Fallback from local to cloud
 *
 * Prerequisites:
 * - Ollama installed and running (https://ollama.ai)
 *   Run: ollama run llama3.2
 * - OR LM Studio running (https://lmstudio.ai)
 * - Optional: ANTHROPIC_API_KEY for hybrid example
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/02-providers/04-local-models.ts
 *
 * Expected Output:
 *   Responses from local models, demonstrating privacy-first
 *   AI inference with optional cloud fallback.
 */

import { Bridge, Router } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { OllamaBackendAdapter } from '@johnhenry/aimatey-backend/ollama';
import { LMStudioBackendAdapter } from '@johnhenry/aimatey-backend/lmstudio';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { displayExampleInfo, displayResponse, displayError } from '../_shared/helpers.js';
import { loadAPIKeys } from '../_shared/env-loader.js';

async function main() {
  displayExampleInfo(
    'Local Models - Privacy-First AI',
    'Run AI models locally on your machine',
    [
      'Ollama installed and running: ollama run llama3.2',
      'OR LM Studio running with a model loaded',
      'Optional: ANTHROPIC_API_KEY for hybrid examples'
    ]
  );

  // Example 1: Ollama Local Inference
  console.log('\n📝 Example 1: Ollama Local Inference');
  console.log('─'.repeat(60) + '\n');

  try {
    const ollamaBridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new OllamaBackendAdapter({
        baseURL: 'http://localhost:11434', // Default Ollama port
        model: 'llama3.2', // or llama3, mistral, etc.
      })
    );

    console.log('Using Ollama with llama3.2...');
    console.log('💡 Running 100% locally - no data leaves your machine\n');

    const response1 = await ollamaBridge.chat({
      model: 'llama3.2',
      messages: [
        {
          role: 'user',
          content: 'Explain local AI inference in 2 sentences.',
        },
      ],
      max_tokens: 100
    });

    displayResponse(response1, 'Ollama Response');

    console.log('✓ Ollama is running!\n');
  } catch (error) {
    console.log('✗ Ollama not available');
    console.log('  To use Ollama:');
    console.log('  1. Install: https://ollama.ai');
    console.log('  2. Run: ollama run llama3.2');
    console.log('  3. Try this example again\n');
  }

  // Example 2: LM Studio Local Inference
  console.log('📝 Example 2: LM Studio Local Inference');
  console.log('─'.repeat(60) + '\n');

  try {
    const lmStudioBridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new LMStudioBackendAdapter({
        baseURL: 'http://localhost:1234', // Default LM Studio port
      })
    );

    console.log('Using LM Studio...');
    console.log('💡 LM Studio provides OpenAI-compatible API\n');

    const response2 = await lmStudioBridge.chat({
      model: 'local-model', // LM Studio uses whatever model is loaded
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2?',
        },
      ],
      max_tokens: 50
    });

    displayResponse(response2, 'LM Studio Response');

    console.log('✓ LM Studio is running!\n');
  } catch (error) {
    console.log('✗ LM Studio not available');
    console.log('  To use LM Studio:');
    console.log('  1. Install: https://lmstudio.ai');
    console.log('  2. Load a model');
    console.log('  3. Start local server');
    console.log('  4. Try this example again\n');
  }

  // Example 3: Hybrid Local + Cloud
  console.log('📝 Example 3: Hybrid Local + Cloud (Fallback)');
  console.log('─'.repeat(60) + '\n');

  const keys = loadAPIKeys();

  if (keys.anthropic) {
    try {
      // Create router that tries local first, falls back to cloud
      const backends = [
        // Primary: Local Ollama (fast, private, free)
        new OllamaBackendAdapter({
          baseURL: 'http://localhost:11434',
          model: 'llama3.2',
        }),
        // Fallback: Anthropic cloud (reliable, but costs money)
        new AnthropicBackendAdapter({
          apiKey: keys.anthropic,
        }),
      ];

      const router = new Router(backends, {
        strategy: 'priority', // Try in order
        fallbackOnError: true,
      });

      const hybridBridge = new Bridge(
        new OpenAIFrontendAdapter(),
        router
      );

      console.log('Trying local Ollama first, cloud fallback if unavailable...\n');

      const response3 = await hybridBridge.chat({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'What is the capital of Japan?',
          },
        ],
        max_tokens: 50
      });

      displayResponse(response3, 'Hybrid Response');

      console.log('💡 Best of both worlds:');
      console.log('   • Local: Fast, private, free (when available)');
      console.log('   • Cloud: Reliable fallback (always available)\n');
    } catch (error) {
      console.log('✗ Both local and cloud unavailable\n');
    }
  } else {
    console.log('⚠️  Skipped: Set ANTHROPIC_API_KEY to try hybrid mode\n');
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('Local Models Summary');
  console.log('═'.repeat(60) + '\n');

  console.log('💡 Benefits of Local Models:');
  console.log('   ✓ Complete privacy (data never leaves your machine)');
  console.log('   ✓ Zero API costs (run unlimited queries)');
  console.log('   ✓ No rate limits');
  console.log('   ✓ Works offline');
  console.log('   ✓ Full control over model versions\n');

  console.log('⚠️  Considerations:');
  console.log('   • Requires local compute resources (GPU recommended)');
  console.log('   • Models may be less capable than cloud models');
  console.log('   • Slower inference without GPU');
  console.log('   • Need to manage model downloads\n');

  console.log('🎯 Best Use Cases:');
  console.log('   • Privacy-sensitive applications');
  console.log('   • Development and testing');
  console.log('   • High-volume applications');
  console.log('   • Offline environments');
  console.log('   • Cost optimization\n');

  console.log('🔧 Popular Local Models:');
  console.log('   • Llama 3.2 (Meta) - 3B/8B parameters');
  console.log('   • Mistral 7B - Fast and capable');
  console.log('   • Phi-3 (Microsoft) - Small and efficient');
  console.log('   • Qwen - Multilingual support');
  console.log('   • Code Llama - Specialized for code\n');
}

main().catch(error => {
  displayError(error, 'Local models example');
  process.exit(1);
});
