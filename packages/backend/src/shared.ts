/**
 * Backend Shared Utilities
 *
 * Common utilities shared across all backend adapters to reduce code duplication.
 * These functions handle token estimation, model listing, and filtering.
 *
 * @module
 */

import type { IRChatRequest, AIModel, ListModelsResult } from 'ai.matey.types';

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
    if (
      filter.supportsStreaming !== undefined &&
      capabilities.supportsStreaming !== filter.supportsStreaming
    ) {
      return false;
    }

    if (
      filter.supportsVision !== undefined &&
      capabilities.supportsVision !== filter.supportsVision
    ) {
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
export function estimateCost(inputTokens: number, outputTokens: number, rates: CostRates): number {
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
 * Updated: 2025-11-30
 */
export const DEFAULT_ANTHROPIC_MODELS: readonly AIModel[] = [
  {
    id: 'claude-opus-4.5-20251124',
    name: 'Claude Opus 4.5 (Nov 2025)',
    description: 'Most capable Claude model',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'claude-sonnet-4.5-20250929',
    name: 'Claude Sonnet 4.5 (Sep 2025)',
    description: 'Most capable for coding, agents, and computer use',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'claude-opus-4.1-20250805',
    name: 'Claude Opus 4.1 (Aug 2025)',
    description: 'Advanced reasoning and intelligence',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'claude-sonnet-4-20250522',
    name: 'Claude Sonnet 4 (May 2025)',
    description: 'Balanced performance and speed',
    ownedBy: 'anthropic',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (Oct 2024)',
    description: 'Previous generation flagship',
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
    description: 'Fastest and most affordable',
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
] as const;

/**
 * Default AI21 models with capabilities.
 * Updated: 2025-11-30
 * Note: AI21 does not provide a models listing API
 */
export const DEFAULT_AI21_MODELS: readonly AIModel[] = [
  {
    id: 'jamba-1.5-mini',
    name: 'Jamba 1.5 Mini',
    description: 'Most lightweight and efficient model (12B active params)',
    ownedBy: 'ai21',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 256000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'jamba-1.5-large',
    name: 'Jamba 1.5 Large',
    description: 'Most powerful model (94B active params)',
    ownedBy: 'ai21',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 256000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
] as const;

/**
 * Default Gemini models with capabilities.
 * Updated: 2025-11-30
 */
export const DEFAULT_GEMINI_MODELS: readonly AIModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Ultra-efficient and affordable multimodal model',
    ownedBy: 'google',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 1000000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    description: 'Optimized for speed and cost',
    ownedBy: 'google',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 1000000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Best price-performance for large scale tasks',
    ownedBy: 'google',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 1000000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'High-capability model for complex reasoning',
    ownedBy: 'google',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 1000000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    description: 'Most powerful model for agentic workflows and coding',
    ownedBy: 'google',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 1000000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
] as const;

/**
 * Default Cohere models with capabilities.
 * Updated: 2025-11-30
 */
export const DEFAULT_COHERE_MODELS: readonly AIModel[] = [
  {
    id: 'command-r7b',
    name: 'Command R7B',
    description: 'Most cost-effective model (7B params)',
    ownedBy: 'cohere',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'command-r-08-2024',
    name: 'Command R (Aug 2024)',
    description: 'Optimized for conversational interaction and long context',
    ownedBy: 'cohere',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'command-r-plus-08-2024',
    name: 'Command R+ (Aug 2024)',
    description: 'Advanced model with enhanced capabilities',
    ownedBy: 'cohere',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'command-a-03-2025',
    name: 'Command A (Mar 2025)',
    description: 'Most performant model (111B params) with vision support',
    ownedBy: 'cohere',
    capabilities: {
      maxTokens: 4096,
      contextWindow: 256000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    },
  },
] as const;

/**
 * Default Mistral models with capabilities.
 * Updated: 2025-11-30
 */
export const DEFAULT_MISTRAL_MODELS: readonly AIModel[] = [
  {
    id: 'mistral-small-2501',
    name: 'Mistral Small (Jan 2025)',
    description: 'Most affordable for simpler tasks',
    ownedBy: 'mistralai',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 32000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'mistral-medium-2505',
    name: 'Mistral Medium (May 2025)',
    description: 'Balanced performance and cost',
    ownedBy: 'mistralai',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'mistral-large-2411',
    name: 'Mistral Large 24.11',
    description: 'Advanced dense LLM (123B params) with strong reasoning',
    ownedBy: 'mistralai',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 128000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
  {
    id: 'codestral-2501',
    name: 'Codestral (Jan 2025)',
    description: 'Specialized for code generation and completion',
    ownedBy: 'mistralai',
    capabilities: {
      maxTokens: 8192,
      contextWindow: 32000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      supportsJSON: true,
    },
  },
] as const;
