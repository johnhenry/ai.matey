/**
 * MCP <-> IR translation (pure functions, no client).
 */

import { describe, it, expect } from 'vitest';
import { mcpToolToIRTool, extractMcpResultText } from 'ai.matey.mcp';
import type { McpCallToolResult, McpToolSchema } from 'ai.matey.mcp';

describe('mcpToolToIRTool', () => {
  it('maps name, description, and inputSchema through', () => {
    const tool: McpToolSchema = {
      name: 'get_weather',
      description: 'Get current weather for a location',
      inputSchema: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
    };

    const irTool = mcpToolToIRTool(tool);

    expect(irTool).toEqual({
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: tool.inputSchema,
    });
  });

  it('falls back to an empty description when MCP omits it', () => {
    const tool: McpToolSchema = { name: 'noop', inputSchema: { type: 'object' } };
    const irTool = mcpToolToIRTool(tool);
    expect(irTool.description).toBe('');
  });
});

describe('extractMcpResultText', () => {
  it('joins text content blocks', () => {
    const result: McpCallToolResult = {
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ],
    };
    expect(extractMcpResultText(result)).toBe('Hello world');
  });

  it('ignores non-text blocks when joining', () => {
    const result: McpCallToolResult = {
      content: [
        { type: 'text', text: 'partial' },
        { type: 'image', data: 'base64...' },
      ],
    };
    expect(extractMcpResultText(result)).toBe('partial');
  });

  it('falls back to structuredContent when there is no text', () => {
    const result: McpCallToolResult = {
      content: [{ type: 'image', data: 'base64...' }],
      structuredContent: { temperature: 72 },
    };
    expect(extractMcpResultText(result)).toBe(JSON.stringify({ temperature: 72 }));
  });

  it('falls back to the raw content array when there is neither text nor structuredContent', () => {
    const result: McpCallToolResult = { content: [{ type: 'image', data: 'base64...' }] };
    expect(extractMcpResultText(result)).toBe(JSON.stringify(result.content));
  });
});
