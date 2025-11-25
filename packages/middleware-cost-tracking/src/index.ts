/**
 * Cost Tracking Middleware
 *
 * Track and monitor API costs across different providers.
 * Essential for production deployments to control spending.
 *
 * @module
 */

import type { Middleware, StreamingMiddleware } from 'ai.matey.types';
import type { IRUsage } from 'ai.matey.types';

/**
 * Provider pricing configuration
 */
export interface ProviderPricing {
  /**
   * Cost per 1M input tokens (in USD)
   */
  inputCostPer1M: number;

  /**
   * Cost per 1M output tokens (in USD)
   */
  outputCostPer1M: number;

  /**
   * Optional: Different pricing for cached tokens
   */
  cachedInputCostPer1M?: number;

  /**
   * Optional: Different pricing based on request type
   */
  imageInputCostPer1M?: number;
}

/**
 * Model-specific pricing
 */
export interface ModelPricing {
  /**
   * Model identifier or pattern (supports wildcards)
   */
  model: string | RegExp;

  /**
   * Pricing for this model
   */
  pricing: ProviderPricing;
}

/**
 * Cost calculation result
 */
export interface CostCalculation {
  /**
   * Provider name
   */
  provider: string;

  /**
   * Model used
   */
  model: string;

  /**
   * Input tokens
   */
  inputTokens: number;

  /**
   * Output tokens
   */
  outputTokens: number;

  /**
   * Total tokens
   */
  totalTokens: number;

  /**
   * Input cost in USD
   */
  inputCost: number;

  /**
   * Output cost in USD
   */
  outputCost: number;

  /**
   * Total cost in USD
   */
  totalCost: number;

  /**
   * Request timestamp
   */
  timestamp: number;

  /**
   * Request ID
   */
  requestId: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Cost tracking storage interface
 */
export interface CostStorage {
  /**
   * Record a cost calculation
   */
  record(cost: CostCalculation): Promise<void>;

  /**
   * Get total cost for a time period
   */
  getTotal(startTime?: number, endTime?: number): Promise<number>;

  /**
   * Get costs grouped by provider
   */
  getByProvider(startTime?: number, endTime?: number): Promise<Map<string, number>>;

  /**
   * Get costs grouped by model
   */
  getByModel(startTime?: number, endTime?: number): Promise<Map<string, number>>;

  /**
   * Clear all cost data
   */
  clear(): Promise<void>;
}

/**
 * In-memory cost storage
 */
export class InMemoryCostStorage implements CostStorage {
  private costs: CostCalculation[] = [];

  async record(cost: CostCalculation): Promise<void> {
    this.costs.push(cost);
  }

  async getTotal(startTime?: number, endTime?: number): Promise<number> {
    return this.filterCosts(startTime, endTime).reduce((sum, c) => sum + c.totalCost, 0);
  }

  async getByProvider(startTime?: number, endTime?: number): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const cost of this.filterCosts(startTime, endTime)) {
      const current = result.get(cost.provider) || 0;
      result.set(cost.provider, current + cost.totalCost);
    }
    return result;
  }

  async getByModel(startTime?: number, endTime?: number): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const cost of this.filterCosts(startTime, endTime)) {
      const current = result.get(cost.model) || 0;
      result.set(cost.model, current + cost.totalCost);
    }
    return result;
  }

  async clear(): Promise<void> {
    this.costs = [];
  }

  private filterCosts(startTime?: number, endTime?: number): CostCalculation[] {
    return this.costs.filter((c) => {
      if (startTime && c.timestamp < startTime) {
        return false;
      }
      if (endTime && c.timestamp > endTime) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get all cost records (for debugging/export)
   */
  getAllCosts(): CostCalculation[] {
    return [...this.costs];
  }
}

/**
 * Cost tracking configuration
 */
export interface CostTrackingConfig {
  /**
   * Provider-specific pricing
   */
  providers?: Record<string, ProviderPricing>;

  /**
   * Model-specific pricing (overrides provider pricing)
   */
  models?: ModelPricing[];

  /**
   * Cost storage implementation
   */
  storage?: CostStorage;

  /**
   * Callback when cost is calculated
   */
  onCost?: (cost: CostCalculation) => void | Promise<void>;

  /**
   * Callback when cost threshold is exceeded
   */
  onThresholdExceeded?: (cost: CostCalculation, threshold: number) => void | Promise<void>;

  /**
   * Cost threshold per request (in USD)
   */
  requestThreshold?: number;

  /**
   * Cost threshold per hour (in USD)
   */
  hourlyThreshold?: number;

  /**
   * Cost threshold per day (in USD)
   */
  dailyThreshold?: number;

  /**
   * Whether to log costs to console
   */
  logCosts?: boolean;

  /**
   * Whether to include cost in response metadata
   */
  includeInMetadata?: boolean;
}

/**
 * Default pricing for common providers (as of 2024)
 * Prices in USD per 1M tokens
 */
export const DEFAULT_PRICING: Record<string, ProviderPricing> = {
  // Anthropic Claude
  'anthropic': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  'anthropic:claude-3-opus': {
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
  'anthropic:claude-3-sonnet': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  'anthropic:claude-3-haiku': {
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
  },

  // OpenAI
  'openai': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
  },
  'openai:gpt-4': {
    inputCostPer1M: 30.0,
    outputCostPer1M: 60.0,
  },
  'openai:gpt-4-turbo': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
  },
  'openai:gpt-3.5-turbo': {
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
  },

  // Google Gemini
  'gemini': {
    inputCostPer1M: 0.125,
    outputCostPer1M: 0.375,
  },
  'gemini:gemini-pro': {
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
  },

  // Mistral
  'mistral': {
    inputCostPer1M: 1.0,
    outputCostPer1M: 3.0,
  },

  // DeepSeek
  'deepseek': {
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },

  // Groq (very low cost)
  'groq': {
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.10,
  },

  // Local/Free providers
  'ollama': {
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  },
  'lmstudio': {
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  },
};

/**
 * Calculate cost for a request/response
 */
export function calculateCost(
  usage: IRUsage,
  provider: string,
  model: string,
  config: CostTrackingConfig
): CostCalculation {
  // Find pricing for this provider/model
  let pricing: ProviderPricing | undefined;

  // Check model-specific pricing first
  if (config.models) {
    for (const modelPricing of config.models) {
      if (typeof modelPricing.model === 'string') {
        if (model === modelPricing.model || model.includes(modelPricing.model)) {
          pricing = modelPricing.pricing;
          break;
        }
      } else if (modelPricing.model instanceof RegExp) {
        if (modelPricing.model.test(model)) {
          pricing = modelPricing.pricing;
          break;
        }
      }
    }
  }

  // Fall back to provider pricing
  if (!pricing && config.providers) {
    const providerKey = `${provider}:${model}`;
    pricing = config.providers[providerKey] || config.providers[provider];
  }

  // Fall back to default pricing
  if (!pricing) {
    const providerKey = `${provider}:${model}`;
    pricing = DEFAULT_PRICING[providerKey] || DEFAULT_PRICING[provider];
  }

  // If still no pricing, use zero cost
  if (!pricing) {
    pricing = { inputCostPer1M: 0, outputCostPer1M: 0 };
  }

  // Calculate costs
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputCostPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputCostPer1M;
  const totalCost = inputCost + outputCost;

  return {
    provider,
    model,
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    inputCost,
    outputCost,
    totalCost,
    timestamp: Date.now(),
    requestId: '',
  };
}

/**
 * Create cost tracking middleware
 *
 * @param config - Cost tracking configuration
 * @returns Middleware function
 *
 * @example Basic Usage
 * ```typescript
 * import { createCostTrackingMiddleware } from 'ai.matey';
 *
 * const costTracking = createCostTrackingMiddleware({
 *   logCosts: true,
 *   onCost: (cost) => {
 *     console.log(`Request cost: $${cost.totalCost.toFixed(6)}`);
 *   }
 * });
 *
 * bridge.use(costTracking);
 * ```
 *
 * @example With Custom Pricing
 * ```typescript
 * const costTracking = createCostTrackingMiddleware({
 *   providers: {
 *     'anthropic': {
 *       inputCostPer1M: 3.0,
 *       outputCostPer1M: 15.0
 *     }
 *   },
 *   models: [
 *     {
 *       model: /gpt-4-turbo/,
 *       pricing: {
 *         inputCostPer1M: 10.0,
 *         outputCostPer1M: 30.0
 *       }
 *     }
 *   ]
 * });
 * ```
 *
 * @example With Thresholds
 * ```typescript
 * const costTracking = createCostTrackingMiddleware({
 *   requestThreshold: 0.10,  // Warn if request costs > $0.10
 *   hourlyThreshold: 10.00,  // Warn if hourly cost > $10
 *   dailyThreshold: 100.00,  // Warn if daily cost > $100
 *   onThresholdExceeded: (cost, threshold) => {
 *     console.warn(`Cost threshold exceeded: $${cost.totalCost} > $${threshold}`);
 *   }
 * });
 * ```
 */
export function createCostTrackingMiddleware(config: CostTrackingConfig = {}): Middleware {
  const storage = config.storage || new InMemoryCostStorage();

  return async (context, next) => {
    // Execute request
    const response = await next();

    // Calculate cost if usage is available
    if (response.usage) {
      const provider = context.request.metadata?.provenance?.backend || 'unknown';
      const model = context.request.parameters?.model || 'unknown';

      const cost = calculateCost(response.usage, provider, model, config);
      cost.requestId = context.request.metadata?.requestId || '';
      cost.metadata = context.request.metadata?.custom;

      // Store cost
      await storage.record(cost);

      // Check thresholds
      if (config.requestThreshold && cost.totalCost > config.requestThreshold) {
        await config.onThresholdExceeded?.(cost, config.requestThreshold);
      }

      if (config.hourlyThreshold) {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const hourTotal = await storage.getTotal(hourAgo);
        if (hourTotal > config.hourlyThreshold) {
          await config.onThresholdExceeded?.(cost, config.hourlyThreshold);
        }
      }

      if (config.dailyThreshold) {
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const dayTotal = await storage.getTotal(dayAgo);
        if (dayTotal > config.dailyThreshold) {
          await config.onThresholdExceeded?.(cost, config.dailyThreshold);
        }
      }

      // Log cost if configured
      if (config.logCosts) {
        console.log(
          `[Cost] ${provider}/${model}: $${cost.totalCost.toFixed(6)} ` +
            `(${cost.inputTokens} in, ${cost.outputTokens} out)`
        );
      }

      // Call callback
      await config.onCost?.(cost);

      // Include in metadata if configured
      if (config.includeInMetadata) {
        return {
          ...response,
          metadata: {
            ...response.metadata,
            custom: {
              ...(response.metadata?.custom || {}),
              cost,
            },
          },
        };
      }
    }

    return response;
  };
}

/**
 * Create streaming cost tracking middleware
 *
 * Note: For streaming, cost is calculated at the end when usage is available
 */
export function createStreamingCostTrackingMiddleware(
  config: CostTrackingConfig = {}
): StreamingMiddleware {
  const storage = config.storage || new InMemoryCostStorage();

  return async (context, next) => {
    const stream = await next();

    // Wrap stream to track usage
    async function* wrappedStream() {
      let usage: IRUsage | undefined;

      for await (const chunk of stream) {
        yield chunk;

        // Capture usage from done chunk
        if (chunk.type === 'done' && chunk.usage) {
          usage = chunk.usage;
        }
      }

      // Calculate cost after stream completes
      if (usage) {
        const provider = context.request.metadata?.provenance?.backend || 'unknown';
        const model = context.request.parameters?.model || 'unknown';

        const cost = calculateCost(usage, provider, model, config);
        cost.requestId = context.request.metadata?.requestId || '';
        cost.metadata = context.request.metadata?.custom;

        await storage.record(cost);

        if (config.logCosts) {
          console.log(
            `[Cost] ${provider}/${model}: $${cost.totalCost.toFixed(6)} ` +
              `(${cost.inputTokens} in, ${cost.outputTokens} out)`
          );
        }

        await config.onCost?.(cost);
      }
    }

    return wrappedStream();
  };
}

/**
 * Get cost statistics from storage
 */
export async function getCostStats(storage: CostStorage, hours: number = 24) {
  const since = Date.now() - hours * 60 * 60 * 1000;

  const total = await storage.getTotal(since);
  const byProvider = await storage.getByProvider(since);
  const byModel = await storage.getByModel(since);

  return {
    period: `Last ${hours} hours`,
    total,
    byProvider: Object.fromEntries(byProvider),
    byModel: Object.fromEntries(byModel),
  };
}
