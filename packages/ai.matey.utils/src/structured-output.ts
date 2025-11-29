/**
 * Structured Output with Zod
 *
 * This module provides utilities for working with Zod schemas for structured LLM outputs.
 * It includes:
 * - Schema to tool definition conversion
 * - Runtime validation
 * - Type-safe object generation
 * - Streaming with partial objects
 */

import { z } from 'zod';

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
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodIssue[] };

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
  schema: z.ZodType,
  name: string = 'extract_data',
  description: string = 'Extract structured data from the input'
): ToolDefinition {
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
function zodToJsonSchema(schema: z.ZodType): JSONSchema {
  // Get the Zod internal definition
  const def = (schema as any)._def;

  // Zod v3+ uses _def.typeName, fallback to constructor name
  const typeName = def.typeName || schema.constructor.name;

  // Handle ZodObject
  if (typeName === 'ZodObject') {
    // shape is a getter property, not a method
    const shape = def.shape;
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType;
      const fieldDef = (fieldSchema as any)._def;

      // Check if field is optional BEFORE converting
      const isOptional = fieldDef.typeName === 'ZodOptional' || fieldSchema.constructor.name === 'ZodOptional';

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
    const description = (schema as any).description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodNumber
  if (typeName === 'ZodNumber') {
    const result: JSONSchema = { type: 'number' };
    const description = (schema as any).description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodBoolean
  if (typeName === 'ZodBoolean') {
    const result: JSONSchema = { type: 'boolean' };
    const description = (schema as any).description;
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
    const description = (schema as any).description;
    if (description) {
      result.description = description;
    }
    return result;
  }

  // Handle ZodEnum
  if (typeName === 'ZodEnum') {
    // Enum values are in _def.entries as an object - extract the values
    const entries = def.entries;
    const values = entries ? (Object.values(entries) as string[]) : [];
    const result: JSONSchema = {
      type: 'string',
      enum: values,
    };
    const description = (schema as any).description;
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
export function validateWithSchema<T extends z.ZodType>(
  data: unknown,
  schema: T
): ValidationResult<z.infer<T>> {
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
export function redactPII(
  text: string,
  patterns: PIIPattern[] = DEFAULT_PII_PATTERNS
): string {
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
  return text
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n');
}
