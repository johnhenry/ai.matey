/**
 * Tool helpers + runTools agentic loop tests
 *
 * Uses a scripted mock backend that returns tool calls, then a final
 * answer, exercising: single/multi round loops, parallel handlers, handler
 * errors as isError results, argument-validation feedback, unknown tools,
 * and maxIterations exhaustion.
 */

import { describe, it, expect } from 'vitest';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import {
  extractToolCalls,
  hasToolCalls,
  createToolResultMessage,
  validateToolArgs,
} from 'ai.matey.utils';
import type {
  BackendAdapter,
  AdapterMetadata,
  IRChatRequest,
  IRChatResponse,
  IRTool,
} from 'ai.matey.types';

// ============================================================================
// Scripted backend
// ============================================================================

function scriptedBackend(script: Array<Partial<IRChatResponse>>): BackendAdapter & {
  requests: IRChatRequest[];
} {
  let call = 0;
  const requests: IRChatRequest[] = [];

  const metadata: AdapterMetadata = {
    name: 'scripted',
    version: '1.0.0',
    provider: 'Mock',
    capabilities: {
      streaming: false,
      multiModal: false,
      tools: true,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };

  return {
    metadata,
    requests,
    fromIR: (request) => request,
    toIR: () => {
      throw new Error('unused');
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock interface
    execute: async (request: IRChatRequest): Promise<IRChatResponse> => {
      requests.push(request);
      const scripted = script[Math.min(call, script.length - 1)];
      call++;
      return {
        message: { role: 'assistant', content: 'done' },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        metadata: request.metadata,
        ...scripted,
      } as IRChatResponse;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock generator interface
    executeStream: async function* () {
      throw new Error('unused');
    },
  };
}

const toolCallResponse = (
  calls: Array<{ id: string; name: string; input: Record<string, unknown> }>
): Partial<IRChatResponse> => ({
  message: {
    role: 'assistant',
    content: calls.map((call) => ({ type: 'tool_use' as const, ...call })),
  },
  finishReason: 'tool_calls',
});

const WEATHER_PARAMS: IRTool['parameters'] = {
  type: 'object',
  properties: { city: { type: 'string' } },
  required: ['city'],
};

function makeBridge(backend: BackendAdapter): Bridge {
  return new Bridge(new OpenAIFrontendAdapter(), backend);
}

// ============================================================================
// Helper tests
// ============================================================================

describe('tool helpers', () => {
  it('extracts tool calls and detects them', () => {
    const response: IRChatResponse = {
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'checking' },
          { type: 'tool_use', id: 't1', name: 'get_weather', input: { city: 'SF' } },
        ],
      },
      finishReason: 'tool_calls',
      metadata: { requestId: 'x', timestamp: 0, provenance: {} },
    };

    expect(hasToolCalls(response)).toBe(true);
    expect(extractToolCalls(response)).toEqual([
      { type: 'tool_use', id: 't1', name: 'get_weather', input: { city: 'SF' } },
    ]);
  });

  it('builds tool result messages with stringified payloads', () => {
    const message = createToolResultMessage([
      { toolCallId: 't1', result: { temp: 65 } },
      { toolCallId: 't2', result: 'plain', isError: true },
    ]);

    expect(message.role).toBe('tool');
    expect(message.content).toEqual([
      { type: 'tool_result', toolUseId: 't1', content: '{"temp":65}', isError: undefined },
      { type: 'tool_result', toolUseId: 't2', content: 'plain', isError: true },
    ]);
  });

  it('validates arguments against the schema subset', () => {
    const tool: IRTool = { name: 'w', description: '', parameters: WEATHER_PARAMS };

    expect(validateToolArgs(tool, { city: 'SF' }).valid).toBe(true);

    const missing = validateToolArgs(tool, {});
    expect(missing.valid).toBe(false);
    if (!missing.valid) {
      expect(missing.errors[0]?.path).toBe('$.city');
    }

    const wrongType = validateToolArgs(tool, { city: 42 });
    expect(wrongType.valid).toBe(false);
  });

  it('validates enums, numbers, and arrays', () => {
    const tool: IRTool = {
      name: 't',
      description: '',
      parameters: {
        type: 'object',
        properties: {
          unit: { type: 'string', enum: ['c', 'f'] },
          count: { type: 'integer', minimum: 1 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 2 },
        },
      },
    };

    expect(validateToolArgs(tool, { unit: 'c', count: 2, tags: ['a'] }).valid).toBe(true);
    expect(validateToolArgs(tool, { unit: 'x' }).valid).toBe(false);
    expect(validateToolArgs(tool, { count: 0.5 }).valid).toBe(false);
    expect(validateToolArgs(tool, { tags: ['a', 'b', 'c'] }).valid).toBe(false);
  });
});

// ============================================================================
// runTools
// ============================================================================

describe('bridge.runTools', () => {
  it('runs a single tool round then returns the final answer', async () => {
    const backend = scriptedBackend([
      toolCallResponse([{ id: 't1', name: 'get_weather', input: { city: 'SF' } }]),
      { message: { role: 'assistant', content: 'It is 65F in SF.' }, finishReason: 'stop' },
    ]);

    const executed: string[] = [];
    const result = await makeBridge(backend).runTools({
      prompt: 'Weather in SF?',
      tools: {
        get_weather: {
          description: 'Get weather',
          parameters: WEATHER_PARAMS,
          execute: ({ city }) => {
            executed.push(city as string);
            return { temp: 65 };
          },
        },
      },
    });

    expect(executed).toEqual(['SF']);
    expect(result.text).toBe('It is 65F in SF.');
    expect(result.steps).toHaveLength(2);
    expect(result.totalUsage.totalTokens).toBe(30);

    // Second request carries the assistant tool call + tool result
    const secondRequest = backend.requests[1];
    expect(secondRequest?.messages.some((m) => m.role === 'tool')).toBe(true);
    // Tools are converted from the record to the IR array
    expect(secondRequest?.tools?.[0]?.name).toBe('get_weather');
  });

  it('executes parallel tool calls concurrently', async () => {
    const backend = scriptedBackend([
      toolCallResponse([
        { id: 't1', name: 'get_weather', input: { city: 'SF' } },
        { id: 't2', name: 'get_weather', input: { city: 'NYC' } },
      ]),
      { message: { role: 'assistant', content: 'Both sunny.' }, finishReason: 'stop' },
    ]);

    let inFlight = 0;
    let maxInFlight = 0;

    const result = await makeBridge(backend).runTools({
      prompt: 'Weather in SF and NYC?',
      tools: {
        get_weather: {
          description: 'Get weather',
          parameters: WEATHER_PARAMS,
          execute: async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 10));
            inFlight--;
            return 'sunny';
          },
        },
      },
    });

    expect(maxInFlight).toBe(2);
    expect(result.steps[0]?.toolResults).toHaveLength(2);
  });

  it('feeds handler errors back as isError tool results', async () => {
    const backend = scriptedBackend([
      toolCallResponse([{ id: 't1', name: 'get_weather', input: { city: 'SF' } }]),
      { message: { role: 'assistant', content: 'Could not check.' }, finishReason: 'stop' },
    ]);

    const result = await makeBridge(backend).runTools({
      prompt: 'Weather?',
      tools: {
        get_weather: {
          description: 'Get weather',
          parameters: WEATHER_PARAMS,
          execute: () => {
            throw new Error('service down');
          },
        },
      },
    });

    expect(result.steps[0]?.toolResults[0]).toMatchObject({
      toolCallId: 't1',
      result: 'service down',
      isError: true,
    });
  });

  it('feeds invalid arguments back instead of throwing', async () => {
    const backend = scriptedBackend([
      toolCallResponse([{ id: 't1', name: 'get_weather', input: { city: 42 } }]),
      { message: { role: 'assistant', content: 'retried' }, finishReason: 'stop' },
    ]);

    let executed = false;
    const result = await makeBridge(backend).runTools({
      prompt: 'Weather?',
      tools: {
        get_weather: {
          description: 'Get weather',
          parameters: WEATHER_PARAMS,
          execute: () => {
            executed = true;
            return 'x';
          },
        },
      },
    });

    expect(executed).toBe(false);
    expect(result.steps[0]?.toolResults[0]?.isError).toBe(true);
    expect(String(result.steps[0]?.toolResults[0]?.result)).toContain('Invalid arguments');
  });

  it('handles unknown tool names gracefully', async () => {
    const backend = scriptedBackend([
      toolCallResponse([{ id: 't1', name: 'nonexistent', input: {} }]),
      { message: { role: 'assistant', content: 'ok' }, finishReason: 'stop' },
    ]);

    const result = await makeBridge(backend).runTools({
      prompt: 'Go',
      tools: {
        get_weather: {
          description: 'Get weather',
          parameters: WEATHER_PARAMS,
          execute: () => 'x',
        },
      },
    });

    expect(result.steps[0]?.toolResults[0]).toMatchObject({ isError: true });
  });

  it('throws MAX_TOOL_ITERATIONS_EXCEEDED when the model never answers', async () => {
    const backend = scriptedBackend([
      toolCallResponse([{ id: 't1', name: 'get_weather', input: { city: 'SF' } }]),
    ]);

    await expect(
      makeBridge(backend).runTools({
        prompt: 'Loop forever',
        maxIterations: 3,
        tools: {
          get_weather: {
            description: 'Get weather',
            parameters: WEATHER_PARAMS,
            execute: () => 'sunny',
          },
        },
      })
    ).rejects.toThrow(/exceeded 3 iterations/);

    expect(backend.requests).toHaveLength(3);
  });

  it('requires a prompt or messages', async () => {
    const backend = scriptedBackend([]);
    await expect(
      makeBridge(backend).runTools({ tools: {} })
    ).rejects.toThrow(/requires either/);
  });
});
