/**
 * Backend Shared Utilities
 *
 * Common utilities shared across all backend adapters to reduce code duplication.
 * These functions handle token estimation, model listing, and filtering.
 *
 * @module
 */

import type {
  IRChatRequest,
  AIModel,
  ListModelsResult,
} from 'ai.matey.types';

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for a chat request.
 *
 * Uses a rough heuristic of 4 characters per token, which provides
 * a reasonable approximation across most LLMs.
 *
 * @param request - The IR chat request to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens({
 *   messages: [{ role: 'user', content: 'Hello, how are you?' }],
 * });
 * // tokens ≈ 5
 * ```
 */
export function estimateTokens(request: IRChatRequest): number {
  let totalChars = 0;

  for (const message of request.messages) {
    if (typeof message.content === 'string') {
      totalChars += message.content.length;
    } else {
      for (const block of message.content) {
        if (block.type === 'text') {
          totalChars += block.text.length;
        }
      }
    }
  }

  // Rough estimate: 4 characters per token
  return Math.ceil(totalChars / 4);
}

// ============================================================================
// Model Listing Utilities
// ============================================================================

/**
 * Build a ListModelsResult from static model configuration.
 *
 * Converts string model IDs or AIModel objects into a standardized result.
 *
 * @param models - Array of model IDs or AIModel objects
 * @param ownedBy - Default owner for string-only model IDs
 * @returns Standardized ListModelsResult
 *
 * @example
 * ```typescript
 * // With string IDs
 * const result = buildStaticResult(['gpt-4', 'gpt-3.5-turbo'], 'openai');
 *
 * // With AIModel objects
 * const result = buildStaticResult([
 *   { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', ownedBy: 'anthropic' }
 * ]);
 * ```
 */
export function buildStaticResult(
  models: readonly (string | AIModel)[],
  ownedBy = 'provider'
): ListModelsResult {
  const normalizedModels: AIModel[] = models.map((model) => {
    if (typeof model === 'string') {
      // Convert string ID to AIModel
      return {
        id: model,
        name: model,
        ownedBy,
      };
    }
    return model;
  });

  return {
    models: normalizedModels,
    source: 'static',
    fetchedAt: Date.now(),
    isComplete: true,
  };
}

/**
 * Model capability filter options.
 */
export interface ModelCapabilityFilter {
  /** Filter models that support streaming */
  readonly supportsStreaming?: boolean;
  /** Filter models that support vision/image inputs */
  readonly supportsVision?: boolean;
  /** Filter models that support tool/function calling */
  readonly supportsTools?: boolean;
  /** Filter models that support JSON mode output */
  readonly supportsJSON?: boolean;
}

/**
 * Apply capability filter to a model list result.
 *
 * Filters the models based on their declared capabilities.
 * Models without capability information are included by default.
 *
 * @param result - The model list result to filter
 * @param filter - Optional capability filter criteria
 * @returns Filtered ListModelsResult
 *
 * @example
 * ```typescript
 * const filtered = applyModelFilter(result, {
 *   supportsStreaming: true,
 *   supportsVision: true,
 * });
 * ```
 */
export function applyModelFilter(
  result: ListModelsResult,
  filter?: ModelCapabilityFilter
): ListModelsResult {
  if (!filter) {
    return result;
  }

  const filteredModels = result.models.filter((model) => {
    const capabilities = model.capabilities;

    // If no capabilities info, can't filter - include the model
    if (!capabilities) {
      return true;
    }

    // Check each filter criterion
    if (filter.supportsStreaming !== undefined && capabilities.supportsStreaming !== filter.supportsStreaming) {
      return false;
    }

    if (filter.supportsVision !== undefined && capabilities.supportsVision !== filter.supportsVision) {
      return false;
    }

    if (filter.supportsTools !== undefined && capabilities.supportsTools !== filter.supportsTools) {
      return false;
    }

    if (filter.supportsJSON !== undefined && capabilities.supportsJSON !== filter.supportsJSON) {
      return false;
    }

    return true;
  });

  return {
    ...result,
    models: filteredModels,
    isComplete: result.isComplete && filteredModels.length === result.models.length,
  };
}

// ============================================================================
// Cost Estimation
// ============================================================================

/**
 * Cost rates per 1 million tokens.
 */
export interface CostRates {
  /** Cost per 1M input tokens */
  inputPer1M: number;
  /** Cost per 1M output tokens */
  outputPer1M: number;
}

/**
 * Estimate request cost based on token counts and provider rates.
 *
 * @param inputTokens - Estimated input token count
 * @param outputTokens - Estimated output token count (defaults to maxTokens or 1000)
 * @param rates - Cost rates per million tokens
 * @returns Estimated cost in USD
 *
 * @example
 * ```typescript
 * const cost = estimateCost(1000, 500, {
 *   inputPer1M: 3.00,  // $3 per 1M input tokens
 *   outputPer1M: 15.00, // $15 per 1M output tokens
 * });
 * // cost ≈ $0.0105
 * ```
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  rates: CostRates
): number {
  const inputCost = (inputTokens / 1_000_000) * rates.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPer1M;
  return inputCost + outputCost;
}

// ============================================================================
// Default Model Lists
// ============================================================================

/**
 * Default OpenAI models with capabilities.
 */
export const DEFAULT_OPENAI_MODELS: readonly AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable GPT-4 model with vision',
    ownedBy: 'openai',
    capabilities: {
      maxTokens: 16384,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable GPT-4 variant',
    ownedBy: 'openai',
    capabilities: {
      maxTokens: 16384,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'GPT-4 with larger context and vision',
    ownedBy: 'openai',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and efficient for simple tasks',
    ownedBy: 'openai',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 16385,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
] as const;

/**
 * Default Anthropic Claude models with capabilities.
 */
export const DEFAULT_ANTHROPIC_MODELS: readonly AIModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Oct 2024)',
    description: 'Most intelligent model with excellent reasoning',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: false,
    },
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku (Oct 2024)',
    description: 'Fastest model for high-throughput tasks',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: false,
    },
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Previous top-tier model',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: false,
    },
  },
] as const;
