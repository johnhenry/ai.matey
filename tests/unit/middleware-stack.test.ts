/**
 * Middleware Stack Tests
 *
 * Tests for middleware stack composition and execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MiddlewareStack,
  createMiddlewareContext,
  createStreamingMiddlewareContext,
} from 'ai.matey.core';
import type {
  Middleware,
  StreamingMiddleware,
  MiddlewareContext,
  StreamingMiddlewareContext,
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
} from 'ai.matey.types';
import { MiddlewareError } from 'ai.matey.errors';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestRequest(): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    metadata: {
      requestId: 'test-req-id',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

function createTestResponse(): IRChatResponse {
  return {
    message: { role: 'assistant', content: 'Hi!' },
    finishReason: 'stop',
    metadata: {
      requestId: 'test-req-id',
      provenance: { backend: 'test' },
    },
  };
}

function createTestMiddleware(name: string, log: string[]): Middleware {
  return async function middleware(context, next) {
    log.push(`${name}-before`);
    const result = await next();
    log.push(`${name}-after`);
    return result;
  };
}

function createModifyingMiddleware(name: string, modifier: (ctx: MiddlewareContext) => void): Middleware {
  return async function middleware(context, next) {
    modifier(context);
    return next();
  };
}

async function* createTestStream(): IRChatStream {
  yield { type: 'start', sequence: 0, metadata: { requestId: 'test', provenance: {} } };
  yield { type: 'content', sequence: 1, delta: 'Hello', role: 'assistant' };
  yield { type: 'done', sequence: 2, finishReason: 'stop', message: { role: 'assistant', content: 'Hello' } };
}

// ============================================================================
// MiddlewareStack.use Tests
// ============================================================================

describe('MiddlewareStack.use', () => {
  it('should add middleware to the stack', () => {
    const stack = new MiddlewareStack();
    const mw = vi.fn();

    stack.use(mw);

    expect(stack.getMiddleware()).toHaveLength(1);
    expect(stack.getMiddleware()).toContain(mw);
  });

  it('should add multiple middleware in order', () => {
    const stack = new MiddlewareStack();
    const mw1 = vi.fn();
    const mw2 = vi.fn();
    const mw3 = vi.fn();

    stack.use(mw1);
    stack.use(mw2);
    stack.use(mw3);

    const middleware = stack.getMiddleware();
    expect(middleware).toHaveLength(3);
    expect(middleware[0]).toBe(mw1);
    expect(middleware[1]).toBe(mw2);
    expect(middleware[2]).toBe(mw3);
  });

  it('should throw when stack is locked', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    expect(() => stack.use(vi.fn())).toThrow(MiddlewareError);
  });
});

// ============================================================================
// MiddlewareStack.remove Tests
// ============================================================================

describe('MiddlewareStack.remove', () => {
  it('should remove middleware from the stack', () => {
    const stack = new MiddlewareStack();
    const mw1 = vi.fn();
    const mw2 = vi.fn();

    stack.use(mw1);
    stack.use(mw2);
    const removed = stack.remove(mw1);

    expect(removed).toBe(true);
    expect(stack.getMiddleware()).toHaveLength(1);
    expect(stack.getMiddleware()).toContain(mw2);
    expect(stack.getMiddleware()).not.toContain(mw1);
  });

  it('should return false when middleware not found', () => {
    const stack = new MiddlewareStack();
    const mw1 = vi.fn();
    const mw2 = vi.fn();

    stack.use(mw1);
    const removed = stack.remove(mw2);

    expect(removed).toBe(false);
    expect(stack.getMiddleware()).toHaveLength(1);
  });

  it('should throw when stack is locked', () => {
    const stack = new MiddlewareStack();
    const mw = vi.fn();
    stack.use(mw);
    stack.lock();

    expect(() => stack.remove(mw)).toThrow(MiddlewareError);
  });
});

// ============================================================================
// MiddlewareStack.useStreaming Tests
// ============================================================================

describe('MiddlewareStack.useStreaming', () => {
  it('should add streaming middleware to the stack', () => {
    const stack = new MiddlewareStack();
    const mw: StreamingMiddleware = vi.fn();

    stack.useStreaming(mw);

    expect(stack.getStreamingMiddleware()).toHaveLength(1);
    expect(stack.getStreamingMiddleware()).toContain(mw);
  });

  it('should throw when stack is locked', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    expect(() => stack.useStreaming(vi.fn())).toThrow(MiddlewareError);
  });
});

// ============================================================================
// MiddlewareStack.lock and isLocked Tests
// ============================================================================

describe('MiddlewareStack.lock', () => {
  it('should lock the stack', () => {
    const stack = new MiddlewareStack();

    expect(stack.isLocked()).toBe(false);
    stack.lock();
    expect(stack.isLocked()).toBe(true);
  });

  it('should prevent use() after locking', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    expect(() => stack.use(vi.fn())).toThrow();
  });

  it('should prevent useStreaming() after locking', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    expect(() => stack.useStreaming(vi.fn())).toThrow();
  });

  it('should prevent clear() after locking', () => {
    const stack = new MiddlewareStack();
    stack.lock();

    expect(() => stack.clear()).toThrow();
  });
});

// ============================================================================
// MiddlewareStack.clear Tests
// ============================================================================

describe('MiddlewareStack.clear', () => {
  it('should clear all middleware', () => {
    const stack = new MiddlewareStack();
    stack.use(vi.fn());
    stack.use(vi.fn());
    stack.useStreaming(vi.fn());

    stack.clear();

    expect(stack.getMiddleware()).toHaveLength(0);
    expect(stack.getStreamingMiddleware()).toHaveLength(0);
  });

  it('should throw when stack is locked', () => {
    const stack = new MiddlewareStack();
    stack.use(vi.fn());
    stack.lock();

    expect(() => stack.clear()).toThrow(MiddlewareError);
  });
});

// ============================================================================
// MiddlewareStack.execute Tests
// ============================================================================

describe('MiddlewareStack.execute', () => {
  it('should execute final handler when no middleware', async () => {
    const stack = new MiddlewareStack();
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());
    const context = createMiddlewareContext(createTestRequest(), {});

    const result = await stack.execute(context, finalHandler);

    expect(finalHandler).toHaveBeenCalledTimes(1);
    expect(result.message.content).toBe('Hi!');
  });

  it('should execute middleware in order (onion pattern)', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    stack.use(createTestMiddleware('mw1', log));
    stack.use(createTestMiddleware('mw2', log));
    stack.use(createTestMiddleware('mw3', log));

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn(async () => {
      log.push('handler');
      return createTestResponse();
    });

    await stack.execute(context, finalHandler);

    expect(log).toEqual([
      'mw1-before',
      'mw2-before',
      'mw3-before',
      'handler',
      'mw3-after',
      'mw2-after',
      'mw1-after',
    ]);
  });

  it('should pass context to middleware', async () => {
    const stack = new MiddlewareStack();
    const receivedContexts: MiddlewareContext[] = [];

    const middleware: Middleware = async (ctx, next) => {
      receivedContexts.push(ctx);
      return next();
    };

    stack.use(middleware);

    const request = createTestRequest();
    const context = createMiddlewareContext(request, { key: 'value' });
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    await stack.execute(context, finalHandler);

    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0].request).toBe(request);
    expect(receivedContexts[0].config).toEqual({ key: 'value' });
  });

  it('should allow middleware to modify context state', async () => {
    const stack = new MiddlewareStack();

    stack.use(createModifyingMiddleware('mw1', (ctx) => {
      ctx.state.step1 = true;
    }));
    stack.use(createModifyingMiddleware('mw2', (ctx) => {
      ctx.state.step2 = ctx.state.step1 === true;
    }));

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    await stack.execute(context, finalHandler);

    expect(context.state.step1).toBe(true);
    expect(context.state.step2).toBe(true);
  });

  it('should lock stack on first execution', async () => {
    const stack = new MiddlewareStack();
    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    expect(stack.isLocked()).toBe(false);
    await stack.execute(context, finalHandler);
    expect(stack.isLocked()).toBe(true);
  });

  it('should wrap non-MiddlewareError in MiddlewareError', async () => {
    const stack = new MiddlewareStack();

    const failingMiddleware: Middleware = async () => {
      throw new Error('Regular error');
    };

    stack.use(failingMiddleware);

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    await expect(stack.execute(context, finalHandler)).rejects.toThrow(MiddlewareError);
  });

  it('should re-throw MiddlewareError as-is', async () => {
    const stack = new MiddlewareStack();
    const originalError = new MiddlewareError({ message: 'Original error' });

    const failingMiddleware: Middleware = async () => {
      throw originalError;
    };

    stack.use(failingMiddleware);

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    await expect(stack.execute(context, finalHandler)).rejects.toBe(originalError);
  });

  it('should allow middleware to modify response', async () => {
    const stack = new MiddlewareStack();

    const modifyingMiddleware: Middleware = async (context, next) => {
      const response = await next();
      return {
        ...response,
        message: { ...response.message, content: 'Modified!' },
      };
    };

    stack.use(modifyingMiddleware);

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    const result = await stack.execute(context, finalHandler);

    expect(result.message.content).toBe('Modified!');
  });

  it('should allow middleware to short-circuit', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    const shortCircuit: Middleware = async (context, next) => {
      log.push('short-circuit');
      return createTestResponse(); // Don't call next()
    };

    stack.use(shortCircuit);
    stack.use(createTestMiddleware('never-called', log));

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    await stack.execute(context, finalHandler);

    expect(log).toEqual(['short-circuit']);
    expect(finalHandler).not.toHaveBeenCalled();
  });
});

// ============================================================================
// MiddlewareStack.executeStream Tests
// ============================================================================

describe('MiddlewareStack.executeStream', () => {
  it('should execute final handler when no streaming middleware', async () => {
    const stack = new MiddlewareStack();
    const finalHandler = vi.fn().mockResolvedValue(createTestStream());
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    const stream = await stack.executeStream(context, finalHandler);

    expect(finalHandler).toHaveBeenCalledTimes(1);

    // Consume stream
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(3);
  });

  it('should lock stack on first execution', async () => {
    const stack = new MiddlewareStack();
    const finalHandler = vi.fn().mockResolvedValue(createTestStream());
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    expect(stack.isLocked()).toBe(false);
    await stack.executeStream(context, finalHandler);
    expect(stack.isLocked()).toBe(true);
  });

  it('should execute streaming middleware in order', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    const streamMw1: StreamingMiddleware = async (ctx, next) => {
      log.push('stream-mw1-before');
      const stream = await next();
      log.push('stream-mw1-after');
      return stream;
    };

    const streamMw2: StreamingMiddleware = async (ctx, next) => {
      log.push('stream-mw2-before');
      const stream = await next();
      log.push('stream-mw2-after');
      return stream;
    };

    stack.useStreaming(streamMw1);
    stack.useStreaming(streamMw2);

    const finalHandler = vi.fn(async () => {
      log.push('handler');
      return createTestStream();
    });
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    await stack.executeStream(context, finalHandler);

    expect(log).toEqual([
      'stream-mw1-before',
      'stream-mw2-before',
      'handler',
      'stream-mw2-after',
      'stream-mw1-after',
    ]);
  });

  it('should wrap errors in MiddlewareError', async () => {
    const stack = new MiddlewareStack();

    const failingMw: StreamingMiddleware = async () => {
      throw new Error('Stream error');
    };

    stack.useStreaming(failingMw);

    const context = createStreamingMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestStream());

    await expect(stack.executeStream(context, finalHandler)).rejects.toThrow(MiddlewareError);
  });
});

// ============================================================================
// createMiddlewareContext Tests
// ============================================================================

describe('createMiddlewareContext', () => {
  it('should create context with request', () => {
    const request = createTestRequest();
    const context = createMiddlewareContext(request, {});

    expect(context.request).toBe(request);
  });

  it('should create context with config', () => {
    const config = { debug: true, timeout: 5000 };
    const context = createMiddlewareContext(createTestRequest(), config);

    expect(context.config).toBe(config);
  });

  it('should set isStreaming based on request.stream', () => {
    const streamingRequest = { ...createTestRequest(), stream: true };
    const nonStreamingRequest = { ...createTestRequest(), stream: false };

    const streamingContext = createMiddlewareContext(streamingRequest, {});
    const nonStreamingContext = createMiddlewareContext(nonStreamingRequest, {});

    expect(streamingContext.isStreaming).toBe(true);
    expect(nonStreamingContext.isStreaming).toBe(false);
  });

  it('should default isStreaming to false', () => {
    const context = createMiddlewareContext(createTestRequest(), {});

    expect(context.isStreaming).toBe(false);
  });

  it('should initialize empty state', () => {
    const context = createMiddlewareContext(createTestRequest(), {});

    expect(context.state).toEqual({});
  });

  it('should pass abort signal', () => {
    const controller = new AbortController();
    const context = createMiddlewareContext(createTestRequest(), {}, controller.signal);

    expect(context.signal).toBe(controller.signal);
  });

  it('should leave signal undefined when not provided', () => {
    const context = createMiddlewareContext(createTestRequest(), {});

    expect(context.signal).toBeUndefined();
  });
});

// ============================================================================
// createStreamingMiddlewareContext Tests
// ============================================================================

describe('createStreamingMiddlewareContext', () => {
  it('should create streaming context with request', () => {
    const request = createTestRequest();
    const context = createStreamingMiddlewareContext(request, {});

    expect(context.request).toBe(request);
  });

  it('should always set isStreaming to true', () => {
    const nonStreamingRequest = { ...createTestRequest(), stream: false };
    const context = createStreamingMiddlewareContext(nonStreamingRequest, {});

    expect(context.isStreaming).toBe(true);
  });

  it('should initialize chunksProcessed to 0', () => {
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    expect(context.chunksProcessed).toBe(0);
  });

  it('should initialize streamComplete to false', () => {
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    expect(context.streamComplete).toBe(false);
  });

  it('should pass config and signal', () => {
    const config = { key: 'value' };
    const controller = new AbortController();
    const context = createStreamingMiddlewareContext(createTestRequest(), config, controller.signal);

    expect(context.config).toBe(config);
    expect(context.signal).toBe(controller.signal);
  });
});
