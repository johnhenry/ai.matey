/**
 * runMcpTools - composes mcpToolsToDefinitions with an injected `runTools`
 * function (e.g. `bridge.runTools`), without depending on ai.matey.core.
 */

import { describe, it, expect, vi } from 'vitest';
import { runMcpTools } from 'ai.matey.mcp';
import type { McpClientLike, McpToolSchema } from 'ai.matey.mcp';
import type { RunToolsOptions, RunToolsResult } from 'ai.matey.types';

const WEATHER_TOOL: McpToolSchema = {
  name: 'get_weather',
  description: 'Get current weather',
  inputSchema: { type: 'object' },
};

function makeFakeClient(): McpClientLike {
  return {
    listTools: () => [WEATHER_TOOL],
    callTool: async () => ({ content: [{ type: 'text', text: 'Sunny' }] }),
  };
}

function makeFakeRunTools(): {
  runTools: (options: RunToolsOptions) => Promise<RunToolsResult>;
  received: RunToolsOptions[];
} {
  const received: RunToolsOptions[] = [];
  const runTools = vi.fn(async (options: RunToolsOptions): Promise<RunToolsResult> => {
    received.push(options);
    return {
      text: 'done',
      response: {
        message: { role: 'assistant', content: 'done' },
        finishReason: 'stop',
        metadata: { requestId: 'r1', timestamp: Date.now(), provenance: {} },
      },
      messages: [],
      steps: [],
      finishReason: 'stop',
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  });
  return { runTools, received };
}

describe('runMcpTools', () => {
  it('builds tools from the MCP client and forwards other options to runTools', async () => {
    const client = makeFakeClient();
    const { runTools, received } = makeFakeRunTools();

    const result = await runMcpTools(runTools, {
      client,
      prompt: 'What is the weather?',
      maxIterations: 3,
    });

    expect(result.text).toBe('done');
    expect(received).toHaveLength(1);
    expect(received[0]?.prompt).toBe('What is the weather?');
    expect(received[0]?.maxIterations).toBe(3);
    expect(Object.keys(received[0]?.tools ?? {})).toEqual(['get_weather']);
  });

  it('does not forward client/server/toolFilter to runTools', async () => {
    const client = makeFakeClient();
    const { runTools, received } = makeFakeRunTools();

    await runMcpTools(runTools, {
      client,
      server: 'backend',
      toolFilter: () => true,
      prompt: 'hi',
    });

    const forwarded = received[0] as Record<string, unknown>;
    expect(forwarded.client).toBeUndefined();
    expect(forwarded.server).toBeUndefined();
    expect(forwarded.toolFilter).toBeUndefined();
  });
});
