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
    // In Zod v3, enum values are in _def.values (array)
    const values = def.values || [];
    const result: JSONSchema = {
      type: 'string',
      enum: Array.isArray(values) ? values : Object.values(values),
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
 * Options for generateObject
 */
export interface GenerateObjectOptions<T = any> {
  schema: T;
  prompt: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
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
}

/**
 * Create a generateObject function bound to a Bridge instance
 *
 * This is a factory function that creates a generateObject implementation
 * that uses the provided Bridge for making LLM calls.
 */
export function createGenerateObject(bridge: any) {
  return async function generateObject<T = any>(
    options: GenerateObjectOptions
  ): Promise<GenerateObjectResult<T>> {
    // Ensure Zod is available
    getZod();
    const { schema, prompt, model, temperature = 0.7, maxRetries = 3 } = options;

    // Convert schema to tool definition
    const toolDef = schemaToToolDefinition(schema, 'extract_data', 'Extract structured data');

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Make the LLM call with tool use
        const response = await bridge.chat({
          model: model || bridge.config.defaultModel,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          tools: [toolDef],
          tool_choice: { type: 'tool', name: 'extract_data' },
          temperature,
        });

        // Extract tool call result
        const toolCalls = response.content?.filter((c: any) => c.type === 'tool_use');

        if (!toolCalls || toolCalls.length === 0) {
          throw new Error('No tool call in response');
        }

        const toolCall = toolCalls[0];
        const data = toolCall.input;

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
          finishReason: response.stop_reason || 'stop',
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
 * that uses the provided Bridge for making streaming LLM calls.
 */
export function createStreamObject(bridge: any) {
  return async function* streamObject<T = any>(
    options: StreamObjectOptions
  ): AsyncGenerator<Partial<T>, T> {
    // Ensure Zod is available
    getZod();
    const { schema, prompt, model, onPartial } = options;

    // Convert schema to tool definition
    const toolDef = schemaToToolDefinition(schema, 'extract_data', 'Extract structured data');

    // Make streaming LLM call
    const stream = await bridge.chatStream({
      model: model || bridge.config.defaultModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      tools: [toolDef],
      tool_choice: { type: 'tool', name: 'extract_data' },
    });

    let accumulatedData: Partial<T> = {};

    for await (const chunk of stream) {
      // Check if chunk contains tool use delta
      if (chunk.delta?.type === 'input_json_delta') {
        const jsonDelta = chunk.delta.partial_json;

        try {
          // Parse accumulated JSON
          accumulatedData = JSON.parse(jsonDelta || '{}') as Partial<T>;

          // Emit partial
          if (onPartial) {
            onPartial(accumulatedData);
          }

          yield accumulatedData;
        } catch {
          // JSON not yet complete, continue
        }
      }
    }

    // Validate final object
    const validation = validateWithSchema(accumulatedData, schema);

    if (!validation.success) {
      const errors = 'errors' in validation ? validation.errors : 'unknown error';
      throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
    }

    return validation.data;
  };
}
