/**
 * Model Types
 *
 * Types for representing AI models and model listing functionality.
 * Backend adapters can expose available models through the listModels() method.
 *
 * @module
 */

// ============================================================================
// Model Representation
// ============================================================================

/**
 * Represents an AI model available from a provider.
 *
 * This type provides a unified representation of models across different
 * providers, including metadata about capabilities and pricing.
 */
export interface AIModel {
  /**
   * Unique model identifier (e.g., "gpt-4", "claude-3-opus-20240229").
   * This is the ID used in API requests.
   */
  readonly id: string;

  /**
   * Human-readable model name.
   * May be more descriptive than the ID.
   */
  readonly name: string;

  /**
   * Model description explaining its purpose or characteristics.
   */
  readonly description?: string;

  /**
   * When this model was created (ISO 8601 timestamp).
   */
  readonly created?: string;

  /**
   * Who owns/created this model (e.g., "openai", "anthropic").
   */
  readonly ownedBy?: string;

  /**
   * Model capabilities for filtering and discovery.
   */
  readonly capabilities?: ModelCapabilities;

  /**
   * Provider-specific metadata not covered by standard fields.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Capabilities of a specific model.
 *
 * Used for filtering models by feature support and understanding
 * what the model can do.
 */
export interface ModelCapabilities {
  /**
   * Maximum output tokens the model can generate.
   */
  readonly maxTokens?: number;

  /**
   * Total context window size (input + output).
   */
  readonly contextWindow?: number;

  /**
   * Whether the model supports streaming responses.
   */
  readonly supportsStreaming?: boolean;

  /**
   * Whether the model supports vision/image inputs.
   */
  readonly supportsVision?: boolean;

  /**
   * Whether the model supports function/tool calling.
   */
  readonly supportsTools?: boolean;

  /**
   * Whether the model supports JSON mode for structured outputs.
   */
  readonly supportsJSON?: boolean;

  /**
   * Estimated cost per 1,000 tokens (in USD).
   * Used for cost-based optimization and routing.
   */
  readonly pricing?: {
    readonly input: number; // Cost per 1k input tokens
    readonly output: number; // Cost per 1k output tokens
  };

  /**
   * Estimated latency in milliseconds for typical requests.
   * Used for speed-based optimization.
   */
  readonly latency?: {
    readonly p50?: number; // Median latency
    readonly p95?: number; // 95th percentile
  };

  /**
   * Quality score from 0-100.
   * Higher scores indicate better output quality.
   * Can be user-defined or community-rated.
   */
  readonly qualityScore?: number;

  /**
   * Model family identifier (e.g., "gpt-4", "claude-3", "gemini-1.5").
   * Used for capability inference and similarity matching.
   */
  readonly modelFamily?: string;

  /**
   * Model release date (ISO 8601 format).
   * Used for determining model recency.
   */
  readonly releaseDate?: string;
}

// ============================================================================
// Model Listing
// ============================================================================

/**
 * Options for listing models from a backend.
 */
export interface ListModelsOptions {
  /**
   * Force refresh from remote source (bypass cache).
   * @default false
   */
  readonly forceRefresh?: boolean;

  /**
   * Filter models by capability requirements.
   * Only models matching ALL specified capabilities will be returned.
   */
  readonly filter?: {
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsTools?: boolean;
    readonly supportsJSON?: boolean;
  };
}

/**
 * Result of listing models from a backend.
 *
 * Includes the models plus metadata about where they came from
 * and when they were fetched.
 */
export interface ListModelsResult {
  /**
   * Available models from this backend.
   */
  readonly models: readonly AIModel[];

  /**
   * Source of the model list.
   * - remote: Fetched from provider API
   * - static: From configuration or hardcoded list
   * - cache: From cached previous fetch
   */
  readonly source: 'remote' | 'static' | 'cache';

  /**
   * Timestamp when this list was fetched (Unix milliseconds).
   * Used for cache invalidation.
   */
  readonly fetchedAt: number;

  /**
   * Whether this list is complete or partial.
   * Partial lists may occur with filters or pagination.
   */
  readonly isComplete: boolean;
}
