/**
 * Retryability Classification Tests
 *
 * Regression tests for #70: four sites classified `isRetryable` and they
 * disagreed, so the same fault was transient or permanent depending on which
 * path reached it - and `isRetryable` is the only thing retry logic keys off.
 *
 * Covers:
 * - `RouterError` derives `ALL_BACKENDS_FAILED` retryability from the leaf
 *   failures instead of asserting it from the code
 * - every `ALL_BACKENDS_FAILED` in the router is built by `RouterError`, so the
 *   parallel and sequential paths give one answer rather than three
 * - `Bridge`'s retry loop and `defaultShouldRetry` agree on unknown errors
 * - `408` and `425` are retryable; `404`, `409` and `422` are not
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Bridge, Router } from '@johnhenry/aimatey-core';
import { createRetryMiddleware } from '@johnhenry/aimatey-middleware';
import {
  AdapterError,
  AuthenticationError,
  ErrorCode,
  NetworkError,
  RouterError,
  createErrorFromHttpResponse,
} from '@johnhenry/aimatey-errors';
import type {
  BackendAdapter,
  FrontendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

// ============================================================================
// Test Helpers
// ============================================================================

const CAPABILITIES = {
  streaming: true,
  multiModal: false,
  tools: false,
  systemMessageStrategy: 'in-messages',
  supportsMultipleSystemMessages: true,
} as const;

const HELLO = { messages: [{ role: 'user', content: 'Hello' }] };

/** A transient, retryable failure. */
function retryableFailure(message = 'connection reset'): NetworkError {
  return new NetworkError({
    code: ErrorCode.NETWORK_ERROR,
    message,
    provenance: {},
  });
}

/** A permanent failure - retrying cannot help, the key is still wrong. */
function permanentFailure(message = 'invalid api key'): AuthenticationError {
  return new AuthenticationError({
    code: ErrorCode.INVALID_API_KEY,
    message,
    provenance: {},
  });
}

function createMockFrontend(): FrontendAdapter {
  return {
    metadata: {
      name: 'mock-frontend',
      version: '1.0.0',
      provider: 'Mock',
      capabilities: CAPABILITIES,
    },
    toIR: (request: { messages?: unknown[] }) => ({
      messages: request.messages ?? [],
      metadata: { requestId: 'test-req-id', timestamp: Date.now(), provenance: {} },
    }),
    fromIR: (response: IRChatResponse) => ({
      id: response.metadata.requestId,
      content: response.message.content,
    }),
    fromIRStream: async function* (stream: AsyncIterable<IRStreamChunk>) {
      for await (const chunk of stream) {
        yield chunk;
      }
    },
  } as unknown as FrontendAdapter;
}

interface CountingBackend {
  readonly adapter: BackendAdapter;
  attempts(): number;
}

/** Backend that always fails with `error`, counting how often it was reached. */
function createFailingBackend(name: string, error: () => unknown): CountingBackend {
  let attempts = 0;

  const adapter = {
    metadata: { name, version: '1.0.0', provider: 'Mock', capabilities: CAPABILITIES },
    fromIR: (request: unknown) => request,
    toIR: (response: unknown) => response,
    execute: async (): Promise<IRChatResponse> => {
      attempts++;
      throw error();
    },
    executeStream: async function* (): AsyncGenerator<IRStreamChunk, void, undefined> {
      attempts++;
      throw error();
    },
  } as unknown as BackendAdapter;

  return { adapter, attempts: () => attempts };
}

function createTestRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model: 'test-model' },
    stream: false,
    metadata: { requestId: 'test-req-id', timestamp: Date.now(), provenance: {} },
  } as IRChatRequest;
}

// ============================================================================
// RouterError derives its classification
// ============================================================================

describe('RouterError derives ALL_BACKENDS_FAILED retryability from its leaves', () => {
  it('is non-retryable when every backend failed non-retryably', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
      backendErrors: [permanentFailure(), permanentFailure()],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('is retryable when at least one backend failed retryably', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
      backendErrors: [permanentFailure(), retryableFailure()],
    });

    expect(error.isRetryable).toBe(true);
  });

  it('is non-retryable when no backend errors were carried', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('is non-retryable for leaves that carry no classification at all', () => {
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      backendErrors: [new Error('plain'), new TypeError('also plain')],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('reads the flag duck-typed, so a second copy of the package still works', () => {
    // A cause from a duplicated install fails `instanceof AdapterError` but
    // still carries the flag; the classification must not be lost to that.
    const foreign = Object.assign(new Error('from another realm'), { isRetryable: true });

    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      backendErrors: [foreign],
    });

    expect(foreign).not.toBeInstanceOf(AdapterError);
    expect(error.isRetryable).toBe(true);
  });

  it('stays non-retryable for routing failures regardless of leaves', () => {
    const error = new RouterError({
      code: ErrorCode.ROUTING_FAILED,
      message: 'No route found',
      backendErrors: [retryableFailure()],
    });

    expect(error.isRetryable).toBe(false);
  });

  it('keeps the leaf failures for diagnostics', () => {
    const leaves = [permanentFailure('key a'), permanentFailure('key b')];
    const error = new RouterError({
      code: ErrorCode.ALL_BACKENDS_FAILED,
      message: 'All backends failed',
      attemptedBackends: ['a', 'b'],
      backendErrors: leaves,
    });

    expect(error.backendErrors).toEqual(leaves);
    expect(error.toJSON().details).toMatchObject({
      attemptedBackends: ['a', 'b'],
      backendErrors: [
        { name: 'AuthenticationError', code: ErrorCode.INVALID_API_KEY, isRetryable: false },
        { name: 'AuthenticationError', code: ErrorCode.INVALID_API_KEY, isRetryable: false },
      ],
    });
  });
});
