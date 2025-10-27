/**
 * useObject Hook
 *
 * React hook for streaming structured objects with schema validation.
 * Compatible with Vercel AI SDK API.
 *
 * @module
 */

import type { UseObjectOptions, UseObjectHelpers } from './types.js';
import type { IRChatRequest } from '../types/ir.js';
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Generate unique ID.
 */
function generateId(): string {
  return `object-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Progressive JSON Parsing
// ============================================================================

/**
 * Parse potentially incomplete JSON during streaming.
 *
 * Handles partial JSON by attempting to close open structures.
 * Returns null if JSON cannot be parsed even with fixes.
 */
function parsePartialJSON(jsonStr: string): any {
  if (!jsonStr.trim()) {
    return null;
  }

  try {
    // First try parsing as-is
    return JSON.parse(jsonStr);
  } catch {
    // Try to fix incomplete JSON
    let fixed = jsonStr.trim();

    // Count open/close brackets and braces
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;

    // Add missing closing characters
    fixed += '}]'.repeat(Math.max(0, openBraces - closeBraces));
    fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));

    try {
      return JSON.parse(fixed);
    } catch {
      // If still can't parse, return null
      return null;
    }
  }
}

/**
 * Deep merge two objects, preferring values from source.
 */
function deepMerge(target: any, source: any): any {
  if (typeof source !== 'object' || source === null) {
    return source;
  }

  if (Array.isArray(source)) {
    return source;
  }

  const result = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

// ============================================================================
// useObject Hook
// ============================================================================

/**
 * React hook for streaming structured objects.
 *
 * Generates and streams structured data validated against a schema.
 * Progressively updates the object as JSON is generated.
 *
 * **Note:** This hook requires React and optionally Zod as peer dependencies.
 *
 * Install with:
 * ```bash
 * npm install react react-dom
 * npm install zod  # Optional, for schema validation
 * ```
 *
 * @param options Object generation configuration
 * @returns Object helpers and state
 *
 * **Note:** Requires React. Module import will fail if React is not installed.
 *
 * @example
 * ```tsx
 * import { useObject } from 'ai.matey/react';
 * import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';
 * import { z } from 'zod';
 *
 * function RecipeGenerator() {
 *   const backend = createOpenAIBackendAdapter({
 *     apiKey: process.env.OPENAI_API_KEY
 *   });
 *
 *   const schema = z.object({
 *     name: z.string(),
 *     ingredients: z.array(z.string()),
 *     steps: z.array(z.string()),
 *     cookingTime: z.number(),
 *   });
 *
 *   const {
 *     object,
 *     submit,
 *     isLoading,
 *     error,
 *   } = useObject({
 *     backend,
 *     model: 'gpt-4',
 *     schema,
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={() => submit('chocolate chip cookies')}>
 *         Generate Recipe
 *       </button>
 *       {object && (
 *         <div>
 *           <h2>{object.name}</h2>
 *           <h3>Ingredients:</h3>
 *           <ul>
 *             {object.ingredients?.map((i, idx) => <li key={idx}>{i}</li>)}
 *           </ul>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useObject<T = any>(options: UseObjectOptions<T>): UseObjectHelpers<T> {
  const {
    backend,
    model = 'gpt-4',
    schema,
    maxTokens,
    temperature,
    onFinish,
    onError,
    streaming = true,
  } = options;

  // State
  const [object, setObject] = useState<T | undefined>(undefined);
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
   * Submit a prompt to generate an object.
   */
  const submit = useCallback(
    async (prompt: string): Promise<T | null> => {
      if (!prompt.trim() || isLoading) {
        return null;
      }

      // Clear previous error and object
      setError(undefined);
      setIsLoading(true);
      setObject(undefined);

      try {
        // Create abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Build system prompt for JSON generation
        const systemPrompt = schema
          ? `You are a helpful assistant that generates structured JSON data.
Generate valid JSON that matches this structure. Only output JSON, no additional text.

Expected structure:
${JSON.stringify(getSchemaExample(schema), null, 2)}`
          : 'You are a helpful assistant that generates structured JSON data. Only output valid JSON, no additional text.';

        // Build request
        const request: IRChatRequest = {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
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
          let lastParsedObject: any = undefined;

          for await (const chunk of stream) {
            // Check if aborted or unmounted
            if (controller.signal.aborted || !isMountedRef.current) {
              break;
            }

            if (chunk.type === 'content' && chunk.delta) {
              fullContent += chunk.delta;

              // Try to parse partial JSON
              const parsed = parsePartialJSON(fullContent);
              if (parsed !== null && isMountedRef.current) {
                // Merge with previous object to handle progressive updates
                lastParsedObject = lastParsedObject
                  ? deepMerge(lastParsedObject, parsed)
                  : parsed;

                // Validate with schema if provided
                if (schema) {
                  try {
                    const validated = (schema as any).parse(lastParsedObject);
                    setObject(validated as T);
                  } catch {
                    // Validation failed, use unvalidated (partial) object
                    setObject(lastParsedObject as T);
                  }
                } else {
                  setObject(lastParsedObject as T);
                }
              }
            }

            if (chunk.type === 'done') {
              // Final validation
              let finalObject = lastParsedObject;

              if (schema && finalObject) {
                try {
                  finalObject = (schema as any).parse(finalObject);
                } catch (validationError) {
                  const err = new Error(
                    `Schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`
                  );
                  if (isMountedRef.current) {
                    setError(err);
                    setIsLoading(false);
                  }
                  if (onError) {
                    onError(err);
                  }
                  return null;
                }
              }

              if (isMountedRef.current) {
                setObject(finalObject as T);
              }

              // Call onFinish
              if (onFinish && finalObject) {
                await onFinish(finalObject as T);
              }
            }
          }

          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return lastParsedObject as T;
        } else {
          // Non-streaming response
          const response = await backend.execute(request);

          // Parse JSON response
          let parsedObject: any;
          try {
            const content = typeof response.message.content === 'string' ? response.message.content : '';
            parsedObject = JSON.parse(content);
          } catch (parseError) {
            const err = new Error(
              `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
            if (isMountedRef.current) {
              setError(err);
              setIsLoading(false);
            }
            if (onError) {
              onError(err);
            }
            return null;
          }

          // Validate with schema
          if (schema) {
            try {
              parsedObject = (schema as any).parse(parsedObject);
            } catch (validationError) {
              const err = new Error(
                `Schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`
              );
              if (isMountedRef.current) {
                setError(err);
                setIsLoading(false);
              }
              if (onError) {
                onError(err);
              }
              return null;
            }
          }

          if (isMountedRef.current) {
            setObject(parsedObject as T);
          }

          if (onFinish) {
            await onFinish(parsedObject as T);
          }

          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return parsedObject as T;
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
      schema,
      maxTokens,
      temperature,
      streaming,
      isLoading,
      onFinish,
      onError,
    ]
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
    object,
    submit,
    setObject,
    stop,
    isLoading,
    error,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate example structure from Zod schema.
 * This is a simplified version - real implementation would need full Zod parsing.
 */
function getSchemaExample(schema: any): any {
  // If schema has a .describe() method, use it
  if (typeof schema?.describe === 'function') {
    const description = schema.describe();
    return generateExampleFromDescription(description);
  }

  // Fallback: return placeholder
  return {
    // Schema structure will be inferred
  };
}

/**
 * Generate example from Zod schema description.
 */
function generateExampleFromDescription(description: any): any {
  if (!description) return {};

  // Handle object schemas
  if (description.typeName === 'ZodObject' && description.shape) {
    const example: any = {};
    for (const [key, value] of Object.entries(description.shape)) {
      example[key] = generateExampleFromDescription(value);
    }
    return example;
  }

  // Handle array schemas
  if (description.typeName === 'ZodArray') {
    return [];
  }

  // Handle primitive types
  switch (description.typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 0;
    case 'ZodBoolean':
      return false;
    case 'ZodNull':
      return null;
    default:
      return null;
  }
}

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
