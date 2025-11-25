/**
 * Fixture helpers - utilities for using fixtures in tests
 */

import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';
import type { Fixture, ChatFixture, StreamingFixture } from './fixture-types.js';
import { isChatFixture, isStreamingFixture } from './fixture-types.js';

/**
 * Simple mock backend from a fixture (for testing)
 */
export interface SimpleMockBackend {
  readonly name: string;
  chat(_request: IRChatRequest): Promise<IRChatResponse>;
  chatStream?(_request: IRChatRequest): AsyncIterable<IRStreamChunk>;
}

/**
 * Create a mock backend adapter from a fixture
 */
export function createMockFromFixture(fixture: Fixture): SimpleMockBackend {
  if (isChatFixture(fixture)) {
    return createMockFromChatFixture(fixture);
  } else {
    return createMockFromStreamingFixture(fixture);
  }
}

/**
 * Create a mock backend adapter from a chat fixture
 */
function createMockFromChatFixture(fixture: ChatFixture): SimpleMockBackend {
  return {
    name: `mock-${fixture.metadata.provider}`,

    async chat(_request: IRChatRequest): Promise<IRChatResponse> {
      return fixture.response;
    },
  };
}

/**
 * Create a mock backend adapter from a streaming fixture
 */
function createMockFromStreamingFixture(fixture: StreamingFixture): SimpleMockBackend {
  return {
    name: `mock-${fixture.metadata.provider}`,

    async *chatStream(_request: IRChatRequest): AsyncIterable<IRStreamChunk> {
      for (const chunk of fixture.chunks) {
        yield chunk;
      }
    },

    async chat(_request: IRChatRequest): Promise<IRChatResponse> {
      if (!fixture.finalResponse) {
        throw new Error('Fixture does not have a final response');
      }
      return fixture.finalResponse;
    },
  };
}

/**
 * Replay streaming fixture with timing
 */
export async function* replayStreamWithTiming(
  fixture: StreamingFixture,
  options?: {
    /** Delay between chunks in ms */
    chunkDelay?: number;
    /** Speed multiplier (1.0 = real-time, 2.0 = 2x speed, 0.5 = half speed) */
    speedMultiplier?: number;
  }
): AsyncIterable<IRStreamChunk> {
  const delay = options?.chunkDelay ?? 10;
  const speedMultiplier = options?.speedMultiplier ?? 1.0;
  const actualDelay = delay / speedMultiplier;

  for (const chunk of fixture.chunks) {
    yield chunk;

    // Delay before next chunk (simulate network latency)
    if (actualDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, actualDelay));
    }
  }
}

/**
 * Create multiple mocks from multiple fixtures
 */
export function createMocksFromFixtures(
  fixtures: Fixture[]
): Map<string, SimpleMockBackend> {
  const mocks = new Map<string, SimpleMockBackend>();

  for (const fixture of fixtures) {
    const key = `${fixture.metadata.provider}-${fixture.metadata.scenario}`;
    mocks.set(key, createMockFromFixture(fixture));
  }

  return mocks;
}

/**
 * Check if a fixture is for streaming
 */
export function fixtureIsStreaming(fixture: Fixture): boolean {
  return isStreamingFixture(fixture);
}

/**
 * Validate that a response matches a fixture
 */
export function validateAgainstFixture(
  response: IRChatResponse,
  fixture: ChatFixture,
  options?: {
    /** Check exact match (default: false) */
    exact?: boolean;
    /** Fields to ignore when comparing */
    ignoreFields?: string[];
  }
): boolean {
  const ignoreFields = new Set(options?.ignoreFields || ['metadata.timestamp', 'metadata.requestId']);

  if (options?.exact) {
    // Deep equality check (minus ignored fields)
    return deepEqual(response, fixture.response, ignoreFields);
  }

  // Basic structure check
  if (!response.message || !response.message.content) {
    return false;
  }

  // Check message role matches
  if (response.message.role !== fixture.response.message.role) {
    return false;
  }

  // Check has content
  if (response.message.content.length === 0) {
    return false;
  }

  return true;
}

/**
 * Deep equality check with ignored fields
 */
function deepEqual(
  obj1: unknown,
  obj2: unknown,
  ignoreFields: Set<string>,
  path = ''
): boolean {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
    return obj1 === obj2;
  }

  const keys1 = Object.keys(obj1 as object);
  const keys2 = Object.keys(obj2 as object);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    const fullPath = path ? `${path}.${key}` : key;

    if (ignoreFields.has(fullPath)) continue;

    const val1 = (obj1 as Record<string, unknown>)[key];
    const val2 = (obj2 as Record<string, unknown>)[key];

    if (!deepEqual(val1, val2, ignoreFields, fullPath)) {
      return false;
    }
  }

  return true;
}

/**
 * Extract request from fixture (useful for replaying)
 */
export function extractRequest(fixture: Fixture): IRChatRequest {
  return fixture.request;
}

/**
 * Extract response from fixture
 */
export function extractResponse(fixture: ChatFixture): IRChatResponse {
  return fixture.response;
}

/**
 * Extract streaming chunks from fixture
 */
export function extractChunks(fixture: StreamingFixture): readonly IRStreamChunk[] {
  return fixture.chunks;
}

/**
 * Collect streaming chunks into a single response
 */
export function collectChunksToResponse(
  chunks: readonly IRStreamChunk[]
): IRChatResponse {
  let textContent = '';
  const role: 'assistant' | 'user' | 'system' | 'tool' = 'assistant';

  for (const chunk of chunks) {
    if (chunk.type === 'content') {
      textContent += chunk.delta || '';
    }
  }

  return {
    message: {
      role,
      content: [{ type: 'text', text: textContent }],
    },
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    finishReason: 'stop',
    metadata: {
      requestId: 'collected-from-chunks',
      timestamp: Date.now(),
    },
  };
}

/**
 * Create a test-friendly mock with custom responses
 */
export function createConfigurableMock(
  name: string,
  defaultResponse?: IRChatResponse
): SimpleMockBackend & {
  setResponse: (response: IRChatResponse) => void;
  setStreamChunks: (chunks: IRStreamChunk[]) => void;
  setError: (error: Error) => void;
  reset: () => void;
} {
  let response: IRChatResponse | undefined = defaultResponse;
  let streamChunks: IRStreamChunk[] | undefined;
  let error: Error | undefined;

  const mock = {
    name,

    async chat(_request: IRChatRequest): Promise<IRChatResponse> {
      if (error) throw error;
      if (!response) {
        throw new Error('Mock has no response configured');
      }
      return response;
    },

    async *chatStream(_request: IRChatRequest): AsyncIterable<IRStreamChunk> {
      if (error) throw error;
      if (!streamChunks || streamChunks.length === 0) {
        throw new Error('Mock has no stream chunks configured');
      }
      for (const chunk of streamChunks) {
        yield chunk;
      }
    },

    setResponse(newResponse: IRChatResponse) {
      response = newResponse;
      error = undefined;
    },

    setStreamChunks(chunks: IRStreamChunk[]) {
      streamChunks = chunks;
      error = undefined;
    },

    setError(newError: Error) {
      error = newError;
      response = undefined;
      streamChunks = undefined;
    },

    reset() {
      response = defaultResponse;
      streamChunks = undefined;
      error = undefined;
    },
  };

  return mock;
}
