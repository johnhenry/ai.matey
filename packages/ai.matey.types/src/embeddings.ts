/**
 * Embedding Types
 *
 * IR types for embedding generation across providers. Mirrors the chat IR:
 * a universal request/response pair with provenance metadata and warnings,
 * executed by backend adapters that opt in via the optional `embed()`
 * method on `BackendAdapter`.
 *
 * @module
 */

import type { IRMetadata } from './ir.js';

/**
 * Parameters for an embedding request.
 */
export interface IREmbedParameters {
  /** Embedding model id (falls back to the backend's default). */
  readonly model?: string;

  /**
   * Requested output dimensions. Passed natively when the provider supports
   * it (`supportsEmbeddingDimensions` capability); otherwise the Bridge can
   * normalize vectors client-side (see `EmbedOptions.dimensionStrategy`).
   */
  readonly dimensions?: number;

  /**
   * Intended downstream use of the embeddings. Mapped to provider-specific
   * hints (Cohere `input_type`, Gemini `taskType`) when supported.
   */
  readonly inputType?: 'query' | 'document' | 'classification' | 'clustering';

  /** Truncate over-long inputs provider-side when supported. */
  readonly truncate?: boolean;

  /** End-user identifier for abuse monitoring (providers that accept it). */
  readonly user?: string;

  /** Provider-specific passthrough parameters. */
  readonly custom?: Record<string, unknown>;
}

/**
 * Universal embedding request.
 */
export interface IREmbedRequest {
  /** One input string or a batch. Order is preserved in the response. */
  readonly input: string | readonly string[];

  readonly parameters?: IREmbedParameters;

  /** Request metadata (requestId, provenance, warnings). */
  readonly metadata: IRMetadata;
}

/**
 * A single embedding vector, positionally linked to its input.
 */
export interface IREmbedding {
  /** Index of the corresponding input (stable across batch chunking). */
  readonly index: number;

  /** The embedding vector. */
  readonly vector: readonly number[];
}

/**
 * Token usage for an embedding request.
 */
export interface IREmbedUsage {
  readonly promptTokens: number;
  readonly totalTokens: number;
  readonly details?: Record<string, unknown>;
}

/**
 * Universal embedding response.
 */
export interface IREmbedResponse {
  /** Embeddings in input order. */
  readonly embeddings: readonly IREmbedding[];

  /** Model that produced the embeddings. */
  readonly model: string;

  /** Dimensionality of the returned vectors. */
  readonly dimensions: number;

  readonly usage?: IREmbedUsage;

  /** Response metadata (provenance, warnings — e.g. dimension normalization). */
  readonly metadata: IRMetadata;

  /** Raw provider response for debugging. */
  readonly raw?: Record<string, unknown>;
}

// ============================================================================
// Bridge Embedding API
// ============================================================================

/**
 * Options for `Bridge.embed()`.
 */
export interface EmbedOptions {
  /** Embedding model id. */
  readonly model?: string;

  /** Target output dimensions. */
  readonly dimensions?: number;

  /**
   * How to reach the target dimensions when the provider lacks native
   * support:
   * - 'truncate' (default): drop trailing components + L2 re-normalize
   * - 'pad': zero-pad shorter vectors
   * - 'native-only': error if the provider cannot do it natively
   */
  readonly dimensionStrategy?: 'truncate' | 'pad' | 'native-only';

  /** Intended downstream use (mapped to provider hints when supported). */
  readonly inputType?: IREmbedParameters['inputType'];

  /** Override the per-request batch size (defaults to the backend's limit). */
  readonly maxBatchSize?: number;

  /** Abort signal. */
  readonly signal?: AbortSignal;

  /** Extra metadata merged into the request's custom metadata. */
  readonly metadata?: Record<string, unknown>;

  /** Provider-specific passthrough parameters. */
  readonly custom?: Record<string, unknown>;
}

/**
 * Middleware for embedding requests.
 *
 * A lightweight functional chain, separate from the chat middleware stack
 * (whose context types are chat-specific). Registered via
 * `bridge.useEmbed()`; runs outermost-first.
 */
export type EmbedMiddleware = (
  request: IREmbedRequest,
  next: (request: IREmbedRequest) => Promise<IREmbedResponse>
) => Promise<IREmbedResponse>;
