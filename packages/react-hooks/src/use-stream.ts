/**
 * useStream Hook
 *
 * React hook for generic text streaming with state management.
 *
 * @module
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Stream hook options.
 */
export interface UseStreamOptions {
  /** Called for each chunk */
  onChunk?: (chunk: string) => void;
  /** Called when stream completes */
  onComplete?: (fullText: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Initial text value */
  initialText?: string;
}

/**
 * Stream hook return value.
 */
export interface UseStreamReturn {
  /** Current streamed text */
  text: string;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Error if any */
  error: Error | undefined;
  /** Start streaming from a response */
  startStream: (response: Response) => Promise<string>;
  /** Start streaming from a ReadableStream */
  startReadableStream: (stream: ReadableStream<Uint8Array>) => Promise<string>;
  /** Start streaming from an async iterable */
  startAsyncIterable: (iterable: AsyncIterable<string>) => Promise<string>;
  /** Stop streaming */
  stop: () => void;
  /** Reset state */
  reset: () => void;
  /** Manually set text */
  setText: (text: string) => void;
}

/**
 * useStream - React hook for generic text streaming.
 *
 * Provides state management for streaming text from various sources
 * including fetch responses, ReadableStreams, and async iterables.
 *
 * @example
 * ```tsx
 * import { useStream } from 'ai.matey.react.hooks';
 *
 * function StreamingComponent() {
 *   const { text, isStreaming, startStream, stop } = useStream({
 *     onComplete: (fullText) => console.log('Completed:', fullText),
 *   });
 *
 *   const handleClick = async () => {
 *     const response = await fetch('/api/stream');
 *     await startStream(response);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleClick} disabled={isStreaming}>Start</button>
 *       <button onClick={stop} disabled={!isStreaming}>Stop</button>
 *       <pre>{text}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStream(options: UseStreamOptions = {}): UseStreamReturn {
  const { onChunk, onComplete, onError, initialText = '' } = options;

  // State
  const [text, setText] = useState<string>(initialText);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const textRef = useRef<string>(initialText);

  /**
   * Stop streaming.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /**
   * Reset state.
   */
  const reset = useCallback(() => {
    stop();
    setText(initialText);
    textRef.current = initialText;
    setError(undefined);
  }, [initialText, stop]);

  /**
   * Start streaming from a fetch Response.
   */
  const startStream = useCallback(async (response: Response): Promise<string> => {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    return startReadableStream(response.body);
  }, []);

  /**
   * Start streaming from a ReadableStream.
   */
  const startReadableStream = useCallback(
    async (stream: ReadableStream<Uint8Array>): Promise<string> => {
      try {
        setIsStreaming(true);
        setError(undefined);
        setText('');
        textRef.current = '';

        // Create abort controller
        abortControllerRef.current = new AbortController();

        const reader = stream.getReader();
        const decoder = new TextDecoder();

        while (true) {
          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          textRef.current += chunk;
          setText(textRef.current);
          onChunk?.(chunk);
        }

        onComplete?.(textRef.current);
        return textRef.current;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return textRef.current;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [onChunk, onComplete, onError]
  );

  /**
   * Start streaming from an async iterable.
   */
  const startAsyncIterable = useCallback(
    async (iterable: AsyncIterable<string>): Promise<string> => {
      try {
        setIsStreaming(true);
        setError(undefined);
        setText('');
        textRef.current = '';

        // Create abort controller
        abortControllerRef.current = new AbortController();

        for await (const chunk of iterable) {
          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          textRef.current += chunk;
          setText(textRef.current);
          onChunk?.(chunk);
        }

        onComplete?.(textRef.current);
        return textRef.current;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return textRef.current;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [onChunk, onComplete, onError]
  );

  return {
    text,
    isStreaming,
    error,
    startStream,
    startReadableStream,
    startAsyncIterable,
    stop,
    reset,
    setText,
  };
}
