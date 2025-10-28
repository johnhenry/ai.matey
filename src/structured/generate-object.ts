/**
 * Generate Object
 *
 * Core implementation of structured output with Zod validation.
 *
 * @module
 */

import type {
  GenerateObjectOptions,
  GenerateObjectResult,
  ExtractionMode,
} from './types.js';
import type { IRChatRequest, IRChatResponse, IRTool } from '../types/ir.js';
import { convertZodToJsonSchema, isZodSchema } from './schema-converter.js';
import { parsePartialJSON, deepMerge, extractMarkdownJSON } from './json-parser.js';

/**
 * Generate unique ID for requests.
 */
function generateId(): string {
  return `structured-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract tool call arguments from response.
 */
function extractToolArguments(response: IRChatResponse, toolName: string): string {
  // Check if response has tool use content
  const content = response.message.content;

  if (Array.isArray(content)) {
    // Look for tool_use content type
    for (const block of content) {
      if (
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'tool_use' &&
        'name' in block &&
        block.name === toolName &&
        'input' in block
      ) {
        return typeof block.input === 'string'
          ? block.input
          : JSON.stringify(block.input);
      }
    }
  }

  // Fallback: try to parse entire content as JSON
  if (typeof content === 'string') {
    return content;
  }

  return JSON.stringify(content);
}

// ============================================================================
// Generate Object (Non-Streaming)
// ============================================================================

/**
 * Generate a structured object from LLM with Zod validation.
 *
 * Uses function/tool calling or JSON mode to extract validated data
 * from the model's response.
 *
 * This is the standalone function that works directly with backend adapters.
 * For integration with Bridge and routing, use bridge.generateObject().
 *
 * @param options Generation options with Zod schema
 * @returns Promise resolving to validated object
 * @throws Error if generation or validation fails
 *
 * @example
 * ```typescript
 * import { generateObject } from 'ai.matey/structured'
 * import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend'
 * import { z } from 'zod'
 *
 * const backend = createOpenAIBackendAdapter({ apiKey: '...' })
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number()
 * })
 *
 * const result = await generateObject({
 *   backend,
 *   schema,
 *   messages: [{ role: 'user', content: 'John is 30' }],
 *   mode: 'tools'
 * })
 *
 * console.log(result.data.name) // Typed as string!
 * ```
 */
export async function generateObject<T = any>(
  options: GenerateObjectOptions<T>
): Promise<GenerateObjectResult<T>> {
  const {
    backend,
    schema,
    messages,
    model,
    mode = 'tools',
    name = 'extract',
    description,
    temperature = 0.0, // Lower temperature for more deterministic extraction
    maxTokens,
    onFinish,
    onError,
    signal,
  } = options;

  const startTime = Date.now();

  try {
    // Validate schema is a Zod schema
    if (!isZodSchema(schema)) {
      throw new Error(
        'Invalid schema: expected Zod schema with .parse() and .safeParse() methods.\n' +
        'Make sure you are passing a Zod schema instance (e.g., z.object({...}))'
      );
    }

    // Convert Zod schema to JSON Schema
    const jsonSchema = convertZodToJsonSchema(schema);

    // Build request based on mode
    const request = buildRequest({
      messages,
      jsonSchema,
      mode,
      name,
      description,
      model,
      temperature,
      maxTokens,
    });

    // Execute request
    const response = await backend.execute(request, signal);

    // Extract JSON content based on mode
    let jsonContent: string;

    if (mode === 'tools') {
      // Extract from tool call arguments
      jsonContent = extractToolArguments(response, name);
    } else if (mode === 'md_json') {
      // Extract from markdown code block
      const content = typeof response.message.content === 'string'
        ? response.message.content
        : JSON.stringify(response.message.content);
      jsonContent = extractMarkdownJSON(content);
    } else {
      // Direct JSON content (json or json_schema modes)
      jsonContent = typeof response.message.content === 'string'
        ? response.message.content
        : JSON.stringify(response.message.content);
    }

    // Validate we got content
    if (!jsonContent || !jsonContent.trim()) {
      const err = new Error(
        'No JSON content received from model. The model may not have generated valid output.\n' +
        `Mode: ${mode}, Finish reason: ${response.finishReason}`
      );
      if (onError) {
        onError(err);
      }
      throw err;
    }

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      const err = new Error(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}\n` +
        `Raw content: ${jsonContent.substring(0, 200)}${jsonContent.length > 200 ? '...' : ''}`
      );
      if (onError) {
        onError(err);
      }
      throw err;
    }

    // Validate with Zod schema
    let validated: T;
    const warnings: string[] = [];

    try {
      validated = schema.parse(parsed) as T;
    } catch (validationError: any) {
      // Collect validation errors
      if (validationError.errors) {
        for (const error of validationError.errors) {
          warnings.push(
            `Validation error at ${error.path.join('.')}: ${error.message}`
          );
        }
      }

      const err = new Error(
        `Schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}\n` +
        `Parsed data: ${JSON.stringify(parsed, null, 2)}`
      );

      if (onError) {
        onError(err);
      }
      throw err;
    }

    // Call onFinish callback
    if (onFinish) {
      await onFinish(validated);
    }

    // Build result
    const result: GenerateObjectResult<T> = {
      data: validated,
      raw: jsonContent,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        model: model || (response.metadata.custom?.model as string) || 'unknown',
        finishReason: response.finishReason,
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        } : undefined,
        responseId: response.metadata.providerResponseId,
        latencyMs: Date.now() - startTime,
      },
    };

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (onError) {
      onError(err);
    }

    throw err;
  }
}

// ============================================================================
// Generate Object (Streaming)
// ============================================================================

/**
 * Generate a structured object with streaming and partial validation.
 *
 * Returns an async generator that yields progressively more complete
 * partial objects as the model generates the response.
 *
 * The final yield is the fully validated object.
 *
 * @param options Generation options with Zod schema
 * @returns Async generator yielding partial objects, final value is complete object
 *
 * @example
 * ```typescript
 * const stream = generateObjectStream({
 *   backend,
 *   schema: RecipeSchema,
 *   messages: [{ role: 'user', content: 'Recipe for cookies' }],
 *   onPartial: (partial) => {
 *     console.log('Progress:', partial)
 *   }
 * })
 *
 * for await (const partial of stream) {
 *   updateUI(partial) // Update UI with progressive data
 * }
 * ```
 */
export async function* generateObjectStream<T = any>(
  options: GenerateObjectOptions<T>
): AsyncGenerator<Partial<T>, T, undefined> {
  const {
    backend,
    schema,
    messages,
    model,
    mode = 'tools',
    name = 'extract',
    description,
    temperature = 0.0,
    maxTokens,
    onPartial,
    onFinish,
    onError,
    signal,
  } = options;

  try {
    // Validate schema is a Zod schema
    if (!isZodSchema(schema)) {
      throw new Error(
        'Invalid schema: expected Zod schema with .parse() and .safeParse() methods.\n' +
        'Make sure you are passing a Zod schema instance (e.g., z.object({...}))'
      );
    }

    // Convert Zod schema to JSON Schema
    const jsonSchema = convertZodToJsonSchema(schema);

    // Build streaming request
    const request = buildRequest({
      messages,
      jsonSchema,
      mode,
      name,
      description,
      model,
      temperature,
      maxTokens,
      stream: true,
    });

    // Execute streaming request
    const stream = backend.executeStream(request, signal);

    let fullContent = '';
    let lastParsedObject: any = undefined;

    for await (const chunk of stream) {
      // Handle abort signal
      if (signal?.aborted) {
        break;
      }

      if (chunk.type === 'content' && chunk.delta) {
        fullContent += chunk.delta;

        // Try to parse partial JSON
        const parsed = parsePartialJSON(fullContent);

        if (parsed !== null) {
          // Merge with previous object for progressive updates
          lastParsedObject = lastParsedObject
            ? deepMerge(lastParsedObject, parsed)
            : parsed;

          // Try partial validation (schema.partial() if available)
          let partialObject: Partial<T> = lastParsedObject;

          try {
            // If schema has partial() method, use it for lenient validation
            if (typeof schema.partial === 'function') {
              const partialSchema = schema.partial();
              partialObject = partialSchema.parse(lastParsedObject);
            }
          } catch {
            // Partial validation failed, use unvalidated object
          }

          // Yield partial object
          yield partialObject;

          // Call onPartial callback
          if (onPartial) {
            onPartial(partialObject);
          }
        }
      }

      if (chunk.type === 'done') {
        // Final validation with full schema
        let finalObject: T;

        try {
          finalObject = schema.parse(lastParsedObject) as T;
        } catch (validationError) {
          const err = new Error(
            `Final schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`
          );

          if (onError) {
            onError(err);
          }

          throw err;
        }

        // Call onFinish callback
        if (onFinish) {
          await onFinish(finalObject);
        }

        return finalObject;
      }

      if (chunk.type === 'error') {
        const err = new Error(
          `Stream error: ${chunk.error.message}`
        );

        if (onError) {
          onError(err);
        }

        throw err;
      }
    }

    // Stream ended without done chunk - validate what we have
    if (lastParsedObject) {
      const finalObject = schema.parse(lastParsedObject) as T;

      if (onFinish) {
        await onFinish(finalObject);
      }

      return finalObject;
    }

    throw new Error(
      'Stream ended without generating valid object.\n' +
      `Received content: ${fullContent.substring(0, 100)}${fullContent.length > 100 ? '...' : ''}\n` +
      `Content length: ${fullContent.length} characters`
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (onError) {
      onError(err);
    }

    throw err;
  }
}

// ============================================================================
// Request Builder
// ============================================================================

interface BuildRequestOptions {
  messages: readonly any[];
  jsonSchema: any;
  mode: ExtractionMode;
  name: string;
  description?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

function buildRequest(options: BuildRequestOptions): IRChatRequest {
  const {
    messages,
    jsonSchema,
    mode,
    name,
    description,
    model,
    temperature,
    maxTokens,
    stream = false,
  } = options;

  const baseRequest: IRChatRequest = {
    messages,
    parameters: {
      model,
      temperature,
      maxTokens,
    },
    stream,
    metadata: {
      requestId: generateId(),
      timestamp: Date.now(),
      provenance: {},
    },
    // Add schema to IR for backends that support it (like Mock)
    schema: {
      type: 'json-schema',
      schema: jsonSchema,
      mode,
      name,
      description,
    },
  };

  if (mode === 'tools') {
    // Use function/tool calling
    const tool: IRTool = {
      name,
      description: description || `Extract structured data matching the ${name} schema`,
      parameters: jsonSchema,
    };

    return {
      ...baseRequest,
      tools: [tool],
      toolChoice: { name }, // Force tool use
    };
  } else if (mode === 'json' || mode === 'json_schema') {
    // Use JSON mode
    // Add system message with schema
    const systemMessage = {
      role: 'system' as const,
      content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
    };

    return {
      ...baseRequest,
      messages: [systemMessage, ...messages],
      parameters: {
        ...baseRequest.parameters,
        // Provider-specific JSON mode via custom parameters
        custom: {
          response_format: mode === 'json_schema'
            ? { type: 'json_schema', json_schema: { name, schema: jsonSchema } }
            : { type: 'json_object' },
        },
      },
    };
  } else {
    // md_json mode - extract from markdown
    const systemMessage = {
      role: 'system' as const,
      content: `Respond with JSON in a markdown code block:\n\`\`\`json\n...\n\`\`\`\n\nThe JSON must match this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
    };

    return {
      ...baseRequest,
      messages: [systemMessage, ...messages],
    };
  }
}
