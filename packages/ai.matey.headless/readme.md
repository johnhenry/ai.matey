# ai.matey.headless

Framework-agnostic headless chat client for the AI Matey universal adapter system.

## Installation

```bash
npm install ai.matey.headless
```

## Overview

This package provides a headless chat client that works directly with any AI Matey backend adapter, without requiring a UI framework like React, Vue, or Svelte. Perfect for:

- CLI tools and chatbots
- Discord/Slack bots
- Server-side batch processing
- Testing and automation
- Any Node.js/Deno application

## Quick Start

```typescript
import { createChat } from 'ai.matey.headless';
import { AnthropicBackend } from 'ai.matey.backend.anthropic';

// Create a chat instance
const chat = createChat({
  backend: new AnthropicBackend({
    apiKey: process.env.ANTHROPIC_API_KEY
  }),
  systemPrompt: 'You are a helpful assistant.',
  historyLimit: 50,
});

// Send a message (non-streaming)
const response = await chat.send('Hello!');
console.log(response.content);

// Continue the conversation
const followUp = await chat.send('Tell me more about that.');
console.log(followUp.content);

// Access conversation state
console.log('Messages:', chat.messages.length);
console.log('Total tokens:', chat.totalUsage.totalTokens);
```

## Streaming

```typescript
// Stream with callbacks
await chat.stream('Tell me a story', {
  onChunk: ({ delta, accumulated }) => {
    process.stdout.write(delta);
  },
  onDone: (response) => {
    console.log('\n--- Done ---');
    console.log('Tokens used:', response.usage?.totalTokens);
  },
});

// Or use stream utilities directly
import { streamToText, collectStream } from 'ai.matey.headless';

const stream = backend.executeStream(request);

// Simple text iteration
for await (const text of streamToText(stream)) {
  process.stdout.write(text);
}

// Or collect the full result
const result = await collectStream(stream);
console.log(result.content);
```

## Tool Calling

```typescript
const chat = createChat({
  backend: myBackend,
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    },
  ],
  onToolCall: async (name, input, id) => {
    if (name === 'get_weather') {
      // Call your weather API
      return `Weather in ${input.location}: Sunny, 72°F`;
    }
    return 'Tool not found';
  },
  autoExecuteTools: true, // Automatically execute and continue
});

const response = await chat.send('What\'s the weather in Tokyo?');
// The assistant will call the tool, get the result, and respond naturally
```

## Event Handling

```typescript
// Subscribe to events
const unsubscribe = chat.on('message', ({ message, response }) => {
  console.log('New message:', message.role, response.content);
});

chat.on('state-change', ({ state }) => {
  console.log('Loading:', state.isLoading);
  console.log('Messages:', state.messages.length);
});

chat.on('error', ({ error }) => {
  console.error('Error:', error.message);
});

// Unsubscribe when done
unsubscribe();
```

## Stream Utilities

The package includes powerful stream utilities:

```typescript
import {
  collectStream,    // Collect stream into single result
  processStream,    // Process with callbacks + return result
  streamToText,     // Convert to simple text iterator
  streamToLines,    // Buffer and yield complete lines
  throttleStream,   // Rate-limit chunk delivery
  teeStream,        // Split into multiple streams
} from 'ai.matey.headless';

// Throttle UI updates to max 50ms intervals
for await (const chunk of throttleStream(stream, 50)) {
  updateUI(chunk);
}

// Split stream for parallel processing
const [logStream, uiStream] = teeStream(stream, 2);

await Promise.all([
  processStream(logStream, { onContent: (d) => logger.log(d) }),
  processStream(uiStream, { onContent: (d) => ui.append(d) }),
]);
```

## Configuration Options

```typescript
interface ChatConfig {
  // Required: Backend adapter or Bridge
  backend: ChatBackend;

  // Optional: System prompt (string or async function)
  systemPrompt?: string | (() => string | Promise<string>);

  // Optional: Max messages in history (default: 100)
  historyLimit?: number;

  // Optional: Default parameters for all requests
  defaultParameters?: IRParameters;

  // Optional: Available tools
  tools?: IRTool[];

  // Optional: Tool execution handler
  onToolCall?: ToolCallHandler;

  // Optional: Auto-execute tools (default: false)
  autoExecuteTools?: boolean;

  // Optional: Max tool rounds (default: 10)
  maxToolRounds?: number;
}
```

## API Reference

### Chat Class

| Method | Description |
|--------|-------------|
| `send(content, options?)` | Send a message and get response |
| `stream(content, options?)` | Stream a response with callbacks |
| `addMessage(message)` | Add a message without sending |
| `clear()` | Clear conversation history |
| `removeLastMessages(count?)` | Remove last N messages |
| `on(event, listener)` | Subscribe to events |
| `off(event, listener)` | Unsubscribe from events |

### Properties

| Property | Description |
|----------|-------------|
| `messages` | All messages in conversation |
| `isLoading` | Whether request is in progress |
| `error` | Current error, if any |
| `totalUsage` | Cumulative token usage |
| `requestCount` | Number of requests made |
| `state` | Full state snapshot |

## License

MIT
