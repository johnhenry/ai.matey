/**
 * mcpToolsToDefinitions - MCP tools -> ToolDefinition, backed by a fake
 * McpClientLike (no real MCP server, no mcp-query dependency).
 */

import { describe, it, expect } from 'vitest';
import { mcpToolsToDefinitions } from 'ai.matey.mcp';
import type { McpCallToolResult, McpClientLike, McpToolSchema } from 'ai.matey.mcp';

const WEATHER_TOOL: McpToolSchema = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: { type: 'object', properties: { location: { type: 'string' } } },
};

const FAIL_TOOL: McpToolSchema = {
  name: 'always_fails',
  description: 'A tool that always errors',
  inputSchema: { type: 'object' },
};

function makeFakeClient(): {
  client: McpClientLike;
  calls: Array<{ name: string; args: Record<string, unknown>; server?: string }>;
} {
  const calls: Array<{ name: string; args: Record<string, unknown>; server?: string }> = [];

  const client: McpClientLike = {
    listTools: () => [WEATHER_TOOL, FAIL_TOOL],
    callTool: async (name, args, opts) => {
      calls.push({ name, args, server: opts?.server });
      if (name === 'always_fails') {
        return { content: [{ type: 'text', text: 'boom' }], isError: true };
      }
      return { content: [{ type: 'text', text: 'Sunny, 72F' }] } satisfies McpCallToolResult;
    },
  };

  return { client, calls };
}

describe('mcpToolsToDefinitions', () => {
  it('builds a ToolDefinition per listed tool', async () => {
    const { client } = makeFakeClient();
    const definitions = await mcpToolsToDefinitions(client);

    expect(Object.keys(definitions).sort()).toEqual(['always_fails', 'get_weather']);
    expect(definitions.get_weather?.description).toBe('Get current weather for a location');
    expect(definitions.get_weather?.parameters).toEqual(WEATHER_TOOL.inputSchema);
  });

  it('execute() calls through to client.callTool with the right args and returns extracted text', async () => {
    const { client, calls } = makeFakeClient();
    const definitions = await mcpToolsToDefinitions(client, { server: 'backend' });

    const result = await definitions.get_weather?.execute(
      { location: 'SF' },
      { toolCallId: 'call_1', messages: [] }
    );

    expect(result).toBe('Sunny, 72F');
    expect(calls).toEqual([{ name: 'get_weather', args: { location: 'SF' }, server: 'backend' }]);
  });

  it('execute() throws when the MCP result has isError: true', async () => {
    const { client } = makeFakeClient();
    const definitions = await mcpToolsToDefinitions(client);

    await expect(
      definitions.always_fails?.execute({}, { toolCallId: 'call_2', messages: [] })
    ).rejects.toThrow('boom');
  });

  it('toolFilter excludes non-matching tools', async () => {
    const { client } = makeFakeClient();
    const definitions = await mcpToolsToDefinitions(client, {
      toolFilter: (tool) => tool.name === 'get_weather',
    });

    expect(Object.keys(definitions)).toEqual(['get_weather']);
  });
});
