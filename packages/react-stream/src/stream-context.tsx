/**
 * Stream Context and Provider
 *
 * React context for sharing streaming state across components.
 *
 * @module
 */

import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from 'react';

/**
 * Stream state for a single stream.
 */
export interface StreamState {
  /** Stream ID */
  id: string;
  /** Current text content */
  text: string;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Error if any */
  error: Error | undefined;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Stream context value.
 */
export interface StreamContextValue {
  /** All active streams */
  streams: Map<string, StreamState>;
  /** Get a specific stream */
  getStream: (id: string) => StreamState | undefined;
  /** Start a new stream */
  startStream: (id: string, metadata?: Record<string, unknown>) => void;
  /** Update stream text */
  updateStream: (id: string, text: string) => void;
  /** Append to stream text */
  appendToStream: (id: string, chunk: string) => void;
  /** Complete a stream */
  completeStream: (id: string) => void;
  /** Set stream error */
  setStreamError: (id: string, error: Error) => void;
  /** Remove a stream */
  removeStream: (id: string) => void;
  /** Clear all streams */
  clearAllStreams: () => void;
}

/**
 * Stream context.
 */
const StreamContext = createContext<StreamContextValue | null>(null);

/**
 * Stream provider props.
 */
export interface StreamProviderProps {
  /** Children to render */
  children: ReactNode;
  /** Maximum number of streams to keep */
  maxStreams?: number;
}

/**
 * StreamProvider - Context provider for managing multiple streams.
 *
 * Provides centralized stream state management across components.
 *
 * @example
 * ```tsx
 * import { StreamProvider, useStreamContext } from 'ai.matey.react.stream';
 *
 * function App() {
 *   return (
 *     <StreamProvider maxStreams={10}>
 *       <ChatComponent />
 *     </StreamProvider>
 *   );
 * }
 *
 * function ChatComponent() {
 *   const { startStream, appendToStream, completeStream } = useStreamContext();
 *
 *   const handleNewMessage = async () => {
 *     const streamId = 'message-1';
 *     startStream(streamId);
 *     // ... fetch and stream
 *     for await (const chunk of response) {
 *       appendToStream(streamId, chunk);
 *     }
 *     completeStream(streamId);
 *   };
 *
 *   return <button onClick={handleNewMessage}>Send</button>;
 * }
 * ```
 */
export function StreamProvider({ children, maxStreams = 100 }: StreamProviderProps) {
  const [streams, setStreams] = useState<Map<string, StreamState>>(new Map());
  const streamsRef = useRef<Map<string, StreamState>>(streams);

  // Keep ref in sync
  streamsRef.current = streams;

  /**
   * Get a specific stream.
   */
  const getStream = useCallback((id: string): StreamState | undefined => {
    return streamsRef.current.get(id);
  }, []);

  /**
   * Start a new stream.
   */
  const startStream = useCallback(
    (id: string, metadata?: Record<string, unknown>) => {
      setStreams((prev) => {
        const newMap = new Map(prev);

        // Enforce max streams limit
        if (newMap.size >= maxStreams && !newMap.has(id)) {
          // Remove oldest completed stream
          for (const [streamId, state] of newMap) {
            if (!state.isStreaming) {
              newMap.delete(streamId);
              break;
            }
          }
        }

        newMap.set(id, {
          id,
          text: '',
          isStreaming: true,
          error: undefined,
          metadata,
        });

        return newMap;
      });
    },
    [maxStreams]
  );

  /**
   * Update stream text (replace).
   */
  const updateStream = useCallback((id: string, text: string) => {
    setStreams((prev) => {
      const state = prev.get(id);
      if (!state) return prev;

      const newMap = new Map(prev);
      newMap.set(id, { ...state, text });
      return newMap;
    });
  }, []);

  /**
   * Append to stream text.
   */
  const appendToStream = useCallback((id: string, chunk: string) => {
    setStreams((prev) => {
      const state = prev.get(id);
      if (!state) return prev;

      const newMap = new Map(prev);
      newMap.set(id, { ...state, text: state.text + chunk });
      return newMap;
    });
  }, []);

  /**
   * Complete a stream.
   */
  const completeStream = useCallback((id: string) => {
    setStreams((prev) => {
      const state = prev.get(id);
      if (!state) return prev;

      const newMap = new Map(prev);
      newMap.set(id, { ...state, isStreaming: false });
      return newMap;
    });
  }, []);

  /**
   * Set stream error.
   */
  const setStreamError = useCallback((id: string, error: Error) => {
    setStreams((prev) => {
      const state = prev.get(id);
      if (!state) return prev;

      const newMap = new Map(prev);
      newMap.set(id, { ...state, isStreaming: false, error });
      return newMap;
    });
  }, []);

  /**
   * Remove a stream.
   */
  const removeStream = useCallback((id: string) => {
    setStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  /**
   * Clear all streams.
   */
  const clearAllStreams = useCallback(() => {
    setStreams(new Map());
  }, []);

  const value: StreamContextValue = {
    streams,
    getStream,
    startStream,
    updateStream,
    appendToStream,
    completeStream,
    setStreamError,
    removeStream,
    clearAllStreams,
  };

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}

/**
 * useStreamContext - Access the stream context.
 *
 * @throws {Error} If used outside of StreamProvider
 */
export function useStreamContext(): StreamContextValue {
  const context = useContext(StreamContext);

  if (!context) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }

  return context;
}

/**
 * useStreamState - Get state for a specific stream.
 *
 * @param id - Stream ID
 * @returns Stream state or undefined
 */
export function useStreamState(id: string): StreamState | undefined {
  const { streams } = useStreamContext();
  return streams.get(id);
}
