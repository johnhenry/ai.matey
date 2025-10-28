/**
 * Structured Output Types
 *
 * Type definitions for Zod-based structured output with schema validation.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRMessage, FinishReason, IRSchema, ExtractionMode } from '../types/ir.js';

// Re-export IRSchema and ExtractionMode for convenience
export type { IRSchema, ExtractionMode };

// ============================================================================
// generateObject Options
// ============================================================================

/**
 * Options for generateObject function.
 *
 * @template T The expected return type (inferred from Zod schema)
 */
export interface GenerateObjectOptions<T = any> {
  /**
   * Backend adapter to use for generation.
   */
  backend: BackendAdapter;

  /**
   * Zod schema for validation and type inference.
   *
   * The schema drives both the prompt engineering and
   * runtime validation of the response.
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   *
   * const schema = z.object({
   *   name: z.string(),
   *   age: z.number()
   * })
   * ```
   */
  schema: any;

  /**
   * Conversation messages.
   *
   * The last user message typically contains the data to extract.
   */
  messages: readonly IRMessage[];

  /**
   * Model to use (optional - backend may have default).
   */
  model?: string;

  /**
   * Extraction mode.
   *
   * - 'tools': Use function calling (most reliable)
   * - 'json': Use JSON response format
   * - 'md_json': Extract from markdown
   * - 'json_schema': Use JSON schema mode (OpenAI)
   *
   * @default 'tools'
   */
  mode?: ExtractionMode;

  /**
   * Schema name (for tool calling).
   * @default 'extract'
   */
  name?: string;

  /**
   * Schema description (for tool calling).
   *
   * Helps guide the model on what to extract.
   */
  description?: string;

  /**
   * Enable streaming with partial validation.
   *
   * When true, returns an async generator that yields
   * progressively more complete partial objects.
   *
   * @default false
   */
  stream?: boolean;

  /**
   * Sampling temperature (0.0 to 2.0).
   * @default 0.0 (more deterministic for extraction)
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Callback for each partial update (streaming only).
   *
   * Receives progressively more complete partial objects
   * as the model generates the response.
   *
   * @param partial Partial object (may not pass full schema validation)
   */
  onPartial?: (partial: Partial<T>) => void;

  /**
   * Callback on successful completion.
   *
   * @param result Final validated result
   */
  onFinish?: (result: T) => void | Promise<void>;

  /**
   * Callback on error.
   *
   * @param error Error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Abort signal for cancellation.
   */
  signal?: AbortSignal;
}

// ============================================================================
// generateObject Result
// ============================================================================

/**
 * Result from generateObject.
 *
 * @template T The validated result type
 */
export interface GenerateObjectResult<T = any> {
  /**
   * Validated result object.
   *
   * Guaranteed to match the provided Zod schema.
   */
  data: T;

  /**
   * Raw response content (for debugging).
   *
   * The original JSON string before validation.
   */
  raw: string;

  /**
   * Validation warnings (if any partial failures).
   *
   * May include warnings about optional fields,
   * coercion, or other non-fatal issues.
   */
  warnings?: readonly string[];

  /**
   * Metadata from response.
   */
  metadata: {
    /**
     * Model used for generation.
     */
    model: string;

    /**
     * Why generation finished.
     */
    finishReason: FinishReason;

    /**
     * Token usage statistics.
     */
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };

    /**
     * Provider response ID.
     */
    responseId?: string;

    /**
     * Request/response latency in milliseconds.
     */
    latencyMs?: number;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract type from Zod schema.
 *
 * Utility type for type inference from Zod schemas.
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   name: z.string(),
 *   age: z.number()
 * })
 *
 * type User = InferSchema<typeof UserSchema>
 * // { name: string; age: number }
 * ```
 */
export type InferSchema<T> = T extends { parse: (data: any) => infer R } ? R : never;

/**
 * Validation error from Zod.
 */
export interface ValidationError {
  path: (string | number)[];
  message: string;
  code: string;
}

/**
 * Result of schema validation.
 */
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}
