/**
 * Non-streaming tool-calling mapping tests
 *
 * Verifies that the OpenAI and Anthropic backend adapters translate IR tool
 * definitions, tool_use messages, and tool_result messages to/from provider
 * wire formats, and that the frontend adapters accept and re-emit tools in
 * their native request/response shapes.
 */

import { describe, it, expect } from 'vitest';
import { OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.backend';
import { OpenAIFrontendAdapter, AnthropicFrontendAdapter } from 'ai.matey.frontend';
import type { IRChatRequest, IRChatResponse, IRTool } from 'ai.matey.types';

const WEATHER_TOOL: IRTool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
};

function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Weather in SF?' }],
    parameters: { model: 'test-model' },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

describe('OpenAI backend tool mapping', () => {
  const adapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });

  it('maps IR tools and toolChoice into the request', () => {
    const openaiRequest = adapter.fromIR(
      makeRequest({ tools: [WEATHER_TOOL], toolChoice: 'auto' })
    );

    expect(openaiRequest.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: WEATHER_TOOL.parameters,
        },
      },
    ]);
    expect(openaiRequest.tool_choice).toBe('auto');
  });

  it('maps named toolChoice to function selector', () => {
    const openaiRequest = adapter.fromIR(
      makeRequest({ tools: [WEATHER_TOOL], toolChoice: { name: 'get_weather' } })
    );

    expect(openaiRequest.tool_choice).toEqual({
      type: 'function',
      function: { name: 'get_weather' },
    });
  });

  it('omits tools when the IR request has none', () => {
    const openaiRequest = adapter.fromIR(makeRequest());
    expect(openaiRequest.tools).toBeUndefined();
    expect(openaiRequest.tool_choice).toBeUndefined();
  });

  it('converts assistant tool_use blocks to tool_calls', () => {
    const openaiRequest = adapter.fromIR(
      makeRequest({
        messages: [
          { role: 'user', content: 'Weather in SF?' },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me check.' },
              {
                type: 'tool_use',
                id: 'call_1',
                name: 'get_weather',
                input: { location: 'SF' },
              },
            ],
          },
        ],
      })
    );

    const assistantMessage = openaiRequest.messages.find((m) => m.role === 'assistant');
    expect(assistantMessage?.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"SF"}' },
      },
    ]);
  });

  it('expands tool_result blocks into role:tool messages', () => {
    const openaiRequest = adapter.fromIR(
      makeRequest({
        messages: [
          { role: 'user', content: 'Weather in SF?' },
          {
            role: 'tool',
            content: [
              { type: 'tool_result', toolUseId: 'call_1', content: '{"temp": 65}' },
              { type: 'tool_result', toolUseId: 'call_2', content: 'sunny' },
            ],
          },
        ],
      })
    );

    const toolMessages = openaiRequest.messages.filter((m) => m.role === 'tool');
    expect(toolMessages).toHaveLength(2);
    expect(toolMessages[0]).toMatchObject({ tool_call_id: 'call_1', content: '{"temp": 65}' });
    expect(toolMessages[1]).toMatchObject({ tool_call_id: 'call_2', content: 'sunny' });
  });

  it('parses tool_calls from responses into tool_use blocks', () => {
    const irResponse = adapter.toIR(
      {
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"SF"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
      makeRequest(),
      12
    );

    expect(irResponse.finishReason).toBe('tool_calls');
    expect(irResponse.message.content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { location: 'SF' } },
    ]);
  });

  it('degrades malformed tool arguments to an empty object', () => {
    const irResponse = adapter.toIR(
      {
        id: 'chatcmpl-2',
        object: 'chat.completion',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location": tru' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      },
      makeRequest(),
      5
    );

    expect(irResponse.message.content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'get_weather', input: {} },
    ]);
  });
});

describe('Anthropic backend tool mapping', () => {
  const adapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

  it('maps IR tools into input_schema format', () => {
    const anthropicRequest = adapter.fromIR(
      makeRequest({ tools: [WEATHER_TOOL], toolChoice: 'auto' })
    );

    expect(anthropicRequest.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get current weather for a location',
        input_schema: WEATHER_TOOL.parameters,
      },
    ]);
    expect(anthropicRequest.tool_choice).toEqual({ type: 'auto' });
  });

  it('maps required/none/named toolChoice', () => {
    expect(
      adapter.fromIR(makeRequest({ tools: [WEATHER_TOOL], toolChoice: 'required' })).tool_choice
    ).toEqual({ type: 'any' });
    expect(
      adapter.fromIR(makeRequest({ tools: [WEATHER_TOOL], toolChoice: 'none' })).tool_choice
    ).toEqual({ type: 'none' });
    expect(
      adapter.fromIR(makeRequest({ tools: [WEATHER_TOOL], toolChoice: { name: 'get_weather' } }))
        .tool_choice
    ).toEqual({ type: 'tool', name: 'get_weather' });
  });

  it('omits tools when the IR request has none', () => {
    const anthropicRequest = adapter.fromIR(makeRequest());
    expect(anthropicRequest.tools).toBeUndefined();
    expect(anthropicRequest.tool_choice).toBeUndefined();
  });
});

describe('OpenAI frontend tool mapping', () => {
  const adapter = new OpenAIFrontendAdapter();

  it('converts request tools to IR', async () => {
    const irRequest = await adapter.toIR({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'Weather in SF?' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: WEATHER_TOOL.parameters as unknown as Record<string, unknown>,
          },
        },
      ],
      tool_choice: 'auto',
    });

    expect(irRequest.tools).toEqual([WEATHER_TOOL]);
    expect(irRequest.toolChoice).toBe('auto');
  });

  it('converts assistant tool_calls and tool results to IR blocks', async () => {
    const irRequest = await adapter.toIR({
      model: 'gpt-test',
      messages: [
        { role: 'user', content: 'Weather in SF?' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location":"SF"}' },
            },
          ],
        },
        { role: 'tool', content: '{"temp": 65}', tool_call_id: 'call_1' },
      ],
    });

    expect(irRequest.messages[1]?.content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { location: 'SF' } },
    ]);
    expect(irRequest.messages[2]?.content).toEqual([
      { type: 'tool_result', toolUseId: 'call_1', content: '{"temp": 65}' },
    ]);
  });

  it('re-emits tool_use blocks as tool_calls in responses', async () => {
    const irResponse: IRChatResponse = {
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { location: 'SF' } },
        ],
      },
      finishReason: 'tool_calls',
      metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    };

    const openaiResponse = await adapter.fromIR(irResponse);
    const choice = openaiResponse.choices[0];

    expect(choice?.finish_reason).toBe('tool_calls');
    expect(choice?.message.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"SF"}' },
      },
    ]);
  });
});

describe('Anthropic frontend tool mapping', () => {
  const adapter = new AnthropicFrontendAdapter();

  it('converts request tools and tool_choice to IR', async () => {
    const irRequest = await adapter.toIR({
      model: 'claude-test',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Weather in SF?' }],
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather for a location',
          input_schema: WEATHER_TOOL.parameters as unknown as Record<string, unknown>,
        },
      ],
      tool_choice: { type: 'any' },
    });

    expect(irRequest.tools).toEqual([WEATHER_TOOL]);
    expect(irRequest.toolChoice).toBe('required');
  });

  it('converts tool_result content blocks to IR', async () => {
    const irRequest = await adapter.toIR({
      model: 'claude-test',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'Weather in SF?' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { location: 'SF' } },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'sunny, 65F' }],
        },
      ],
    });

    expect(irRequest.messages[2]?.content).toEqual([
      { type: 'tool_result', toolUseId: 'toolu_1', content: 'sunny, 65F', isError: undefined },
    ]);
  });
});
