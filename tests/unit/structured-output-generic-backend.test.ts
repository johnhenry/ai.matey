/**
 * Regression tests: generateObject/streamObject must work with any
 * frontend/backend combination, not just Anthropic.
 *
 * Previously `createGenerateObject`/`createStreamObject`
 * (packages/ai.matey.utils/src/structured-output.ts) called `bridge.chat()`/
 * `bridge.chatStream()` with an Anthropic-native wire request
 * (`tool_choice: { type: 'tool', name }`) and parsed an Anthropic-native
 * response shape (`response.content.filter(c => c.type === 'tool_use')`,
 * `response.stop_reason`). Since `bridge.chat()` sends the request through
 * whatever frontend adapter is actually attached to the Bridge, a
 * non-Anthropic frontend (e.g. OpenAI, whose native tool_choice shape is
 * `{ type: 'function', function: { name } }` and whose response has no
 * top-level `.content` array) would either mis-map the forced tool choice
 * or fail to find any tool call at all, throwing `'No tool call in
 * response'` on every call.
 *
 * The fix routes generateObject/streamObject through `Bridge.executeIR()`/
 * `executeIRStream()` (IR in, IR out -- no frontend-specific translation),
 * using the universal `toolChoice: { name }` / `ToolUseContent` IR shapes
 * that every backend adapter already normalizes to and from its own native
 * format. This test attaches a real `OpenAIFrontendAdapter` (deliberately
 * *not* Anthropic) to prove generateObject/streamObject no longer assume
 * Anthropic's wire format.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { createGenerateObject, createStreamObject } from '@johnhenry/aimatey-utils';
import type {
  BackendAdapter,
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
} from '@johnhenry/aimatey-types';

const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

/**
 * A minimal IR-level mock backend that answers any forced tool call by
 * echoing back a fixed payload as a `ToolUseContent` block -- standing in
 * for "some backend produced a tool call", regardless of which frontend
 * (OpenAI, Anthropic, etc) is attached to the Bridge.
 */
function createMockToolCallingBackend(payload: Record<string, unknown>): BackendAdapter {
  return {
    metadata: {
      name: 'mock-backend',
      version: '1.0.0',
      provider: 'mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: true,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    },
    fromIR: (request: IRChatRequest) => request,
    toIR: (response: IRChatResponse) => response,
    async execute(request: IRChatRequest): Promise<IRChatResponse> {
      const forcedName =
        typeof request.toolChoice === 'object' ? request.toolChoice.name : 'extract_data';

      return {
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call_1', name: forcedName, input: payload }],
        },
        finishReason: 'tool_calls',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        metadata: {
          requestId: request.metadata.requestId,
          timestamp: Date.now(),
          provenance: { backend: 'mock-backend' },
        },
      };
    },
    async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk, void, undefined> {
      const forcedName =
        typeof request.toolChoice === 'object' ? request.toolChoice.name : 'extract_data';
      const raw = JSON.stringify(payload);

      yield { type: 'start', sequence: 0 } as IRStreamChunk;
      // Split the raw JSON into a couple of delta fragments, like a real
      // streaming backend would.
      const mid = Math.floor(raw.length / 2);
      yield {
        type: 'tool_use',
        sequence: 1,
        id: 'call_1',
        name: forcedName,
        inputDelta: raw.slice(0, mid),
        index: 0,
      } as IRStreamChunk;
      yield {
        type: 'tool_use',
        sequence: 2,
        id: 'call_1',
        name: forcedName,
        inputDelta: raw.slice(mid),
        index: 0,
      } as IRStreamChunk;
      yield {
        type: 'done',
        sequence: 3,
        finishReason: 'tool_calls',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call_1', name: forcedName, input: payload }],
        },
      } as IRStreamChunk;
    },
  } as unknown as BackendAdapter;
}

describe('generateObject with a non-Anthropic (OpenAI) bridge', () => {
  it('does not throw "No tool call in response" and returns the validated object', async () => {
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      createMockToolCallingBackend({ name: 'Alice', age: 30 })
    );

    const generateObject = createGenerateObject(bridge as any);

    const result = await generateObject({
      schema: UserSchema,
      prompt: 'Generate a user profile for Alice, age 30',
    });

    expect(result.object).toEqual({ name: 'Alice', age: 30 });
    expect(result.finishReason).toBe('tool_calls');
    expect(result.usage?.totalTokens).toBe(15);
  });

  it('also works via bridge.generateObject() directly', async () => {
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      createMockToolCallingBackend({ name: 'Bob', age: 42 })
    );

    const result = await bridge.generateObject({
      schema: UserSchema,
      prompt: 'Generate a user profile for Bob, age 42',
    });

    expect(result.object).toEqual({ name: 'Bob', age: 42 });
  });
});

describe('streamObject with a non-Anthropic (OpenAI) bridge', () => {
  it('yields partial objects and resolves the final validated object', async () => {
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      createMockToolCallingBackend({ name: 'Carol', age: 25 })
    );

    const streamObject = createStreamObject(bridge as any);

    const partials: Array<Partial<z.infer<typeof UserSchema>>> = [];
    const stream = streamObject({
      schema: UserSchema,
      prompt: 'Generate a user profile for Carol, age 25',
      onPartial: (partial) => partials.push(partial),
    });

    let result: IteratorResult<Partial<z.infer<typeof UserSchema>>, z.infer<typeof UserSchema>>;
    let final: z.infer<typeof UserSchema> | undefined;
    do {
      result = await stream.next();
      if (result.done) {
        final = result.value;
      }
    } while (!result.done);

    expect(partials.length).toBeGreaterThan(0);
    expect(final).toEqual({ name: 'Carol', age: 25 });
  });
});
