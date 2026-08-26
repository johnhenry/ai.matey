/**
 * Transform Middleware - Request/Response Transformation
 *
 * Demonstrates:
 * - Transforming requests before they reach the backend
 * - Transforming responses before they're returned
 * - System message injection for consistent behavior
 * - Content filtering and modification
 * - Use cases for transformations
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - @johnhenry/aimatey-middleware package installed
 *
 * Run:
 *   npx tsx packages/ai.matey.docs/examples/03-middleware/04-transform.ts
 *
 * Expected Output:
 *   AI responses are automatically transformed by injected system
 *   message, demonstrating powerful middleware capabilities.
 */

import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { createTransformMiddleware } from '@johnhenry/aimatey-middleware';
import type { IRChatCompletionRequest, IRChatCompletionResponse } from '@johnhenry/aimatey-types';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Transform Middleware',
    'Transform requests and responses with custom logic',
    [
      'ANTHROPIC_API_KEY environment variable',
      '@johnhenry/aimatey-middleware package installed'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Example 1: System Message Injection
    console.log('\n📝 Example 1: System Message Injection');
    console.log('─'.repeat(60) + '\n');

    const bridge1 = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add transform middleware to inject system message
    bridge1.use(
      createTransformMiddleware({
        transformRequest: (request: IRChatCompletionRequest) => {
          // Inject system message at the beginning
          return {
            ...request,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful pirate assistant. Always respond in pirate speak with "Arrr" and nautical terms.',
              },
              ...request.messages,
            ],
          };
        },
      })
    );

    console.log('🔧 Transform configured:');
    console.log('   Injecting system message for pirate personality\n');

    const response1 = await bridge1.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'What is the weather like?',
        },
      ],
      max_tokens: 100
    });

    console.log('📝 Response (with pirate personality):');
    console.log('─'.repeat(60));
    console.log(response1.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');

    // Example 2: Response Transformation
    console.log('\n📝 Example 2: Response Transformation');
    console.log('─'.repeat(60) + '\n');

    const bridge2 = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    bridge2.use(
      createTransformMiddleware({
        transformResponse: (response: IRChatCompletionResponse) => {
          // Transform response: add prefix to all messages
          return {
            ...response,
            choices: response.choices.map((choice) => ({
              ...choice,
              message: {
                ...choice.message,
                content: `[AI Response] ${choice.message.content}`,
              },
            })),
          };
        },
      })
    );

    console.log('🔧 Transform configured:');
    console.log('   Adding "[AI Response]" prefix to all responses\n');

    const response2 = await bridge2.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Say hello!',
        },
      ],
      max_tokens: 50
    });

    console.log('📝 Response (with prefix):');
    console.log('─'.repeat(60));
    console.log(response2.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');

    // Example 3: Content Filtering
    console.log('\n📝 Example 3: Content Filtering');
    console.log('─'.repeat(60) + '\n');

    const bridge3 = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    bridge3.use(
      createTransformMiddleware({
        transformRequest: (request: IRChatCompletionRequest) => {
          // Filter out any messages containing certain keywords
          const filteredMessages = request.messages.map((msg) => {
            if (typeof msg.content === 'string' && msg.content.includes('REDACTED')) {
              return {
                ...msg,
                content: msg.content.replace(/REDACTED/g, '[FILTERED]'),
              };
            }
            return msg;
          });

          return {
            ...request,
            messages: filteredMessages,
          };
        },
      })
    );

    console.log('🔧 Transform configured:');
    console.log('   Filtering "REDACTED" keyword from requests\n');

    const response3 = await bridge3.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'The password is REDACTED. What do you think?',
        },
      ],
      max_tokens: 50
    });

    console.log('📝 Response (keyword was filtered):');
    console.log('─'.repeat(60));
    console.log(response3.choices[0].message.content);
    console.log('─'.repeat(60) + '\n');

    console.log('💡 Use Cases for Transform Middleware:');
    console.log('   ✓ Inject system prompts for consistent behavior');
    console.log('   ✓ Add context to all requests automatically');
    console.log('   ✓ Filter sensitive content from requests/responses');
    console.log('   ✓ Modify temperature or other parameters');
    console.log('   ✓ Add metadata or tracking information');
    console.log('   ✓ Format responses consistently\n');

    console.log('🔧 Advanced Patterns:');
    console.log('   • Chain multiple transforms for complex logic');
    console.log('   • Conditional transforms based on request content');
    console.log('   • Token counting and limiting');
    console.log('   • Content moderation and safety filters');
    console.log('   • A/B testing different system prompts\n');

    console.log('⚠️  Important Considerations:');
    console.log('   • Transforms run on every request - keep them efficient');
    console.log('   • Be careful not to break request/response structure');
    console.log('   • Consider security implications of transformations');
    console.log('   • Test transforms thoroughly before production\n');

  } catch (error) {
    displayError(error, 'Transform middleware example');
    process.exit(1);
  }
}

main();
