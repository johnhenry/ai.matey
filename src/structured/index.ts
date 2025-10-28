/**
 * Structured Output Module
 *
 * Zod-based structured output with schema validation for ai.matey.
 *
 * Provides type-safe data extraction from LLMs using Zod schemas.
 * Supports multiple extraction modes (tools, JSON, markdown) and
 * works with all backend adapters.
 *
 * @module
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
 *   messages: [{ role: 'user', content: 'John is 30' }]
 * })
 *
 * console.log(result.data) // { name: 'John', age: 30 }
 * ```
 */

// Core functions
export { generateObject, generateObjectStream } from './generate-object.js';
export { generateObjectWithRetry } from './retry.js';

// Type definitions
export type {
  ExtractionMode,
  IRSchema,
  GenerateObjectOptions,
  GenerateObjectResult,
  InferSchema,
  ValidationError,
  ValidationResult,
} from './types.js';
export type { RetryOptions } from './retry.js';

// Utilities
export {
  parsePartialJSON,
  deepMerge,
  extractMarkdownJSON,
  isValidJSON,
  getNestingLevel,
} from './json-parser.js';

export {
  convertZodToJsonSchema,
  isZodAvailable,
  isZodToJsonSchemaAvailable,
  isZodSchema,
  getSchemaDescription,
  generateExampleFromSchema,
} from './schema-converter.js';
