/**
 * Testing Example - Using Testing Package
 *
 * Shows how to use the testing utilities package for
 * unit and integration testing with ai.matey.
 */

// Testing utilities
import {
  MockBackendAdapter,
  createMockResponse,
  createMockStreamResponse,
  assertChatRequest,
  assertStreamChunk,
} from 'ai.matey.testing';

// Core imports
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';

// Types
import type { IRChatRequest, IRChatResponse } from 'ai.matey.types';

async function main() {
  console.log('=== Testing Examples ===\n');

  // Example 1: Basic mock testing
  console.log('1. Basic Mock Testing:');
  await basicMockTest();

  // Example 2: Custom mock responses
  console.log('\n2. Custom Mock Responses:');
  await customMockTest();

  // Example 3: Stream testing
  console.log('\n3. Stream Testing:');
  await streamMockTest();

  // Example 4: Request validation
  console.log('\n4. Request Validation:');
  requestValidationTest();
}

async function basicMockTest() {
  // Create a mock backend that returns predefined responses
  const mockBackend = new MockBackendAdapter({
    defaultResponse: createMockResponse({
      content: 'This is a mock response for testing!',
      model: 'mock-model',
    }),
  });

  // Create bridge with mock backend
  const bridge = new Bridge(new OpenAIFrontendAdapter(), mockBackend);

  // Make request - will return mock response
  const response = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
  });

  console.log('  Mock response:', response.choices[0].message.content);
  console.log('  Calls made:', mockBackend.getCallCount());
}

async function customMockTest() {
  // Create mock with custom response handler
  const mockBackend = new MockBackendAdapter({
    responseHandler: (request: IRChatRequest): IRChatResponse => {
      // Return different responses based on input
      const userMessage = request.messages.find((m) => m.role === 'user');
      const content = typeof userMessage?.content === 'string' ? userMessage.content : '';

      if (content.toLowerCase().includes('error')) {
        throw new Error('Simulated error for testing');
      }

      if (content.toLowerCase().includes('weather')) {
        return createMockResponse({
          content: 'The weather is sunny with a high of 72°F.',
          model: request.model,
        });
      }

      return createMockResponse({
        content: `You said: ${content}`,
        model: request.model,
      });
    },
  });

  const bridge = new Bridge(new OpenAIFrontendAdapter(), mockBackend);

  // Test weather response
  const weatherResponse = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'What is the weather?' }],
  });
  console.log('  Weather response:', weatherResponse.choices[0].message.content);

  // Test echo response
  const echoResponse = await bridge.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Testing echo' }],
  });
  console.log('  Echo response:', echoResponse.choices[0].message.content);

  // Test error handling
  try {
    await bridge.chat({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Trigger an error' }],
    });
  } catch (error) {
    console.log('  Error caught:', (error as Error).message);
  }
}

async function streamMockTest() {
  // Create mock with streaming support
  const mockBackend = new MockBackendAdapter({
    streamResponse: createMockStreamResponse({
      chunks: ['Hello', ' ', 'from', ' ', 'streaming', '!'],
      delayMs: 50,
    }),
  });

  const bridge = new Bridge(new OpenAIFrontendAdapter(), mockBackend);

  // Get stream
  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Stream test' }],
    stream: true,
  });

  // Collect stream output
  process.stdout.write('  Stream output: ');
  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
      // Validate each chunk
      assertStreamChunk(chunk);
    }
  }
  console.log();
}

function requestValidationTest() {
  // Validate chat requests
  const validRequest: IRChatRequest = {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello!' },
    ],
    temperature: 0.7,
    maxTokens: 100,
  };

  try {
    assertChatRequest(validRequest);
    console.log('  Valid request passed validation ✓');
  } catch (error) {
    console.log('  Valid request failed:', (error as Error).message);
  }

  // Test invalid request
  const invalidRequest = {
    model: '', // Empty model
    messages: [], // Empty messages
  };

  try {
    assertChatRequest(invalidRequest as IRChatRequest);
    console.log('  Invalid request should have failed');
  } catch (error) {
    console.log('  Invalid request correctly rejected ✓');
  }
}

main().catch(console.error);
