/**
 * AI Matey React Stream
 *
 * React streaming utilities and components.
 *
 * @packageDocumentation
 */

// Context and Provider
export { StreamProvider, useStreamContext, useStreamState } from './stream-context.js';

// Components
export { StreamText, TypeWriter } from './stream-text.js';

// Utilities
export {
  createTextStream,
  parseSSEStream,
  transformStream,
  mergeStreams,
  fromAsyncIterable,
  toAsyncIterable,
} from './stream-utils.js';

// Types
export type { StreamState, StreamContextValue, StreamProviderProps } from './stream-context.js';

export type { StreamTextProps, TypeWriterProps } from './stream-text.js';

export type { CreateTextStreamOptions, SSEEvent } from './stream-utils.js';
