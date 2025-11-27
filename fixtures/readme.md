# Test Fixtures

This directory contains test fixtures for all AI providers supported by ai.matey.universal.

## Directory Structure

```
fixtures/
├── openai/
│   ├── basic-chat.json
│   ├── streaming-chat.json
│   ├── tools-function-calling.json
│   ├── vision-image-analysis.json
│   └── collections/
│       └── all-scenarios.json
├── anthropic/
│   ├── basic-chat.json
│   ├── streaming-chat.json
│   └── ...
├── gemini/
├── ollama/
└── README.md (this file)
```

## Fixture Format

### Non-Streaming Fixture

```json
{
  "metadata": {
    "provider": "openai",
    "scenario": "basic-chat",
    "model": "gpt-4",
    "capturedAt": "2025-10-26T12:00:00.000Z",
    "description": "Basic chat completion",
    "tags": ["chat", "completion"],
    "apiVersion": "v1"
  },
  "request": {
    "messages": [...],
    "parameters": {...},
    "metadata": {...}
  },
  "response": {
    "message": {...},
    "usage": {...},
    "metadata": {...}
  },
  "providerRequest": {...},  // Optional: original provider-specific request
  "providerResponse": {...}  // Optional: original provider-specific response
}
```

### Streaming Fixture

```json
{
  "metadata": {
    "provider": "openai",
    "scenario": "streaming-chat",
    "model": "gpt-4",
    "capturedAt": "2025-10-26T12:00:00.000Z",
    "description": "Streaming chat completion",
    "tags": ["chat", "streaming"],
    "apiVersion": "v1"
  },
  "request": {
    "messages": [...],
    "parameters": {
      "stream": true,
      ...
    },
    "metadata": {...}
  },
  "chunks": [
    {
      "type": "delta",
      "delta": {
        "content": [{"type": "text", "text": "Hello"}]
      }
    },
    ...
  ],
  "finalResponse": {...},  // Optional: complete response after streaming
  "providerRequest": {...},
  "providerStreamEvents": [...]  // Optional: original provider SSE events
}
```

## Usage in Tests

```typescript
import { loadFixture, createMockFromFixture } from '../src/testing/index.js';

// Load a fixture
const fixture = await loadFixture('openai', 'basic-chat');

// Create a mock backend from the fixture
const mockBackend = createMockFromFixture(fixture);

// Use in tests
const response = await mockBackend.chat(fixture.request);
expect(response).toEqual(fixture.response);
```

## Capturing New Fixtures

```typescript
import { captureChat } from '../src/testing/index.js';

// After making a real API call
await captureChat(
  {
    provider: 'openai',
    scenario: 'basic-chat',
    description: 'Simple chat completion',
    tags: ['chat'],
    sanitize: true,  // Remove API keys
  },
  request,
  response
);
```

## Guidelines

1. **Naming Convention**: Use lowercase with hyphens (e.g., `basic-chat.json`, `streaming-with-tools.json`)

2. **Scenarios**: Common scenarios include:
   - `basic-chat`: Simple text completion
   - `streaming-chat`: Streaming text completion
   - `tools-function-calling`: Function/tool calling
   - `vision-image-analysis`: Vision/image understanding
   - `json-mode`: Structured JSON output
   - `multi-turn-conversation`: Multiple message exchanges

3. **Sanitization**: Always sanitize API keys and sensitive data before committing fixtures

4. **Versioning**: Include `apiVersion` in metadata to track provider API changes

5. **Tags**: Use tags for easy categorization and searching

## Maintenance

- Fixtures should be updated when provider APIs change
- Run fixture refresh script periodically to update stale fixtures
- Keep fixture files under 100KB when possible
- For large responses, consider using fixture collections

## Testing with Fixtures

Benefits of fixture-based testing:
- **Fast**: No real API calls, tests run instantly
- **Deterministic**: Same input always produces same output
- **Offline**: Can run tests without internet connection
- **Cost**: No API costs for running tests
- **Regression**: Detect breaking changes in adapters
