/**
 * Test helper utilities - assertions and test builders
 */

import { expect } from 'vitest';
import type {
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
  IRMessage,
  MessageContent,
} from 'ai.matey.types';

/**
 * Assert that a response has the correct structure
 */
export function assertValidChatResponse(response: IRChatResponse): void {
  expect(response).toBeDefined();
  expect(response.message).toBeDefined();
  expect(response.message.role).toBe('assistant');
  expect(response.message.content).toBeDefined();
  expect(Array.isArray(response.message.content)).toBe(true);
  expect(response.message.content.length).toBeGreaterThan(0);
  expect(response.usage).toBeDefined();
  if (response.usage) {
    expect(response.usage.promptTokens).toBeGreaterThanOrEqual(0);
    expect(response.usage.completionTokens).toBeGreaterThanOrEqual(0);
    expect(response.usage.totalTokens).toBeGreaterThanOrEqual(0);
  }
  expect(response.finishReason).toBeDefined();
  expect(['stop', 'length', 'tool_use', 'content_filter']).toContain(response.finishReason);
  expect(response.metadata).toBeDefined();
  expect(response.metadata.requestId).toBeDefined();
  expect(response.metadata.timestamp).toBeDefined();
}

/**
 * Assert that a stream chunk has the correct structure
 */
export function assertValidStreamChunk(chunk: IRStreamChunk): void {
  expect(chunk).toBeDefined();
  expect(chunk.type).toBeDefined();
  expect(['start', 'content', 'tool_use', 'error', 'metadata', 'done']).toContain(chunk.type);
}

/**
 * Assert that a request has the correct structure
 */
export function assertValidChatRequest(request: IRChatRequest): void {
  expect(request).toBeDefined();
  expect(request.messages).toBeDefined();
  expect(Array.isArray(request.messages)).toBe(true);
  expect(request.messages.length).toBeGreaterThan(0);

  // Validate each message
  for (const message of request.messages) {
    assertValidMessage(message);
  }

  expect(request.parameters).toBeDefined();
  expect(request.metadata).toBeDefined();
  expect(request.metadata.requestId).toBeDefined();
  expect(request.metadata.timestamp).toBeDefined();
}

/**
 * Assert that a message has the correct structure
 */
export function assertValidMessage(message: IRMessage): void {
  expect(message).toBeDefined();
  expect(message.role).toBeDefined();
  expect(['user', 'assistant', 'system', 'tool']).toContain(message.role);
  expect(message.content).toBeDefined();

  if (Array.isArray(message.content)) {
    expect(message.content.length).toBeGreaterThan(0);
    for (const content of message.content) {
      assertValidMessageContent(content);
    }
  }
}

/**
 * Assert that message content has the correct structure
 */
export function assertValidMessageContent(content: MessageContent): void {
  expect(content).toBeDefined();
  expect(content.type).toBeDefined();

  switch (content.type) {
    case 'text':
      expect(content.text).toBeDefined();
      expect(typeof content.text).toBe('string');
      break;

    case 'image':
      expect(content.source).toBeDefined();
      expect(content.source.type).toBeDefined();
      break;

    case 'tool_use':
      expect(content.id).toBeDefined();
      expect(content.name).toBeDefined();
      expect(content.input).toBeDefined();
      break;

    case 'tool_result':
      expect(content.toolUseId).toBeDefined();
      expect(content.content).toBeDefined();
      break;
  }
}

/**
 * Assert that response contains text
 */
export function assertResponseHasText(response: IRChatResponse): void {
  if (!Array.isArray(response.message.content)) {
    throw new Error('Response content must be an array');
  }
  const textContent = response.message.content.find((c: MessageContent) => c.type === 'text');
  expect(textContent).toBeDefined();
  if (textContent?.type === 'text') {
    expect(textContent.text).toBeDefined();
    expect(textContent.text.length).toBeGreaterThan(0);
  }
}

/**
 * Assert that response contains tool use
 */
export function assertResponseHasToolUse(response: IRChatResponse): void {
  if (!Array.isArray(response.message.content)) {
    throw new Error('Response content must be an array');
  }
  const toolUse = response.message.content.find((c: MessageContent) => c.type === 'tool_use');
  expect(toolUse).toBeDefined();
  if (toolUse?.type === 'tool_use') {
    expect(toolUse.id).toBeDefined();
    expect(toolUse.name).toBeDefined();
    expect(toolUse.input).toBeDefined();
  }
  expect(response.finishReason).toBe('tool_use');
}

/**
 * Assert that streaming produces expected sequence
 */
export async function assertValidStreamSequence(
  stream: AsyncIterable<IRStreamChunk>
): Promise<IRStreamChunk[]> {
  const chunks: IRStreamChunk[] = [];

  for await (const chunk of stream) {
    assertValidStreamChunk(chunk);
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(0);

  // First chunk should be 'start'
  const firstChunk = chunks[0];
  if (firstChunk) {
    expect(firstChunk.type).toBe('start');
  }

  // Last chunk should be 'done'
  const lastChunk = chunks[chunks.length - 1];
  if (lastChunk) {
    expect(lastChunk.type).toBe('done');
  }

  return chunks;
}

/**
 * Build a simple chat request for testing
 */
export function buildChatRequest(
  userMessage: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemMessage?: string;
  }
): IRChatRequest {
  const messages: IRMessage[] = [];

  if (options?.systemMessage) {
    messages.push({
      role: 'system',
      content: [{ type: 'text', text: options.systemMessage }],
    });
  }

  messages.push({
    role: 'user',
    content: [{ type: 'text', text: userMessage }],
  });

  return {
    messages,
    parameters: {
      model: options?.model || 'test-model',
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 100,
    },
    metadata: {
      requestId: `test-${Date.now()}`,
      timestamp: Date.now(),
    },
  };
}

/**
 * Build a multi-turn chat request for testing
 */
export function buildMultiTurnRequest(
  exchanges: Array<{ user: string; assistant: string }>,
  finalUserMessage: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): IRChatRequest {
  const messages: IRMessage[] = [];

  for (const exchange of exchanges) {
    messages.push({
      role: 'user',
      content: [{ type: 'text', text: exchange.user }],
    });
    messages.push({
      role: 'assistant',
      content: [{ type: 'text', text: exchange.assistant }],
    });
  }

  messages.push({
    role: 'user',
    content: [{ type: 'text', text: finalUserMessage }],
  });

  return {
    messages,
    parameters: {
      model: options?.model || 'test-model',
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 100,
    },
    metadata: {
      requestId: `test-${Date.now()}`,
      timestamp: Date.now(),
    },
  };
}

/**
 * Extract text from response
 */
export function extractTextFromResponse(response: IRChatResponse): string {
  if (!Array.isArray(response.message.content)) {
    return '';
  }
  const textContent = response.message.content.filter((c: MessageContent) => c.type === 'text');
  return textContent.map((c: MessageContent) => (c.type === 'text' ? c.text : '')).join('');
}

/**
 * Extract tool uses from response
 */
export function extractToolUsesFromResponse(response: IRChatResponse): Array<{
  id: string;
  name: string;
  input: unknown;
}> {
  if (!Array.isArray(response.message.content)) {
    return [];
  }
  return response.message.content
    .filter((c: MessageContent) => c.type === 'tool_use')
    .map((c: MessageContent) => {
      if (c.type === 'tool_use') {
        return {
          id: c.id,
          name: c.name,
          input: c.input,
        };
      }
      return null!;
    })
    .filter(Boolean);
}

/**
 * Accumulate text from stream chunks
 */
export async function accumulateStreamText(stream: AsyncIterable<IRStreamChunk>): Promise<string> {
  let text = '';

  for await (const chunk of stream) {
    if (chunk.type === 'content' && chunk.delta) {
      text += chunk.delta;
    }
  }

  return text;
}

/**
 * Count tokens in text (rough estimate)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Assert that usage statistics are reasonable
 */
export function assertReasonableUsage(response: IRChatResponse): void {
  const { usage } = response;

  if (!usage) {
    throw new Error('Response must have usage statistics');
  }

  // Tokens should be positive
  expect(usage.promptTokens).toBeGreaterThan(0);
  expect(usage.completionTokens).toBeGreaterThan(0);
  expect(usage.totalTokens).toBeGreaterThan(0);

  // Total should equal sum
  expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens);

  // Token counts should be reasonable (not absurdly high)
  expect(usage.totalTokens).toBeLessThan(1000000);
}
