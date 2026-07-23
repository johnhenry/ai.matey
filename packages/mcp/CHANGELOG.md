# ai.matey.mcp

## 0.1.0

### Minor Changes

- d21fe3d: New package: `ai.matey.mcp` - MCP (Model Context Protocol) tool-calling for AI Matey.

  Translates MCP tools into the `ToolDefinition` shape consumed by `ai.matey.core`'s
  `Bridge.runTools()` agentic loop, via an injectable `McpClientLike` client - no hard (or peer)
  dependency on any MCP SDK. Any client satisfying the small structural interface (`listTools`,
  `callTool`) works: the official `@modelcontextprotocol/sdk` wrapped by hand,
  [`mcp-query`](https://github.com/johnhenry/mcp-query) (`@johnhenry/mcpq`), or a test fake.
  Also compatible with WebMCP-exposed tools via `mcp-query`'s `webMcpToolServer()` shim, with no
  changes needed on either side.

  Exports: `McpClientLike`/`McpToolSchema`/`McpCallToolResult` (structural types),
  `mcpToolToIRTool`/`extractMcpResultText` (pure MCP↔IR conversion), `mcpToolsToDefinitions`
  (MCP tools → `Record<string, ToolDefinition>`), and `runMcpTools` (a convenience wrapper composing
  `mcpToolsToDefinitions` with an already-bound `runTools` function, e.g. `bridge.runTools`).

  Depends only on `ai.matey.types` - `ai.matey.core` itself is untouched by this change.
