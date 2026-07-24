# ai.matey.core

Core Bridge, Router, and MiddlewareStack implementations

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.core
```

## Exports

- `Bridge`
- `createBridge`
- `Router`
- `createRouter`
- `MiddlewareStack`
- `createMiddlewareContext`
- `createRunTools`, `RunToolsBridge` (type)

## Usage

```typescript
import { Bridge, createBridge, Router, createRouter, MiddlewareStack, createMiddlewareContext } from 'ai.matey.core';
```

## Structured Output

`Bridge.chat()`/`chatStream()` accept a `responseFormat` field on the request for
schema-constrained JSON output - see [`docs/IR-FORMAT.md`](../../docs/IR-FORMAT.md#structured-output)
for the per-backend support matrix.

## Agentic Tool Calling

Every `Bridge` instance exposes `bridge.runTools(options)` (built from `createRunTools`) - an
execute → extract tool calls → run them → append results → re-execute loop that continues until
the model answers or `maxIterations` is reached:

```typescript
const result = await bridge.runTools({
  prompt: 'What is 12 * 47?',
  tools: {
    multiply: {
      description: 'Multiply two numbers',
      parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
      execute: ({ a, b }) => a * b,
    },
  },
});
```

For MCP (Model Context Protocol) tools specifically, see
[`ai.matey.mcp`](../mcp/readme.md), which translates MCP tools into the same `ToolDefinition`
shape this loop consumes.

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
