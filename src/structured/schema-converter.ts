/**
 * Schema Converter
 *
 * Convert Zod schemas to JSON Schema format for backend adapters.
 *
 * @module
 */

import type { JSONSchema } from '../types/ir.js';

// ============================================================================
// Schema Conversion
// ============================================================================

/**
 * Cached converter function to avoid repeated require/import attempts.
 */
let cachedConverter: ((schema: any, options?: any) => any) | null = null;
let conversionAttempted = false;

/**
 * Cache for converted JSON schemas.
 * WeakMap ensures cache entries are garbage collected when schemas are no longer referenced.
 */
const schemaCache = new WeakMap<any, JSONSchema>();

/**
 * Load zod-to-json-schema converter function.
 * Tries multiple strategies to support both CommonJS and ESM environments.
 */
function getConverter(): (schema: any, options?: any) => any {
  if (cachedConverter) {
    return cachedConverter;
  }

  if (conversionAttempted) {
    throw new Error('zod-to-json-schema package could not be loaded');
  }

  conversionAttempted = true;

  try {
    // Try CommonJS require (works in Node.js CJS and bundlers)
    const zodToJsonSchema = require('zod-to-json-schema');
    const convert = zodToJsonSchema.zodToJsonSchema || zodToJsonSchema.default || zodToJsonSchema;

    if (typeof convert === 'function') {
      cachedConverter = convert;
      return convert;
    }

    throw new Error('zod-to-json-schema module loaded but converter function not found');
  } catch (requireError) {
    // CommonJS require failed - could be pure ESM environment
    // In pure ESM, users must pre-import the dependency before using this function
    // We can't use dynamic import() here because this function is synchronous

    throw new Error(
      `Failed to load zod-to-json-schema package.\n\n` +
      `This feature requires the zod-to-json-schema peer dependency.\n` +
      `Install it with: npm install zod-to-json-schema\n\n` +
      `Error details: ${requireError instanceof Error ? requireError.message : String(requireError)}\n\n` +
      `Note: In pure ESM environments, you may need to configure your bundler ` +
      `to properly handle this dependency.`
    );
  }
}

/**
 * Convert Zod schema to JSON Schema.
 *
 * Uses the zod-to-json-schema library (peer dependency) to convert
 * Zod schemas to JSON Schema format that backend adapters can use.
 *
 * Caches conversions using WeakMap to avoid repeated conversion overhead.
 * The cache is automatically garbage collected when schemas are no longer referenced.
 *
 * @param zodSchema Zod schema instance
 * @returns JSON Schema object
 * @throws Error if zod-to-json-schema is not installed
 *
 * @example
 * ```typescript
 * import { z } from 'zod'
 *
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number()
 * })
 *
 * const jsonSchema = convertZodToJsonSchema(schema)
 * // Returns JSON Schema representation
 *
 * // Subsequent calls with the same schema instance return cached result
 * const cached = convertZodToJsonSchema(schema) // Instant!
 * ```
 */
export function convertZodToJsonSchema(zodSchema: any): JSONSchema {
  // Check cache first
  const cached = schemaCache.get(zodSchema);
  if (cached) {
    return cached;
  }

  try {
    const convert = getConverter();

    // Convert with optimal settings
    const jsonSchema = convert(zodSchema, {
      target: 'openApi3', // Compatible with most providers
      $refStrategy: 'none', // Inline all definitions (simpler for LLMs)
      errorMessages: true, // Include error messages in schema
      markdownDescription: true, // Support markdown in descriptions
    });

    // Remove $schema field as it's not needed for LLM consumption
    if (jsonSchema.$schema) {
      delete jsonSchema.$schema;
    }

    const result = jsonSchema as JSONSchema;

    // Cache the result for future calls
    schemaCache.set(zodSchema, result);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Provide helpful error message
    throw new Error(
      `Failed to convert Zod schema to JSON Schema: ${message}\n\n` +
      'Ensure zod-to-json-schema is installed: npm install zod-to-json-schema'
    );
  }
}

/**
 * Check if Zod is available.
 *
 * Useful for runtime detection of Zod availability.
 *
 * @returns true if Zod is available
 */
export function isZodAvailable(): boolean {
  try {
    require('zod');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if zod-to-json-schema is available.
 *
 * @returns true if zod-to-json-schema is available
 */
export function isZodToJsonSchemaAvailable(): boolean {
  try {
    require('zod-to-json-schema');
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a value looks like a Zod schema.
 *
 * Simple check that object has parse method (duck typing).
 *
 * @param schema Value to check
 * @returns true if looks like Zod schema
 */
export function isZodSchema(schema: any): boolean {
  return (
    schema !== null &&
    typeof schema === 'object' &&
    typeof schema.parse === 'function' &&
    typeof schema.safeParse === 'function'
  );
}

/**
 * Extract schema description from Zod schema.
 *
 * Attempts to get description from schema metadata.
 *
 * @param schema Zod schema
 * @returns Description string or undefined
 */
export function getSchemaDescription(schema: any): string | undefined {
  try {
    // Try to get description from schema's _def
    if (schema._def?.description) {
      return schema._def.description;
    }

    // Try describe() method if available
    if (typeof schema.describe === 'function') {
      const described = schema.describe();
      if (described._def?.description) {
        return described._def.description;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Generate example value from JSON Schema.
 *
 * Creates a simple example object based on the schema structure.
 * Useful for debugging and prompt engineering.
 *
 * @param jsonSchema JSON Schema object
 * @returns Example object matching schema
 */
export function generateExampleFromSchema(jsonSchema: JSONSchema): any {
  // If schema has examples, use the first one
  if (jsonSchema.examples && jsonSchema.examples.length > 0) {
    return jsonSchema.examples[0];
  }

  // If schema has a default, use that
  if (jsonSchema.default !== undefined) {
    return jsonSchema.default;
  }

  // Generate based on type
  switch (jsonSchema.type) {
    case 'object':
      const obj: any = {};
      if (jsonSchema.properties) {
        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          obj[key] = generateExampleFromSchema(propSchema as JSONSchema);
        }
      }
      return obj;

    case 'array':
      if (jsonSchema.items) {
        return [generateExampleFromSchema(jsonSchema.items as JSONSchema)];
      }
      return [];

    case 'string':
      if (jsonSchema.enum && jsonSchema.enum.length > 0) {
        return jsonSchema.enum[0];
      }
      return 'string';

    case 'number':
    case 'integer':
      return 0;

    case 'boolean':
      return false;

    case 'null':
      return null;

    default:
      return null;
  }
}
