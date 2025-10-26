/**
 * Model Pricing Registry
 *
 * Centralized pricing database for AI models across providers.
 * Prices are in USD per 1,000 tokens.
 *
 * @module
 */

import type { ModelCapabilities } from '../types/models.js';

/**
 * Pricing data for a specific model.
 */
export interface ModelPricing {
  readonly input: number;  // Cost per 1k input tokens (USD)
  readonly output: number; // Cost per 1k output tokens (USD)
}

/**
 * Extended capabilities including estimated quality and latency.
 */
export interface ExtendedModelCapabilities extends ModelCapabilities {
  readonly pricing: ModelPricing;
  readonly latency?: {
    readonly p50?: number;
    readonly p95?: number;
  };
  readonly qualityScore?: number;
  readonly modelFamily?: string;
  readonly releaseDate?: string;
}

/**
 * Static pricing database for major AI models.
 * Data sourced from provider APIs and community benchmarks (as of October 2024).
 */
const MODEL_PRICING_DATABASE: Record<string, Partial<ExtendedModelCapabilities>> = {
  // OpenAI Models
  'gpt-4': {
    pricing: { input: 0.03, output: 0.06 },
    latency: { p50: 2000, p95: 4000 },
    qualityScore: 95,
    modelFamily: 'gpt-4',
    releaseDate: '2023-03-14',
    contextWindow: 8192,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },
  'gpt-4-turbo': {
    pricing: { input: 0.01, output: 0.03 },
    latency: { p50: 1800, p95: 3500 },
    qualityScore: 95,
    modelFamily: 'gpt-4',
    releaseDate: '2024-04-09',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },
  'gpt-4-turbo-preview': {
    pricing: { input: 0.01, output: 0.03 },
    latency: { p50: 1800, p95: 3500 },
    qualityScore: 94,
    modelFamily: 'gpt-4',
    releaseDate: '2024-01-25',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },
  'gpt-3.5-turbo': {
    pricing: { input: 0.0005, output: 0.0015 },
    latency: { p50: 800, p95: 1500 },
    qualityScore: 75,
    modelFamily: 'gpt-3.5',
    releaseDate: '2023-03-01',
    contextWindow: 16385,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },
  'gpt-4o': {
    pricing: { input: 0.005, output: 0.015 },
    latency: { p50: 1200, p95: 2500 },
    qualityScore: 96,
    modelFamily: 'gpt-4',
    releaseDate: '2024-05-13',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },
  'gpt-4o-mini': {
    pricing: { input: 0.00015, output: 0.0006 },
    latency: { p50: 600, p95: 1200 },
    qualityScore: 80,
    modelFamily: 'gpt-4',
    releaseDate: '2024-07-18',
    contextWindow: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },

  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    pricing: { input: 0.003, output: 0.015 },
    latency: { p50: 1500, p95: 3000 },
    qualityScore: 97,
    modelFamily: 'claude-3',
    releaseDate: '2024-10-22',
    contextWindow: 200000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: false,
  },
  'claude-3-opus-20240229': {
    pricing: { input: 0.015, output: 0.075 },
    latency: { p50: 2200, p95: 4500 },
    qualityScore: 96,
    modelFamily: 'claude-3',
    releaseDate: '2024-02-29',
    contextWindow: 200000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: false,
  },
  'claude-3-sonnet-20240229': {
    pricing: { input: 0.003, output: 0.015 },
    latency: { p50: 1600, p95: 3200 },
    qualityScore: 92,
    modelFamily: 'claude-3',
    releaseDate: '2024-02-29',
    contextWindow: 200000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: false,
  },
  'claude-3-haiku-20240307': {
    pricing: { input: 0.00025, output: 0.00125 },
    latency: { p50: 400, p95: 800 },
    qualityScore: 78,
    modelFamily: 'claude-3',
    releaseDate: '2024-03-07',
    contextWindow: 200000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: false,
  },
  'claude-3-5-haiku-20241022': {
    pricing: { input: 0.001, output: 0.005 },
    latency: { p50: 500, p95: 1000 },
    qualityScore: 82,
    modelFamily: 'claude-3',
    releaseDate: '2024-10-22',
    contextWindow: 200000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: false,
  },

  // Google Gemini Models
  'gemini-1.5-pro': {
    pricing: { input: 0.00125, output: 0.005 },
    latency: { p50: 1400, p95: 2800 },
    qualityScore: 93,
    modelFamily: 'gemini-1.5',
    releaseDate: '2024-02-15',
    contextWindow: 1000000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },
  'gemini-1.5-flash': {
    pricing: { input: 0.000075, output: 0.0003 },
    latency: { p50: 600, p95: 1200 },
    qualityScore: 80,
    modelFamily: 'gemini-1.5',
    releaseDate: '2024-05-14',
    contextWindow: 1000000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },
  'gemini-1.5-flash-8b': {
    pricing: { input: 0.0000375, output: 0.00015 },
    latency: { p50: 400, p95: 800 },
    qualityScore: 70,
    modelFamily: 'gemini-1.5',
    releaseDate: '2024-10-03',
    contextWindow: 1000000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsJSON: true,
  },

  // Mistral AI Models
  'mistral-large-latest': {
    pricing: { input: 0.002, output: 0.006 },
    latency: { p50: 1300, p95: 2600 },
    qualityScore: 90,
    modelFamily: 'mistral',
    releaseDate: '2024-07-24',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },
  'mistral-medium-latest': {
    pricing: { input: 0.0027, output: 0.0081 },
    latency: { p50: 1100, p95: 2200 },
    qualityScore: 85,
    modelFamily: 'mistral',
    releaseDate: '2023-12-11',
    contextWindow: 32000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },
  'mistral-small-latest': {
    pricing: { input: 0.001, output: 0.003 },
    latency: { p50: 700, p95: 1400 },
    qualityScore: 78,
    modelFamily: 'mistral',
    releaseDate: '2024-02-26',
    contextWindow: 32000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },

  // DeepSeek Models
  'deepseek-chat': {
    pricing: { input: 0.00014, output: 0.00028 },
    latency: { p50: 900, p95: 1800 },
    qualityScore: 82,
    modelFamily: 'deepseek',
    releaseDate: '2024-01-01',
    contextWindow: 64000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },
  'deepseek-coder': {
    pricing: { input: 0.00014, output: 0.00028 },
    latency: { p50: 900, p95: 1800 },
    qualityScore: 88,
    modelFamily: 'deepseek',
    releaseDate: '2024-01-01',
    contextWindow: 64000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    supportsJSON: true,
  },
};

/**
 * Get pricing information for a specific model.
 *
 * @param modelId - The model identifier (e.g., "gpt-4", "claude-3-opus-20240229")
 * @returns Pricing data or null if not found
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  const data = MODEL_PRICING_DATABASE[modelId];
  return data?.pricing ?? null;
}

/**
 * Get extended capabilities for a specific model.
 *
 * @param modelId - The model identifier
 * @returns Extended capabilities or null if not found
 */
export function getModelCapabilities(modelId: string): Partial<ExtendedModelCapabilities> | null {
  return MODEL_PRICING_DATABASE[modelId] ?? null;
}

/**
 * Get all models with pricing data.
 *
 * @returns Array of model IDs with pricing information
 */
export function getAllPricedModels(): string[] {
  return Object.keys(MODEL_PRICING_DATABASE);
}

/**
 * Find models by model family.
 *
 * @param family - The model family (e.g., "gpt-4", "claude-3")
 * @returns Array of model IDs in the family
 */
export function getModelsByFamily(family: string): string[] {
  return Object.keys(MODEL_PRICING_DATABASE).filter(
    (modelId) => MODEL_PRICING_DATABASE[modelId]?.modelFamily === family
  );
}

/**
 * User-defined pricing overrides.
 * Allows users to specify custom pricing for models.
 */
const pricingOverrides = new Map<string, ModelPricing>();

/**
 * Set custom pricing for a model (overrides static database).
 *
 * @param modelId - The model identifier
 * @param pricing - Custom pricing data
 */
export function setPricingOverride(modelId: string, pricing: ModelPricing): void {
  pricingOverrides.set(modelId, pricing);
}

/**
 * Clear pricing override for a model.
 *
 * @param modelId - The model identifier
 */
export function clearPricingOverride(modelId: string): void {
  pricingOverrides.delete(modelId);
}

/**
 * Clear all pricing overrides.
 */
export function clearAllPricingOverrides(): void {
  pricingOverrides.clear();
}

/**
 * Get pricing with user overrides applied.
 *
 * @param modelId - The model identifier
 * @returns Pricing data (override if set, else from database)
 */
export function getPricingWithOverrides(modelId: string): ModelPricing | null {
  return pricingOverrides.get(modelId) ?? getModelPricing(modelId);
}
