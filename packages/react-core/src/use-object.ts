/**
 * useObject Hook
 *
 * React hook for streaming structured objects with streaming support.
 *
 * @module
 */

import { useState, useCallback, useRef } from 'react';
import type { UseObjectOptions, UseObjectReturn } from './types.js';

/**
 * useObject - React hook for streaming structured objects.
 *
 * Provides state management for streaming JSON objects with
 * partial updates as data arrives.
 *
 * @example
 * ```tsx
 * import { useObject } from 'ai.matey.react.core';
 *
 * interface Recipe {
 *   name: string;
 *   ingredients: string[];
 *   instructions: string[];
 * }
 *
 * function RecipeGenerator() {
 *   const { object, submit, isLoading } = useObject<Recipe>({
 *     api: '/api/generate-recipe',
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={() => submit('Generate a pasta recipe')} disabled={isLoading}>
 *         Generate Recipe
 *       </button>
 *       {object && (
 *         <div>
 *           <h2>{object.name}</h2>
 *           <ul>{object.ingredients?.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useObject<T>(options: UseObjectOptions<T> = {}): UseObjectReturn<T> {
  const {
    api = '/api/object',
    schema,
    initialValue,
    headers = {},
    body = {},
    onFinish,
    onError,
  } = options;

  // State
  const [object, setObject] = useState<Partial<T> | undefined>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Refs for abort control
  const abortControllerRef = useRef<AbortController | null>(null);

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
   * Submit a prompt to generate an object.
   */
  const submit = useCallback(
    async (prompt: string): Promise<void> => {
      try {
        setIsLoading(true);
        setError(undefined);
        setObject(undefined);

        // Create abort controller
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Prepare request body
        const requestBody = {
          prompt,
          schema,
          ...body,
        };

        // Make request
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let jsonBuffer = '';

        // Read stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });

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
                if (parsed.object) {
                  // Direct object update
                  setObject(parsed.object as Partial<T>);
                } else if (parsed.partial) {
                  // Partial JSON string
                  jsonBuffer = parsed.partial;
                  try {
                    const partialObject = JSON.parse(jsonBuffer);
                    setObject(partialObject as Partial<T>);
                  } catch {
                    // Incomplete JSON, try to parse what we can
                    const repaired = tryRepairJson(jsonBuffer);
                    if (repaired) {
                      setObject(repaired as Partial<T>);
                    }
                  }
                } else if (parsed.delta) {
                  // Delta update - append to buffer
                  jsonBuffer += parsed.delta;
                  try {
                    const partialObject = JSON.parse(jsonBuffer);
                    setObject(partialObject as Partial<T>);
                  } catch {
                    // Incomplete JSON
                    const repaired = tryRepairJson(jsonBuffer);
                    if (repaired) {
                      setObject(repaired as Partial<T>);
                    }
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        // Try to parse final object
        let finalObject: T | undefined;
        if (jsonBuffer) {
          try {
            finalObject = JSON.parse(jsonBuffer) as T;
            setObject(finalObject as Partial<T>);
          } catch {
            // Keep partial object
          }
        }

        onFinish?.({ object: finalObject, error: undefined });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        onFinish?.({ object: undefined, error });
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [api, body, headers, onError, onFinish, schema]
  );

  return {
    object,
    submit,
    stop,
    isLoading,
    error,
  };
}

/**
 * Try to repair incomplete JSON by closing open brackets.
 */
function tryRepairJson(json: string): unknown | null {
  if (!json.trim()) {
    return null;
  }

  // Count open brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (const char of json) {
    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // Try to close the JSON
  let repaired = json;

  // If we're in a string, close it
  if (inString) {
    repaired += '"';
  }

  // Close brackets and braces
  repaired += ']'.repeat(Math.max(0, openBrackets));
  repaired += '}'.repeat(Math.max(0, openBraces));

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}
