/**
 * ai.matey.mcp
 *
 * MCP (Model Context Protocol) tool-calling for AI Matey. Translates MCP
 * tools into the `ToolDefinition` shape consumed by `ai.matey.core`'s
 * `Bridge.runTools()` agentic loop, via an injectable MCP client - no hard
 * (or peer) dependency on any MCP SDK.
 *
 * @module
 */

export type { McpClientLike, McpToolSchema, McpContentBlock, McpCallToolResult } from './types.js';

export { mcpToolToIRTool, extractMcpResultText } from './convert.js';

export { mcpToolsToDefinitions, type McpToolsToDefinitionsOptions } from './tool-definitions.js';

export { runMcpTools, type RunMcpToolsOptions } from './run-mcp-tools.js';
