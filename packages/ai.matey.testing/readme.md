# @johnhenry/aimatey-testing

> **Note:** Previously published as `ai.matey.testing@0.2.2`.

Testing utilities, mocks, and fixtures for ai.matey

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install @johnhenry/aimatey-testing
```

## Exports

**Fixture loading** - `loadFixture`, `loadProviderFixtures`, `loadFixtureCollection`,
`findFixtures`, `clearFixtureCache`, `getFixtureCacheStats`, `FIXTURES_DIR`

**Fixture capture** - `captureChat`, `captureStream`, `createCaptureMiddleware`, `bulkCapture`

**Fixture helpers** - `createMockFromFixture`, `createMocksFromFixtures`,
`createConfigurableMock`, `replayStreamWithTiming`, `validateAgainstFixture`,
`extractRequest`, `extractResponse`, `extractChunks`, `collectChunksToResponse`

**Assertions** - `assertValidChatRequest`, `assertValidChatResponse`,
`assertValidStreamChunk`, `assertValidStreamSequence`, `assertValidMessage`,
`assertValidMessageContent`, `assertResponseHasText`, `assertResponseHasToolUse`,
`assertReasonableUsage`

**Builders and extraction** - `buildChatRequest`, `buildMultiTurnRequest`,
`extractTextFromResponse`, `extractToolUsesFromResponse`, `accumulateStreamText`,
`estimateTokens`

**Property-based testing** - `forAll`, `SeededRandom`, `generateChatRequest`,
`generateUserMessage`, `generateAssistantMessage`, `generateSystemMessage`,
`generateTextContent`, `generateParameters`, `shrinkChatRequest`,
`propertyValidRequest`, `propertyMultiTurnAlternates`

**Type guards** - `isChatFixture`, `isStreamingFixture`

## Usage

```typescript
import {
  loadFixture,
  createMockFromFixture,
  extractRequest,
  assertValidChatResponse,
} from '@johnhenry/aimatey-testing';

// Replay a recorded provider exchange instead of calling the network
const fixture = await loadFixture('openai', 'chat-basic');
const backend = createMockFromFixture(fixture);

const response = await backend.execute(extractRequest(fixture));
assertValidChatResponse(response);
```

A general-purpose mock backend (not fixture-driven) lives in a different package:
`MockBackendAdapter` from `@johnhenry/aimatey-backend-browser/mock`.

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
