# ai.matey.utils

Shared utility functions for streaming, validation, and conversions.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.utils
```

## Stream Utilities

Comprehensive utilities for working with IR chat streams.

### Basic Stream Operations

```typescript
import {
  collectStream,        // Collect chunks into array
  collectStreamFull,    // Collect with rich metadata
  streamToText,         // Get accumulated text
  streamToResponse,     // Convert to IR response
} from 'ai.matey.utils';

// Collect all chunks
const chunks = await collectStream(stream);

// Collect with full metadata
const result = await collectStreamFull(stream);
console.log(result.content);      // Full text
console.log(result.message);      // IR message
console.log(result.finishReason); // 'stop', 'length', etc.
console.log(result.usage);        // Token counts

// Get just the text
const text = await streamToText(stream);
```

### Processing Streams

```typescript
import { processStream, streamToLines, streamToTextIterator } from 'ai.matey.utils';

// Process with callbacks
const result = await processStream(stream, {
  onStart: (requestId) => console.log('Started:', requestId),
  onContent: (delta, accumulated) => process.stdout.write(delta),
  onDone: (result) => console.log('\nTokens:', result.usage?.totalTokens),
  onError: (error) => console.error('Error:', error),
});

// Iterate over text chunks
for await (const text of streamToTextIterator(stream)) {
  process.stdout.write(text);
}

// Buffer and yield complete lines
for await (const line of streamToLines(stream)) {
  console.log('Line:', line);
}
```

### Transforming Streams

```typescript
import {
  transformStream,
  filterStream,
  mapStream,
  tapStream,
} from 'ai.matey.utils';

// Transform chunks
const transformed = transformStream(stream, (chunk) => ({
  ...chunk,
  delta: chunk.type === 'content' ? chunk.delta.toUpperCase() : chunk.delta,
}));

// Filter chunks
const contentOnly = filterStream(stream, (chunk) => chunk.type === 'content');

// Map chunks
const textOnly = mapStream(stream, (chunk) =>
  chunk.type === 'content' ? chunk.delta : ''
);

// Tap for side effects (logging, etc.)
const logged = tapStream(stream, (chunk) => console.log('Chunk:', chunk.type));
```

### Stream Control

```typescript
import {
  throttleStream,
  rateLimitStream,
  teeStream,
  splitStream,
} from 'ai.matey.utils';

// Throttle updates (batches content chunks)
// Great for limiting UI update frequency
for await (const chunk of throttleStream(stream, 50)) {
  updateUI(chunk); // Max every 50ms
}

// Rate limit (delays chunks to max N/second)
const limited = rateLimitStream(stream, 10); // Max 10 chunks/second

// Split stream for parallel processing
const [stream1, stream2] = teeStream(stream, 2);

await Promise.all([
  processStream(stream1, { onContent: (d) => logger.log(d) }),
  processStream(stream2, { onContent: (d) => ui.append(d) }),
]);
```

### Stream Validation

```typescript
import { validateStream, validateChunkSequence } from 'ai.matey.utils';

// Validate stream structure
const validated = validateStream(stream, {
  requireStart: true,
  requireDone: true,
  requireContent: true,
});

// Check if chunk sequence is valid
const chunks = await collectStream(stream);
const isValid = validateChunkSequence(chunks);
```

### Error Handling

```typescript
import { catchStreamErrors, streamWithTimeout, createStreamError } from 'ai.matey.utils';

// Catch and handle errors
const safe = catchStreamErrors(stream, (error) => {
  console.error('Stream error:', error);
});

// Add timeout
const withTimeout = streamWithTimeout(stream, 30000); // 30s timeout

// Create error chunks
const errorChunk = createStreamError(new Error('Something went wrong'));
```

## Stream Accumulator

Build responses incrementally from chunks:

```typescript
import {
  createStreamAccumulator,
  accumulateChunk,
  accumulatorToMessage,
  accumulatorToResponse,
} from 'ai.matey.utils';

const accumulator = createStreamAccumulator();

for await (const chunk of stream) {
  accumulateChunk(accumulator, chunk);
  console.log('Current text:', accumulator.content);
}

const message = accumulatorToMessage(accumulator);
const response = accumulatorToResponse(accumulator);
```

## Content Utilities

```typescript
import { getContentDeltas, isContentChunk, isDoneChunk, isErrorChunk } from 'ai.matey.utils';

// Get just the text deltas
for await (const delta of getContentDeltas(stream)) {
  process.stdout.write(delta);
}

// Type guards
for await (const chunk of stream) {
  if (isContentChunk(chunk)) {
    console.log('Content:', chunk.delta);
  } else if (isDoneChunk(chunk)) {
    console.log('Done:', chunk.finishReason);
  } else if (isErrorChunk(chunk)) {
    console.error('Error:', chunk.error);
  }
}
```

## Web Stream Conversion

```typescript
import {
  asyncGeneratorToReadableStream,
  readableStreamToAsyncGenerator,
} from 'ai.matey.utils';

// Convert async generator to Web ReadableStream
const readable = asyncGeneratorToReadableStream(stream);

// Convert back to async generator
const generator = readableStreamToAsyncGenerator(readable);
```

## Types

```typescript
import type {
  CollectedStream,      // Rich result from collectStreamFull
  ProcessStreamOptions, // Options for processStream
  StreamValidationOptions,
} from 'ai.matey.utils';
```

## API Reference

### Collection Functions

| Function | Description |
|----------|-------------|
| `collectStream(stream)` | Collect chunks into array |
| `collectStreamFull(stream)` | Collect with rich metadata |
| `streamToText(stream)` | Get accumulated text |
| `streamToResponse(stream)` | Convert to IR response |

### Processing Functions

| Function | Description |
|----------|-------------|
| `processStream(stream, options)` | Process with callbacks |
| `streamToLines(stream)` | Yield complete lines |
| `streamToTextIterator(stream)` | Yield text deltas |
| `getContentDeltas(stream)` | Yield only content |

### Transform Functions

| Function | Description |
|----------|-------------|
| `transformStream(stream, fn)` | Transform each chunk |
| `filterStream(stream, predicate)` | Filter chunks |
| `mapStream(stream, fn)` | Map chunks to new values |
| `tapStream(stream, fn)` | Side effects without modification |

### Control Functions

| Function | Description |
|----------|-------------|
| `throttleStream(stream, ms)` | Batch chunks by time interval |
| `rateLimitStream(stream, rate)` | Limit chunks per second |
| `teeStream(stream, count)` | Split into multiple streams |
| `splitStream(stream, count)` | Split into multiple streams |

### Validation Functions

| Function | Description |
|----------|-------------|
| `validateStream(stream, options)` | Validate stream structure |
| `validateChunkSequence(chunks)` | Check sequence validity |

### Error Functions

| Function | Description |
|----------|-------------|
| `catchStreamErrors(stream, handler)` | Handle errors gracefully |
| `streamWithTimeout(stream, ms)` | Add timeout |
| `createStreamError(error)` | Create error chunk |

## License

MIT - see [LICENSE](./LICENSE) for details.
