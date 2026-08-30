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
} from '@johnhenry/aimatey-core';
import type {
  Middleware,
  StreamingMiddleware,
  MiddlewareContext,
  StreamingMiddlewareContext,
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
} from '@johnhenry/aimatey-types';
import { MiddlewareError } from '@johnhenry/aimatey-errors';

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

  // Regression: #46 - use() middleware was skipped on the streaming path.
  it('should run use() middleware on the streaming path', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    stack.use(createTestMiddleware('mw1', log));

    const finalHandler = vi.fn(async () => {
      log.push('handler');
      return createTestStream();
    });
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    const stream = await stack.executeStream(context, finalHandler);
    for await (const _chunk of stream) {
      // drain
    }

    expect(finalHandler).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['mw1-before', 'handler', 'mw1-after']);
  });

  it('should interleave use() and useStreaming() in registration order', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    const streamingMw = (name: string): StreamingMiddleware => async (_ctx, next) => {
      log.push(name);
      return next();
    };
    const standardMw = (name: string): Middleware => async (_ctx, next) => {
      log.push(name);
      return next();
    };

    stack.use(standardMw('standard-1'));
    stack.useStreaming(streamingMw('streaming-1'));
    stack.use(standardMw('standard-2'));

    const context = createStreamingMiddlewareContext(createTestRequest(), {});
    const stream = await stack.executeStream(context, async () => createTestStream());
    for await (const _chunk of stream) {
      // drain
    }

    expect(log).toEqual(['standard-1', 'streaming-1', 'standard-2']);
  });

  it('should see request rewrites made by use() middleware in the final handler', async () => {
    const stack = new MiddlewareStack();

    stack.use(async (ctx, next) => {
      ctx.request = { ...ctx.request, messages: [{ role: 'user', content: 'rewritten' }] };
      return next();
    });

    const context = createStreamingMiddlewareContext(createTestRequest(), {});
    const seen: string[] = [];
    const stream = await stack.executeStream(context, async () => {
      seen.push(context.request.messages[0].content as string);
      return createTestStream();
    });
    for await (const _chunk of stream) {
      // drain
    }

    expect(seen).toEqual(['rewritten']);
  });
});

// ============================================================================
// Repeated next() Tests (#56)
// ============================================================================

describe('MiddlewareStack repeated next()', () => {
  // Regression: #56 - a shared mutable index meant a second next() advanced
  // *past* the next middleware instead of re-running the rest of the chain.
  it('should re-run the rest of the chain when a middleware calls next() twice', async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    stack.use(async (_ctx, next) => {
      order.push('retry:first');
      await next();
      order.push('retry:second');
      return next();
    });
    stack.use(async (_ctx, next) => {
      order.push('inner');
      return next();
    });

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn(async () => {
      order.push('handler');
      return createTestResponse();
    });

    await stack.execute(context, finalHandler);

    expect(order).toEqual([
      'retry:first',
      'inner',
      'handler',
      'retry:second',
      'inner',
      'handler',
    ]);
    expect(finalHandler).toHaveBeenCalledTimes(2);
  });

  it('should preserve onion ordering on the second pass', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    stack.use(async (_ctx, next) => {
      log.push('outer-before');
      await next();
      log.push('outer-retry');
      const result = await next();
      log.push('outer-after');
      return result;
    });
    stack.use(createTestMiddleware('mw2', log));
    stack.use(createTestMiddleware('mw3', log));

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn(async () => {
      log.push('handler');
      return createTestResponse();
    });

    await stack.execute(context, finalHandler);

    expect(log).toEqual([
      'outer-before',
      'mw2-before',
      'mw3-before',
      'handler',
      'mw3-after',
      'mw2-after',
      'outer-retry',
      'mw2-before',
      'mw3-before',
      'handler',
      'mw3-after',
      'mw2-after',
      'outer-after',
    ]);
  });

  it('should re-run a downstream transform on every retry attempt', async () => {
    const stack = new MiddlewareStack();

    // Retry-shaped middleware: one retry of the rest of the chain on failure.
    stack.use(async (_ctx, next) => {
      try {
        return await next();
      } catch {
        return next();
      }
    });

    // Downstream transform: stamps a fresh per-attempt request id.
    let stamped = 0;
    stack.use(async (ctx, next) => {
      stamped++;
      ctx.request = {
        ...ctx.request,
        metadata: { ...ctx.request.metadata, requestId: `req-${stamped}` },
      };
      return next();
    });

    const context = createMiddlewareContext(createTestRequest(), {});
    const seen: string[] = [];
    let attempt = 0;
    const finalHandler = vi.fn(async () => {
      seen.push(context.request.metadata.requestId);
      attempt++;
      if (attempt === 1) {
        throw new Error('transient failure');
      }
      return createTestResponse();
    });

    await stack.execute(context, finalHandler);

    // Without the fix the retry skips the transform: stamped === 1 and the
    // backend is re-called with the first attempt's request id.
    expect(stamped).toBe(2);
    expect(seen).toEqual(['req-1', 'req-2']);
  });

  it('should return the response produced by the pass the middleware returns', async () => {
    const stack = new MiddlewareStack();

    stack.use(async (_ctx, next) => {
      await next();
      return next();
    });

    // Downstream response transform: must run on the second pass too.
    stack.use(async (_ctx, next) => {
      const response = await next();
      return {
        ...response,
        message: { ...response.message, content: `${response.message.content as string}+tagged` },
      };
    });

    const context = createMiddlewareContext(createTestRequest(), {});
    let call = 0;
    const finalHandler = vi.fn(async () => {
      call++;
      return {
        ...createTestResponse(),
        message: { role: 'assistant' as const, content: `#${call}` },
      };
    });

    const result = await stack.execute(context, finalHandler);

    expect(result.message.content).toBe('#2+tagged');
  });

  it('should wrap an error thrown on a re-run pass exactly once', async () => {
    const stack = new MiddlewareStack();

    stack.use(async (_ctx, next) => {
      await next();
      return next();
    });

    let call = 0;
    const downstreamError = new Error('second pass failed');
    stack.use(async (_ctx, next) => {
      call++;
      if (call === 2) {
        throw downstreamError;
      }
      return next();
    });

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    const error = await stack.execute(context, finalHandler).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MiddlewareError);
    expect((error as MiddlewareError).cause).toBe(downstreamError);
  });

  it('should re-throw a MiddlewareError from a re-run pass as-is', async () => {
    const stack = new MiddlewareStack();
    const originalError = new MiddlewareError({ message: 'Original error' });

    stack.use(async (_ctx, next) => {
      await next();
      return next();
    });

    let call = 0;
    stack.use(async (_ctx, next) => {
      call++;
      if (call === 2) {
        throw originalError;
      }
      return next();
    });

    const context = createMiddlewareContext(createTestRequest(), {});
    const finalHandler = vi.fn().mockResolvedValue(createTestResponse());

    await expect(stack.execute(context, finalHandler)).rejects.toBe(originalError);
  });
});

describe('MiddlewareStack.executeStream repeated next()', () => {
  it('should re-run the rest of the chain when a streaming middleware calls next() twice', async () => {
    const stack = new MiddlewareStack();
    const log: string[] = [];

    stack.useStreaming(async (_ctx, next) => {
      log.push('outer:first');
      await next();
      log.push('outer:second');
      return next();
    });
    stack.useStreaming(async (_ctx, next) => {
      log.push('inner');
      return next();
    });

    const finalHandler = vi.fn(async () => {
      log.push('handler');
      return createTestStream();
    });
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    const stream = await stack.executeStream(context, finalHandler);
    for await (const _chunk of stream) {
      // drain
    }

    expect(log).toEqual(['outer:first', 'inner', 'handler', 'outer:second', 'inner', 'handler']);
    expect(finalHandler).toHaveBeenCalledTimes(2);
  });

  it('should re-run the chain when an adapted use() middleware retries a failed next()', async () => {
    const stack = new MiddlewareStack();

    // Retry-shaped standard middleware on the streaming path. The adapter
    // allows this second next() because the first one never produced a stream.
    stack.use(async (_ctx, next) => {
      try {
        return await next();
      } catch {
        return next();
      }
    });

    let downstreamRuns = 0;
    stack.use(async (_ctx, next) => {
      downstreamRuns++;
      return next();
    });

    let attempt = 0;
    const finalHandler = vi.fn(async () => {
      attempt++;
      if (attempt === 1) {
        throw new Error('transient failure');
      }
      return createTestStream();
    });
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    const stream = await stack.executeStream(context, finalHandler);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Without the fix the retry skips the downstream middleware entirely.
    expect(downstreamRuns).toBe(2);
    expect(finalHandler).toHaveBeenCalledTimes(2);
    expect(chunks).toHaveLength(3);
  });

  // #46/#50: the adapter refuses a restart once chunks have been delivered -
  // the one place a second next() is rejected instead of re-running the chain.
  it('should throw when an adapted use() middleware calls next() after the stream was delivered', async () => {
    const stack = new MiddlewareStack();

    stack.use(async (_ctx, next) => {
      await next();
      return next();
    });

    const finalHandler = vi.fn(async () => createTestStream());
    const context = createStreamingMiddlewareContext(createTestRequest(), {});

    const stream = await stack.executeStream(context, finalHandler);

    await expect(
      (async () => {
        for await (const _chunk of stream) {
          // drain
        }
      })()
    ).rejects.toThrow(/next\(\) was called more than once/);

    expect(finalHandler).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// MiddlewareStack.removeStreaming Tests
// ============================================================================

describe('MiddlewareStack.removeStreaming', () => {
  it('should remove streaming middleware from the stack', () => {
    const stack = new MiddlewareStack();
    const mw1: StreamingMiddleware = vi.fn();
    const mw2: StreamingMiddleware = vi.fn();

    stack.useStreaming(mw1);
    stack.useStreaming(mw2);

    expect(stack.removeStreaming(mw1)).toBe(true);
    expect(stack.getStreamingMiddleware()).toEqual([mw2]);
  });

  it('should return false when streaming middleware not found', () => {
    const stack = new MiddlewareStack();

    expect(stack.removeStreaming(vi.fn())).toBe(false);
  });

  it('should throw when stack is locked', () => {
    const stack = new MiddlewareStack();
    const mw: StreamingMiddleware = vi.fn();
    stack.useStreaming(mw);
    stack.lock();

    expect(() => stack.removeStreaming(mw)).toThrow(MiddlewareError);
  });
});

// ============================================================================
// MiddlewareStack registration reporting
// ============================================================================

describe('MiddlewareStack registration reporting', () => {
  it('should report use() middleware only from getMiddleware()', () => {
    const stack = new MiddlewareStack();
    const standard: Middleware = vi.fn();
    const streaming: StreamingMiddleware = vi.fn();

    stack.use(standard);
    stack.useStreaming(streaming);

    expect(stack.getMiddleware()).toEqual([standard]);
    expect(stack.getStreamingMiddleware()).toEqual([streaming]);
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
