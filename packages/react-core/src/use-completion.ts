/**
 * useCompletion Hook
 *
 * React hook for text completion interfaces with streaming support.
 *
 * @module
 */

import { useState, useCallback, useRef, useId } from 'react';
import type {
  UseCompletionOptions,
  UseCompletionReturn,
  CompletionRequestOptions,
} from './types.js';

/**
 * useCompletion - React hook for text completion.
 *
 * Provides state management and streaming for single-turn
 * text completion tasks.
 *
 * @example
 * ```tsx
 * import { useCompletion } from 'ai.matey.react.core';
 *
 * function CompletionComponent() {
 *   const { completion, input, handleInputChange, handleSubmit, isLoading } = useCompletion({
 *     api: '/api/completion',
 *   });
 *
 *   return (
 *     <div>
 *       <p>{completion}</p>
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} placeholder="Enter a prompt..." />
 *         <button type="submit" disabled={isLoading}>Complete</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompletion(options: UseCompletionOptions = {}): UseCompletionReturn {
  const {
    initialInput = '',
    initialCompletion = '',
    id,
    api = '/api/completion',
    headers = {},
    body = {},
    onFinish,
    onError,
    onResponse,
    streamProtocol = 'data',
  } = options;

  // Generate a stable ID for this completion instance
  const hookId = useId();
  const completionId = id ?? hookId;

  // State
  const [completion, setCompletion] = useState<string>(initialCompletion);
  const [input, setInput] = useState<string>(initialInput);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [data, _setData] = useState<unknown[] | undefined>(undefined);

  // Refs for abort control
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Handle input change from form elements.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput((e.target as HTMLInputElement | HTMLTextAreaElement).value);
    },
    []
  );

  /**
   * Stop current streaming request.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Send a completion request and handle streaming response.
   */
  const complete = useCallback(
    async (
      prompt: string,
      requestOptions?: CompletionRequestOptions
    ): Promise<string | null | undefined> => {
      try {
        setIsLoading(true);
        setError(undefined);
        setCompletion('');

        // Create abort controller
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Prepare request body
        const requestBody = {
          prompt,
          id: completionId,
          ...body,
          ...requestOptions?.body,
        };

        // Make request
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
            ...requestOptions?.headers,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        // Call onResponse callback
        onResponse?.(response);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let completionText = '';

        // Read stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });

          if (streamProtocol === 'data') {
            // Parse SSE data format
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) {
                    completionText += parsed.text;
                  } else if (parsed.choices?.[0]?.text) {
                    completionText += parsed.choices[0].text;
                  } else if (parsed.choices?.[0]?.delta?.content) {
                    completionText += parsed.choices[0].delta.content;
                  }
                } catch {
                  // Ignore parse errors for incomplete JSON
                }
              }
            }
          } else {
            // Raw text protocol
            completionText += chunk;
          }

          // Update completion
          setCompletion(completionText);
        }

        onFinish?.(prompt, completionText);

        return completionText;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, not an error
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        return undefined;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [api, body, completionId, headers, onError, onFinish, onResponse, streamProtocol]
  );

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(
    (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();

      if (!input.trim()) {
        return;
      }

      const prompt = input;
      setInput('');
      complete(prompt);
    },
    [complete, input]
  );

  return {
    completion,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    complete,
    stop,
    setCompletion,
    isLoading,
    error,
    data,
  };
}
