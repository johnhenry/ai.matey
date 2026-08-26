/**
 * Structured Output with Zod
 *
 * This module provides utilities for working with Zod schemas for structured LLM outputs.
 * It includes:
 * - Schema to tool definition conversion
 * - Runtime validation
 * - Type-safe object generation
 * - Streaming with partial objects
 *
 * **IMPORTANT**: This module requires the optional peer dependency `zod` to be installed.
 * Install it with: `npm install zod`
 */

import type { z } from 'zod';
import type { IRChatRequest, IRChatResponse, IRChatStream, IRTool } from '@johnhenry/aimatey-types';
import { extractToolCalls } from './tools.js';

// ============================================================================
// Zod Availability Check
// ============================================================================

let zodModule: typeof z | null = null;

/**
 * Lazily load Zod module
 * @throws Error if Zod is not installed
 */
function getZod(): typeof z {
  if (zodModule) {
    return zodModule;
  }

  try {
    // Dynamic import for optional dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('zod').z;
    zodModule = loaded;
    return loaded;
  } catch {
    throw new Error(
      'Zod is required for structured output features but is not installed. ' +
        'Install it with: npm install zod\n' +
        'See: https://github.com/johnhenry/ai.matey#structured-output'
    );
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * OpenAI-compatible tool definition format
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

/**
 * JSON Schema representation (subset used for tool definitions)
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  enum?: string[];
  required?: string[];
  description?: string;
}

/**
 * PII match information
 */
export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
}

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  detected: boolean;
  matches: PIIMatch[];
}

/**
 * PII pattern configuration
 */
export interface PIIPattern {
  type: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Validation result
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; errors: any[] }; // Using any[] to avoid importing z.ZodIssue

// ============================================================================
// Schema to Tool Definition Converter
// ============================================================================

/**
 * Convert a Zod schema to an OpenAI tool definition
 *
 * @param schema - Zod schema to convert
 * @param name - Function name for the tool
 * @param description - Description of what the tool does
 * @returns OpenAI-compatible tool definition
 */
export function schemaToToolDefinition(
  schema: any, // Using any to avoid importing z.ZodType
  name: string = 'extract_data',
  description: string = 'Extract structured data from the input'
): ToolDefinition {
  // Ensure Zod is available
  getZod();

  const jsonSchema = zodToJsonSchema(schema);

  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: jsonSchema,
    },
  };
}

/**
 * Convert a Zod schema to JSON Schema format
 */
function zodToJsonSchema(schema: any): JSONSchema {
  // Get the Zod internal definition
  const def = schema._def;

  // Zod v3+ uses _def.typeName, fallback to constructor name
  const typeName = def.typeName || schema.constructor.name;

  // Handle ZodObject
  if (typeName === 'ZodObject') {
    // In Zod v3, shape is accessed from the schema object itself, not from _def
    const shape = schema.shape || def.shape || {};
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType;
      const fieldDef = (fieldSchema as any)._def;

      // Check if field is optional BEFORE converting
      const isOptional =
        fieldDef.typeName === 'ZodOptional' || fieldSchema.constructor.name === 'ZodOptional';

      properties[key] = zodToJsonSchema(fieldSchema);

      // Only add to required if not optional
      if (!isOptional) {
        required.push(key);
      }
    }

    const result: JSONSchema = {
      type: 'object',
      properties,
    };

    // Only add required if there are required fields
    if (required.length > 0) {
      result.required = required;
    }

    return result;
  }

  // Handle ZodOptional
  if (typeName === 'ZodOptional') {
    const innerSchema = def.innerType;
    return zodToJsonSchema(innerSchema);
  }

  // Handle ZodString
  if (typeName === 'ZodString') {
    const result: JSONSchema = { type: 'string' };
    // Description is stored on the schema object itself
    const description = schema.description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodNumber
  if (typeName === 'ZodNumber') {
    const result: JSONSchema = { type: 'number' };
    const description = schema.description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodBoolean
  if (typeName === 'ZodBoolean') {
    const result: JSONSchema = { type: 'boolean' };
    const description = schema.description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodArray
  if (typeName === 'ZodArray') {
    // Array items are stored in _def.element (not .type)
    const itemSchema = def.element || def.type;
    const result: JSONSchema = {
      type: 'array',
      items: zodToJsonSchema(itemSchema),
    };
    const description = schema.description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodEnum
  if (typeName === 'ZodEnum') {
    // In Zod v3+, enum values are stored in _def.entries as an object or _def.values as an array
    let enumValues: string[] = [];

    if (def.entries) {
      // _def.entries is an object like { "active": "active", "inactive": "inactive" }
      enumValues = Object.values(def.entries);
    } else if (def.values) {
      enumValues = Array.isArray(def.values) ? def.values : Object.values(def.values);
    } else if (def.options) {
      enumValues = Array.isArray(def.options) ? def.options : Object.values(def.options);
    }

    const result: JSONSchema = {
      type: 'string',
      enum: enumValues,
    };
    const description = schema.description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Default fallback
  return { type: 'string' };
}

// ============================================================================
// Runtime Validation
// ============================================================================

/**
 * Validate data against a Zod schema
 *
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @returns Validation result with typed data or errors
 */
export function validateWithSchema<T = any>(data: unknown, schema: any): ValidationResult<T> {
  // Ensure Zod is available
  getZod();

  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.issues,
  };
}

// ============================================================================
// PII Detection and Redaction (from validation-middleware)
// ============================================================================

/**
 * Default PII patterns for detection
 */
export const DEFAULT_PII_PATTERNS: PIIPattern[] = [
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    type: 'phone',
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED_SSN]',
  },
  {
    type: 'creditCard',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: '[REDACTED_CREDIT_CARD]',
  },
];

/**
 * Default prompt injection patterns
 */
export const DEFAULT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+previous/i,
  /system:\s*new\s+instruction/i,
  /forget\s+everything/i,
  /disregard\s+all/i,
];

/**
 * Detect PII in text
 */
export function detectPII(
  text: string,
  patterns: PIIPattern[] = DEFAULT_PII_PATTERNS
): PIIDetectionResult {
  const matches: PIIMatch[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.pattern);
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: pattern.type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return {
    detected: matches.length > 0,
    matches,
  };
}

/**
 * Redact PII from text
 */
export function redactPII(text: string, patterns: PIIPattern[] = DEFAULT_PII_PATTERNS): string {
  let result = text;

  for (const pattern of patterns) {
    result = result.replace(pattern.pattern, pattern.replacement);
  }

  return result;
}

/**
 * Detect prompt injection attempts
 */
export function detectPromptInjection(
  text: string,
  patterns: RegExp[] = DEFAULT_INJECTION_PATTERNS
): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitize text by removing control characters
 */
export function sanitizeText(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
  );
}

// ============================================================================
// Object Generation (generateObject and streamObject)
// ============================================================================

/**
 * Minimal Bridge surface needed by generateObject/streamObject.
 *
 * Uses `executeIR`/`executeIRStream` (IR in, IR out) rather than the
 * frontend-native `chat()`/`chatStream()` methods, so the forced tool call
 * this module builds is expressed once in the universal IR shape
 * (`tools`/`toolChoice`/`ToolUseContent`) and each backend adapter's own
 * `fromIR`/`toIR` handles translating it to and from that provider's actual
 * wire format (OpenAI's `tool_choice: { type: 'function', ... }`,
 * Anthropic's `tool_choice: { type: 'tool', ... }`, etc). This keeps
 * generateObject/streamObject correct for any backend, not just Anthropic.
 */
export interface StructuredOutputBridge {
  executeIR(request: IRChatRequest, options?: { signal?: AbortSignal }): Promise<IRChatResponse>;
  executeIRStream?(request: IRChatRequest, options?: { signal?: AbortSignal }): IRChatStream;
  readonly frontend: { readonly metadata: { readonly name: string } };
  readonly config?: { readonly defaultModel?: string };
}

const EXTRACT_TOOL_NAME = 'extract_data';

/**
 * Options for generateObject
 */
export interface GenerateObjectOptions<T = any> {
  schema: T;
  prompt: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

/**
 * Result from generateObject
 */
export interface GenerateObjectResult<T> {
  object: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

/**
 * Options for streamObject
 */
export interface StreamObjectOptions<T = any> {
  schema: T;
  prompt: string;
  model?: string;
  onPartial?: (partial: Partial<T>) => void;
  signal?: AbortSignal;
}

/**
 * Build the IR tool definition + forced toolChoice shared by
 * generateObject/streamObject.
 */
function buildExtractDataTool(schema: any): IRTool {
  const toolDef = schemaToToolDefinition(schema, EXTRACT_TOOL_NAME, 'Extract structured data');
  return {
    name: toolDef.function.name,
    description: toolDef.function.description,
    // This module's local JSONSchema type (a hand-rolled subset used for
    // Zod conversion) is structurally compatible with the IR JSONSchema
    // type at runtime, but its `type` field is a plain `string` rather
    // than IR's narrower JSONSchemaType union -- cast through `unknown`.
    parameters: toolDef.function.parameters as unknown as IRTool['parameters'],
  };
}

/**
 * Create a generateObject function bound to a Bridge instance
 *
 * This is a factory function that creates a generateObject implementation
 * that uses the provided Bridge's `executeIR()` for making LLM calls -- so
 * it works with any backend/frontend combination, not just Anthropic.
 */
export function createGenerateObject(bridge: StructuredOutputBridge) {
  return async function generateObject<T = any>(
    options: GenerateObjectOptions
  ): Promise<GenerateObjectResult<T>> {
    // Ensure Zod is available
    getZod();
    const { schema, prompt, model, temperature = 0.7, maxRetries = 3, signal } = options;

    // Convert schema to an IR tool definition (provider-agnostic)
    const irTool = buildExtractDataTool(schema);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const request: IRChatRequest = {
          messages: [{ role: 'user', content: prompt }],
          parameters: {
            model: model ?? bridge.config?.defaultModel,
            temperature,
          },
          tools: [irTool],
          toolChoice: { name: EXTRACT_TOOL_NAME },
          metadata: {
            requestId:
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `generate-object-${Date.now()}-${attempt}`,
            timestamp: Date.now(),
            provenance: { frontend: bridge.frontend.metadata.name },
          },
        };

        // Make the LLM call via IR -- correct for any backend's own
        // forced-tool-call wire format, since executeIR skips frontend
        // conversion and each backend's fromIR/toIR already normalizes
        // toolChoice/ToolUseContent to and from its native shape.
        const response = await bridge.executeIR(request, { signal });

        const toolCalls = extractToolCalls(response);
        const firstToolCall = toolCalls[0];

        if (!firstToolCall) {
          throw new Error('No tool call in response');
        }

        const data = firstToolCall.input;

        // Validate against schema
        const validation = validateWithSchema(data, schema);

        if (!validation.success) {
          const errors = 'errors' in validation ? validation.errors : 'unknown error';
          lastError = new Error(`Validation failed: ${JSON.stringify(errors)}`);
          continue; // Retry
        }

        // Return validated object
        return {
          object: validation.data,
          usage: response.usage,
          finishReason: response.finishReason || 'stop',
        };
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Failed to generate object');
  };
}

/**
 * Create a streamObject function bound to a Bridge instance
 *
 * This is a factory function that creates a streamObject implementation
 * that uses the provided Bridge's `executeIRStream()` for making streaming
 * LLM calls -- so it works with any backend/frontend combination, not just
 * Anthropic. Partial JSON is accumulated from IR `tool_use` chunks'
 * `inputDelta`, which every backend adapter already normalizes to the same
 * shape regardless of that provider's native streaming event format.
 */
export function createStreamObject(bridge: StructuredOutputBridge) {
  return async function* streamObject<T = any>(
    options: StreamObjectOptions
  ): AsyncGenerator<Partial<T>, T> {
    // Ensure Zod is available
    getZod();
    const { schema, prompt, model, onPartial, signal } = options;

    if (!bridge.executeIRStream) {
      throw new Error('streamObject requires a Bridge with executeIRStream() support');
    }

    // Convert schema to an IR tool definition (provider-agnostic)
    const irTool = buildExtractDataTool(schema);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: prompt }],
      parameters: { model: model ?? bridge.config?.defaultModel },
      tools: [irTool],
      toolChoice: { name: EXTRACT_TOOL_NAME },
      metadata: {
        requestId:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `stream-object-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: bridge.frontend.metadata.name },
      },
    };

    const stream = bridge.executeIRStream(request, { signal });

    let accumulatedRaw = '';
    let accumulatedData: Partial<T> = {};
    let finalData: Partial<T> | undefined;

    for await (const chunk of stream) {
      if (chunk.type === 'tool_use' && chunk.name === EXTRACT_TOOL_NAME) {
        accumulatedRaw += chunk.inputDelta ?? '';

        try {
          accumulatedData = JSON.parse(accumulatedRaw || '{}') as Partial<T>;

          if (onPartial) {
            onPartial(accumulatedData);
          }

          yield accumulatedData;
        } catch {
          // JSON not yet complete, continue
        }
      } else if (chunk.type === 'done' && chunk.message) {
        const toolCalls = extractToolCalls(chunk.message);
        const firstToolCall = toolCalls[0];
        if (firstToolCall) {
          finalData = firstToolCall.input as Partial<T>;
        }
      }
    }

    // Prefer the fully-assembled object from the `done` chunk (already
    // parsed by the backend adapter); fall back to whatever was
    // successfully parsed from accumulated deltas.
    const resolvedData = finalData ?? accumulatedData;

    // Validate final object
    const validation = validateWithSchema(resolvedData, schema);

    if (!validation.success) {
      const errors = 'errors' in validation ? validation.errors : 'unknown error';
      throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
    }

    return validation.data;
  };
}
