/**
 * Testing Patterns - Mock, Stub, and Integration Tests
 *
 * Demonstrates:
 * - Mocking AI providers for unit tests
 * - Creating test fixtures and scenarios
 * - Integration testing strategies
 * - Snapshot testing for responses
 * - Performance testing
 *
 * Prerequisites:
 * - ai.matey.testing package installed (or custom mocks)
 * - Understanding of testing patterns
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/03-testing.ts
 *
 * Expected Output:
 *   Demonstration of various testing patterns with ai.matey,
 *   showing how to test AI-powered features reliably.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import type { IRChatCompletionRequest, IRChatCompletionResponse, IRChatCompletionChunk } from 'ai.matey.types';
import { displayExampleInfo } from '../_shared/helpers.js';

// Mock Backend Adapter
class MockBackendAdapter {
  private responses: Map<string, IRChatCompletionResponse> = new Map();
  private callHistory: IRChatCompletionRequest[] = [];

  setResponse(key: string, response: IRChatCompletionResponse) {
    this.responses.set(key, response);
  }

  async chat(request: IRChatCompletionRequest): Promise<IRChatCompletionResponse> {
    this.callHistory.push(request);

    const key = JSON.stringify(request.messages);
    const response = this.responses.get(key);

    if (!response) {
      return {
        id: 'mock-' + Date.now(),
        object: 'chat.completion',
        created: Date.now(),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Mock response',
            },
            finish_reason: 'stop',
          },
        ],
      };
    }

    return response;
  }

  async *chatStream(request: IRChatCompletionRequest): AsyncGenerator<IRChatCompletionChunk> {
    this.callHistory.push(request);

    const chunks = ['Mock', ' ', 'streaming', ' ', 'response'];
    for (const chunk of chunks) {
      yield {
        id: 'mock-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: request.model,
        choices: [
          {
            index: 0,
            delta: { content: chunk },
            finish_reason: null,
          },
        ],
      };
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    yield {
      id: 'mock-' + Date.now(),
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: request.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  }

  getCallHistory() {
    return this.callHistory;
  }

  getCallCount() {
    return this.callHistory.length;
  }

  reset() {
    this.callHistory = [];
    this.responses.clear();
  }
}

async function main() {
  displayExampleInfo(
    'Testing Patterns',
    'Mock, stub, and test AI-powered features reliably',
    [
      'Understanding of testing patterns',
      'Mock adapters for deterministic tests'
    ]
  );

  // Example 1: Basic Mocking
  console.log('\n═'.repeat(60));
  console.log('Example 1: Basic Mock Testing');
  console.log('═'.repeat(60) + '\n');

  const mockBackend = new MockBackendAdapter();
  const bridge = new Bridge(new OpenAIFrontendAdapter(), mockBackend as any);

  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });

  console.log('✓ Mock response received:', response.choices[0].message.content);
  console.log('✓ Call count:', mockBackend.getCallCount(), '\n');

  // Example 2: Custom Mock Responses
  console.log('═'.repeat(60));
  console.log('Example 2: Custom Mock Responses');
  console.log('═'.repeat(60) + '\n');

  mockBackend.reset();

  // Set up specific responses for different queries
  mockBackend.setResponse(
    JSON.stringify([{ role: 'user', content: 'What is 2+2?' }]),
    {
      id: 'test-1',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: '2+2 equals 4.' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }
  );

  const mathResponse = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'What is 2+2?' }],
  });

  console.log('Question: What is 2+2?');
  console.log('Answer:', mathResponse.choices[0].message.content);
  console.log('Tokens:', mathResponse.usage?.total_tokens, '\n');

  // Example 3: Streaming Tests
  console.log('═'.repeat(60));
  console.log('Example 3: Streaming Mock Test');
  console.log('═'.repeat(60) + '\n');

  console.log('Streaming response: ');
  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Count to 5' }],
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    if (chunk.choices && chunk.choices[0]?.delta?.content) {
      const content = chunk.choices[0].delta.content;
      process.stdout.write(content);
      fullText += content;
    }
  }

  console.log('\n\n✓ Full streamed text:', fullText, '\n');

  // Example 4: Request Validation
  console.log('═'.repeat(60));
  console.log('Example 4: Request Validation');
  console.log('═'.repeat(60) + '\n');

  mockBackend.reset();

  await bridge.chat({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Test' },
    ],
  });

  const history = mockBackend.getCallHistory();
  const lastRequest = history[history.length - 1];

  console.log('✓ Request captured:');
  console.log('  Model:', lastRequest.model);
  console.log('  Messages:', lastRequest.messages.length);
  console.log('  System prompt:', lastRequest.messages.find((m) => m.role === 'system')?.content);
  console.log('  User message:', lastRequest.messages.find((m) => m.role === 'user')?.content, '\n');

  // Example 5: Integration Test Pattern
  console.log('═'.repeat(60));
  console.log('Example 5: Integration Test Pattern');
  console.log('═'.repeat(60) + '\n');

  // Simulate a user flow
  console.log('Simulating multi-turn conversation...\n');

  const conversation = [
    { role: 'user' as const, content: 'Hello' },
    { role: 'assistant' as const, content: 'Hi! How can I help?' },
    { role: 'user' as const, content: 'What is AI?' },
  ];

  mockBackend.setResponse(
    JSON.stringify(conversation),
    {
      id: 'test-conv',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'AI stands for Artificial Intelligence...',
          },
          finish_reason: 'stop',
        },
      ],
    }
  );

  const convResponse = await bridge.chat({
    model: 'gpt-4',
    messages: conversation,
  });

  console.log('Conversation:');
  conversation.forEach((msg, i) => {
    console.log(`  ${i + 1}. ${msg.role}: ${msg.content}`);
  });
  console.log(`  4. assistant: ${convResponse.choices[0].message.content}\n`);

  console.log('✓ Total API calls in session:', mockBackend.getCallCount(), '\n');

  // Summary
  console.log('═'.repeat(60));
  console.log('Testing Best Practices');
  console.log('═'.repeat(60) + '\n');

  console.log('💡 Testing Strategies:');
  console.log('   ✓ Use mocks for unit tests (fast, deterministic)');
  console.log('   ✓ Use real APIs for integration tests (realistic)');
  console.log('   ✓ Test request validation separately');
  console.log('   ✓ Capture and assert on call history');
  console.log('   ✓ Test both streaming and non-streaming\n');

  console.log('📝 Test Structure:');
  console.log('   • Unit tests: Mock all AI calls');
  console.log('   • Integration tests: Use real APIs with test keys');
  console.log('   • E2E tests: Full user flows with real data');
  console.log('   • Performance tests: Measure latency and throughput\n');

  console.log('🔧 Useful Patterns:');
  console.log('   • Fixture files for common scenarios');
  console.log('   • Response snapshots for regression testing');
  console.log('   • Error injection for resilience testing');
  console.log('   • Rate limit simulation');
  console.log('   • Cost tracking in tests\n');
}

main();
