/**
 * MCP <-> IR Translation
 *
 * Pure functions converting between MCP's tool/result shapes and ai.matey's
 * IR types. No client, no I/O - just the mapping.
 *
 * @module
 */

import type { IRTool, JSONSchema } from 'ai.matey.types';
import type { McpCallToolResult, McpContentBlock, McpToolSchema } from './types.js';

/**
 * Convert an MCP tool schema to an IR tool definition.
 *
 * `IRTool.description` is required; MCP's is optional, so a missing
 * description becomes an empty string rather than `undefined`.
 */
export function mcpToolToIRTool(tool: McpToolSchema): IRTool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    parameters: tool.inputSchema as unknown as JSONSchema,
  };
}

/**
 * Extract a best-effort text representation of an MCP tool call result, for
 * feeding back to the model as a tool result.
 *
 * Joins `text` fields from content blocks; if none are present, falls back
 * to JSON-stringifying `structuredContent` (or the raw content array).
 */
export function extractMcpResultText(result: McpCallToolResult): string {
  const text = result.content
    .filter((block): block is McpContentBlockWithText => typeof block.text === 'string')
    .map((block) => block.text)
    .join('');

  if (text.length > 0) {
    return text;
  }

  return JSON.stringify(result.structuredContent ?? result.content);
}

interface McpContentBlockWithText extends McpContentBlock {
  readonly text: string;
}
