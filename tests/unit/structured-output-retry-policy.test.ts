/**
 * generateObject retry policy (#69)
 *
 * `createGenerateObject` used to treat *every* failure as retryable and
 * re-send a byte-identical request, so a request that could not be satisfied
 * burned the whole budget to learn nothing. These tests pin down the three
 * mechanisms that replaced that, and -- just as importantly -- the case that
 * must keep working:
 *
 * - **Gate A** stops when the value the provider returned *conforms to the
 *   JSON Schema it was actually sent* and a lossy conversion explains the
 *   Zod failure. Nothing the model can put in that slot will validate.
 * - **Gate B** stops when an informed retry reproduces the identical error
 *   set.
 * - **The repair prompt** feeds the validation errors back, so a retry is a
 *   better-informed request instead of the same one.
 *
 * The load-bearing constraint (from the correction comment on #69) is that
 * `temperature` defaults to `0.7`, so resampling is a genuine second chance:
 * a model that fails once and succeeds later must still succeed. The
 * distinguishing signal is *repetition*, not the first failure.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { IRChatRequest, IRChatResponse } from '@johnhenry/aimatey-types';
import { createGenerateObject } from '@johnhenry/aimatey-utils';

// ============================================================================
// Harness
// ============================================================================

/**
 * A bridge that serves `payloads[i]` for attempt `i`, holding the last entry
 * once the list runs out (so "the model always answers the same way" is just
 * a one-element list). Records every request for call-count and wire
 * assertions.
 */
function stubBridge(payloads: Array<Record<string, unknown>>) {
  const requests: IRChatRequest[] = [];
  return {
    requests,
    bridge: {
      executeIR: async (request: IRChatRequest): Promise<IRChatResponse> => {
        const input = payloads[Math.min(requests.length, payloads.length - 1)];
        requests.push(request);
        return {
          message: {
            role: 'assistant' as const,
            content: [{ type: 'tool_use' as const, id: 'call_1', name: 'extract_data', input }],
          },
          finishReason: 'tool_calls',
          metadata: {
            requestId: request.metadata.requestId,
            timestamp: Date.now(),
            provenance: { backend: 'stub' },
          },
        };
      },
      frontend: { metadata: { name: 'openai' } },
      config: { defaultModel: 'gpt-4o' },
    },
  };
}

/** A bridge whose transport always throws the supplied error. */
function throwingBridge(error: unknown) {
  const requests: IRChatRequest[] = [];
  return {
    requests,
    bridge: {
      executeIR: async (request: IRChatRequest): Promise<IRChatResponse> => {
        requests.push(request);
        throw error;
      },
      frontend: { metadata: { name: 'openai' } },
      config: { defaultModel: 'gpt-4o' },
    },
  };
}

/** A bridge that returns a response with no tool call at all. */
function toolLessBridge(succeedOnAttempt: number, input: Record<string, unknown>) {
  const requests: IRChatRequest[] = [];
  return {
    requests,
    bridge: {
      executeIR: async (request: IRChatRequest): Promise<IRChatResponse> => {
        const attempt = requests.length + 1;
        requests.push(request);
        return {
          message: {
            role: 'assistant' as const,
            content:
              attempt >= succeedOnAttempt
                ? [{ type: 'tool_use' as const, id: 'call_1', name: 'extract_data', input }]
                : [{ type: 'text' as const, text: 'I am thinking about it.' }],
          },
          finishReason: 'stop',
          metadata: {
            requestId: request.metadata.requestId,
            timestamp: Date.now(),
            provenance: { backend: 'stub' },
          },
        };
      },
      frontend: { metadata: { name: 'openai' } },
      config: { defaultModel: 'gpt-4o' },
    },
  };
}

const promptOf = (request: IRChatRequest): string => {
  const content = request.messages[0]?.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
};

describe('generateObject retry policy (#69)', () => {
  // ==========================================================================
  // The case that must not break
  // ==========================================================================

  describe('legitimate retries still work', () => {
    /**
     * The one outcome the correction comment on #69 explicitly rules out.
     * `temperature` defaults to 0.7, so the model that returns 'x' then 'y'
     * then 30 against z.number() is not being deterministic -- it is
     * sampling, and the third sample is right. Bailing on the first (or the
     * second) validation failure here would be a regression, not a fix.
     */
    it('lets a model that fails twice and then succeeds still succeed', async () => {
      const { bridge, requests } = stubBridge([{ age: 'x' }, { age: 'y' }, { age: 30 }]);

      const result = await createGenerateObject(bridge)({
        schema: z.object({ age: z.number() }),
        prompt: 'How old is Alice?',
        maxRetries: 3,
      });

      expect(result.object).toEqual({ age: 30 });
      expect(requests).toHaveLength(3);
    });

    /**
     * A constraint JSON Schema cannot express (`.refine`) is *not* a contract
     * mismatch: the model can satisfy it by sampling again. Gate A must stay
     * quiet, because `3` conforming to `{type:'number'}` is not evidence that
     * an even number is unreachable.
     */
    it('does not bail on a refinement the model can satisfy on a later sample', async () => {
      const { bridge, requests } = stubBridge([{ n: 3 }, { n: 5 }, { n: 4 }]);

      const result = await createGenerateObject(bridge)({
        schema: z.object({ n: z.number().refine((v: number) => v % 2 === 0, 'must be even') }),
        prompt: 'an even number',
        maxRetries: 3,
      });

      expect(result.object).toEqual({ n: 4 });
      expect(requests).toHaveLength(3);
    });

    /**
     * Gate B keys on the error *set*, not on the attempt number, so a failure
     * that keeps moving keeps its full budget.
     */
    it('runs the whole budget when the error set moves between attempts', async () => {
      const { bridge, requests } = stubBridge([
        { a: 'x', b: 2 },
        { a: 1, b: 'y' },
        { a: 1, b: 2 },
      ]);

      const result = await createGenerateObject(bridge)({
        schema: z.object({ a: z.number(), b: z.number() }),
        prompt: 'two numbers',
        maxRetries: 3,
      });

      expect(result.object).toEqual({ a: 1, b: 2 });
      expect(requests).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Loop hygiene: the adjacent defects in the same twenty lines
  // ==========================================================================

  describe('attempt budget validation', () => {
    it.each([
      ['zero', 0],
      ['negative', -1],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['fractional', 2.5],
    ])('rejects a %s maxRetries without calling the provider', async (_label, maxRetries) => {
      const { bridge, requests } = stubBridge([{ age: 30 }]);

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          maxRetries: maxRetries as number,
        })
      ).rejects.toThrow(/maxRetries must be an integer >= 1/);

      // The point of the check: these used to make *zero* provider calls and
      // then throw the generic "Failed to generate object" (or, for
      // Infinity, loop without bound).
      expect(requests).toHaveLength(0);
    });

    it('accepts maxRetries: 1 as "call once, do not retry"', async () => {
      const { bridge, requests } = stubBridge([{ age: 30 }]);

      await createGenerateObject(bridge)({
        schema: z.object({ age: z.number() }),
        prompt: 'How old is Alice?',
        maxRetries: 1,
      });

      expect(requests).toHaveLength(1);
    });
  });

  describe('transport error classification', () => {
    it('does not retry an error that declares itself non-retryable', async () => {
      const authFailure = Object.assign(new Error('401 Unauthorized'), { isRetryable: false });
      const { bridge, requests } = throwingBridge(authFailure);

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          maxRetries: 3,
        })
      ).rejects.toThrow(/401 Unauthorized/);

      // Previously this burned all three attempts re-presenting the same
      // expired credential.
      expect(requests).toHaveLength(1);
    });

    it('still retries a transport error that may be transient', async () => {
      const blip = Object.assign(new Error('socket hang up'), { isRetryable: true });
      const { bridge, requests } = throwingBridge(blip);

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          maxRetries: 3,
        })
      ).rejects.toThrow(/socket hang up/);

      expect(requests).toHaveLength(3);
    });

    it('gives a bare Error the benefit of the doubt, as before', async () => {
      const { bridge, requests } = throwingBridge(new Error('network glitch'));

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          maxRetries: 3,
        })
      ).rejects.toThrow(/network glitch/);

      expect(requests).toHaveLength(3);
    });

    it('throws the transport error itself, not a ValidationError', async () => {
      const { bridge } = throwingBridge(new Error('network glitch'));

      const error = await createGenerateObject(bridge)({
        schema: z.object({ when: z.date() }),
        prompt: 'when?',
        maxRetries: 2,
      }).catch((e: unknown) => e);

      expect((error as Error).message).toBe('network glitch');
      expect((error as { validationDetails?: unknown }).validationDetails).toBeUndefined();
    });
  });

  describe('abort', () => {
    it('does not call the provider when the signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const { bridge, requests } = stubBridge([{ age: 30 }]);

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          maxRetries: 3,
          signal: controller.signal,
        })
      ).rejects.toThrow();

      expect(requests).toHaveLength(0);
    });

    it('stops retrying once the signal aborts mid-loop', async () => {
      const controller = new AbortController();
      const requests: IRChatRequest[] = [];
      const bridge = {
        executeIR: async (request: IRChatRequest): Promise<IRChatResponse> => {
          requests.push(request);
          // Abort after the first attempt: the loop must notice at its own
          // boundary rather than starting attempt 2.
          controller.abort();
          return {
            message: {
              role: 'assistant' as const,
              content: [
                {
                  type: 'tool_use' as const,
                  id: 'call_1',
                  name: 'extract_data',
                  input: { age: 'nope' },
                },
              ],
            },
            finishReason: 'tool_calls',
            metadata: {
              requestId: request.metadata.requestId,
              timestamp: Date.now(),
              provenance: { backend: 'stub' },
            },
          };
        },
        frontend: { metadata: { name: 'openai' } },
        config: { defaultModel: 'gpt-4o' },
      };

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          maxRetries: 3,
          signal: controller.signal,
        })
      ).rejects.toThrow();

      expect(requests).toHaveLength(1);
    });

    it('propagates the abort reason when one was given', async () => {
      const controller = new AbortController();
      controller.abort(new Error('caller went away'));
      const { bridge } = stubBridge([{ age: 30 }]);

      await expect(
        createGenerateObject(bridge)({
          schema: z.object({ age: z.number() }),
          prompt: 'How old is Alice?',
          signal: controller.signal,
        })
      ).rejects.toThrow(/caller went away/);
    });
  });

  describe('responses with no tool call', () => {
    it('keeps retrying, since another sample may call the tool', async () => {
      const { bridge, requests } = toolLessBridge(3, { age: 30 });

      const result = await createGenerateObject(bridge)({
        schema: z.object({ age: z.number() }),
        prompt: 'How old is Alice?',
        maxRetries: 3,
      });

      expect(result.object).toEqual({ age: 30 });
      expect(requests).toHaveLength(3);
      // No validation errors exist to feed back, so the prompt is untouched.
      expect(promptOf(requests[1]!)).toBe('How old is Alice?');
    });
  });
});
