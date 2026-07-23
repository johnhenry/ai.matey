# ai.matey.mcp

MCP (Model Context Protocol) tool-calling for the [ai.matey](https://github.com/johnhenry/ai.matey)
Universal AI Adapter System — translate an MCP server's tools into the agentic tool-execution
loop `ai.matey.core`'s `Bridge` already ships (`bridge.runTools()`), via an injectable client.

```bash
npm install ai.matey.mcp
```

No hard (or peer) dependency on any MCP SDK — `ai.matey.mcp` depends only on `ai.matey.types` and
a small structural interface (`McpClientLike`: `listTools`, `callTool`) that any MCP client can
satisfy: the official `@modelcontextprotocol/sdk`, [`mcp-query`](https://github.com/johnhenry/mcp-query)
(`@johnhenry/mcpq`), or a test fake.

## Why this is small

`ai.matey.core` already has a complete agentic loop (`Bridge.runTools()` / `createRunTools()`):
execute → if the model requests tools, run them → append results → re-execute, until the model
answers. This package doesn't reimplement any of that — it just converts MCP tools into the
`ToolDefinition` shape that loop already consumes, so MCP tool-calling gets the same validation,
iteration limits, and parallel execution for free.

## Quick start

```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { OpenAIBackendAdapter } from 'ai.matey.backend';
import { runMcpTools } from 'ai.matey.mcp';

// Any client satisfying McpClientLike - e.g. an mcp-query MCPClient already
// connected to one or more servers.
declare const mcpClient: import('ai.matey.mcp').McpClientLike;

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const result = await runMcpTools(bridge.runTools, {
  client: mcpClient,
  prompt: 'What files changed in the last commit?',
});

console.log(result.text);
```

## API

| Export | Purpose |
|---|---|
| `McpClientLike` | The structural interface an injected MCP client must satisfy (`listTools`, `callTool`) |
| `mcpToolToIRTool(tool)` | Convert one MCP tool schema to an `IRTool` |
| `extractMcpResultText(result)` | Best-effort text extraction from an MCP `CallToolResult` |
| `mcpToolsToDefinitions(client, options?)` | List an MCP client's tools and build a `Record<string, ToolDefinition>` |
| `runMcpTools(runTools, options)` | Run `bridge.runTools()` (or any compatible `runTools` function) against an MCP client's tools |

`mcpToolsToDefinitions` and `runMcpTools` both accept:
- `server?: string` — which server to list/call tools against, for multi-server clients
- `toolFilter?: (tool: McpToolSchema) => boolean` — only include matching tools
- `signal?: AbortSignal` — forwarded to `callTool`

## Using your own tools object

If you want more control than `runMcpTools` gives you (e.g. mixing MCP tools with hand-written
ones), use `mcpToolsToDefinitions` directly and call `bridge.runTools()` yourself:

```typescript
import { mcpToolsToDefinitions } from 'ai.matey.mcp';

const mcpTools = await mcpToolsToDefinitions(mcpClient);

const result = await bridge.runTools({
  prompt: 'Summarize the open issues.',
  tools: { ...mcpTools, myOwnTool: { description: '...', parameters: {...}, execute: async () => {...} } },
});
```

## WebMCP compatibility

Works with WebMCP-exposed tools (tools registered in-page via `document.modelContext`, consumed by
a browser-side agent) without any changes here - `mcp-query` ships `webMcpToolServer()`, an
in-memory MCP-server shim you can plug into `new MCPClient({ servers: { page: webMcpToolServer() } })`.
Any `MCPClient` built that way already satisfies `McpClientLike`.

## License

MIT
