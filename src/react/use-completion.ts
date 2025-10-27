/**
 * useCompletion Hook
 *
 * React hook for text completions with streaming support.
 * Compatible with Vercel AI SDK API.
 *
 * @module
 */

import type { UseCompletionOptions, UseCompletionHelpers } from './types.js';
import type { IRChatRequest } from '../types/ir.js';
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Generate unique ID.
 */
function generateId(): string {
  return `completion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// useCompletion Hook
// ============================================================================

/**
 * React hook for text completions.
 *
 * Provides state management and streaming for text generation.
 *
 * **Note:** This hook requires React as an optional peer dependency.
 *
 * Install with:
 * ```bash
 * npm install react react-dom
 * ```
 *
 * @param options Completion configuration
 * @returns Completion helpers and state
 *
 * **Note:** Requires React. Module import will fail if React is not installed.
 *
 * @example
 * ```tsx
 * import { useCompletion } from 'ai.matey/react';
 * import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';
 *
 * function CompletionComponent() {
 *   const backend = createOpenAIBackendAdapter({
 *     apiKey: process.env.OPENAI_API_KEY
 *   });
 *
 *   const {
 *     completion,
 *     input,
 *     handleInputChange,
 *     handleSubmit,
 *     isLoading,
 *   } = useCompletion({
 *     backend,
 *     model: 'gpt-4',
 *   });
 *
 *   return (
 *     <div>
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} />
 *         <button disabled={isLoading}>Generate</button>
 *       </form>
 *       {completion && <div>{completion}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompletion(options: UseCompletionOptions): UseCompletionHelpers {
  const {
    initialInput = '',
    initialCompletion = '',
    backend,
    model = 'gpt-4',
    maxTokens,
    temperature,
    onFinish,
    onError,
    onResponse,
    streaming = true,
  } = options;

  // State
  const [completion, setCompletion] = useState(initialCompletion);
  const [input, setInput] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Mounted flag to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Trigger a completion.
   */
  const complete = useCallback(
    async (prompt: string): Promise<string | null> => {
      if (!prompt.trim() || isLoading) {
        return null;
      }

      // Clear previous error
      setError(undefined);
      setIsLoading(true);
      setCompletion(''); // Clear previous completion

      try {
        // Create abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Build request
        const request: IRChatRequest = {
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          parameters: {
            model,
            ...(maxTokens && { maxTokens }),
            ...(temperature !== undefined && { temperature }),
          },
          stream: streaming,
          metadata: {
            requestId: generateId(),
            timestamp: Date.now(),
            provenance: {},
          },
        };

        if (streaming) {
          // Streaming response
          const stream = backend.executeStream(request);
          let fullContent = '';

          for await (const chunk of stream) {
            // Check if aborted or unmounted
            if (controller.signal.aborted || !isMountedRef.current) {
              break;
            }

            if (chunk.type === 'content' && chunk.delta) {
              fullContent += chunk.delta;

              if (isMountedRef.current) {
                setCompletion(fullContent);
              }

              // Call onResponse
              if (onResponse) {
                onResponse(fullContent);
              }
            }

            if (chunk.type === 'done') {
              // Call onFinish
              if (onFinish) {
                await onFinish(prompt, fullContent);
              }
            }
          }

          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return fullContent;
        } else {
          // Non-streaming response
          const response = await backend.execute(request);
          const result = typeof response.message.content === 'string' ? response.message.content : '';

          if (isMountedRef.current) {
            setCompletion(result);
          }

          if (onResponse) {
            onResponse(result);
          }

          if (onFinish) {
            await onFinish(prompt, result);
          }

          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return result;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (isMountedRef.current) {
          setError(error);
          setIsLoading(false);
        }

        if (onError) {
          onError(error);
        }

        return null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      backend,
      model,
      maxTokens,
      temperature,
      streaming,
      isLoading,
      onFinish,
      onError,
      onResponse,
    ]
  );

  /**
   * Handle input change event.
   */
  const handleInputChange = useCallback(
    (event: { target: { value: string } }) => {
      setInput(event.target.value);
    },
    []
  );

  /**
   * Handle form submit event.
   */
  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();

      if (!input.trim()) {
        return;
      }

      await complete(input);
    },
    [input, complete]
  );

  /**
   * Stop the current stream.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  return {
    completion,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    complete,
    setCompletion,
    stop,
    isLoading,
    error,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if React is available.
 *
 * Since React is imported at module load time, this function will only
 * be callable if React is installed. It always returns true.
 *
 * @returns Promise that resolves to true
 *
 * @example
 * ```typescript
 * import { isReactAvailable } from 'ai.matey/react';
 *
 * if (await isReactAvailable()) {
 *   // Use React hooks
 * }
 * ```
 */
export async function isReactAvailable(): Promise<boolean> {
  // If this module loaded, React is available
  return true;
}
