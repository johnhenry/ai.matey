/**
 * Capability Matcher
 *
 * Intelligent model matching based on capability requirements.
 * Scores and ranks models to find the best match for user needs.
 *
 * @module
 */

import type { AIModel, ModelCapabilities } from '../types/models.js';
import { inferCapabilities, meetsRequirements } from './capability-inference.js';

/**
 * Optimization strategy for model selection.
 */
export type OptimizationStrategy = 'cost' | 'speed' | 'quality' | 'balanced';

/**
 * Capability requirements for model selection.
 */
export interface CapabilityRequirements {
  /**
   * Hard requirements that MUST be met.
   * Models not meeting these will be excluded.
   */
  required?: {
    contextWindow?: number;      // Minimum context window
    maxTokens?: number;          // Minimum max tokens
    supportsStreaming?: boolean;
    supportsVision?: boolean;
    supportsTools?: boolean;
    supportsJSON?: boolean;
  };

  /**
   * Soft requirements used for scoring.
   * Models closer to these values score higher.
   */
  preferred?: {
    maxCostPer1kTokens?: number;  // Maximum acceptable cost
    maxLatencyMs?: number;         // Maximum acceptable latency (p95)
    minQualityScore?: number;      // Minimum quality score
    minContextWindow?: number;     // Preferred minimum context
  };

  /**
   * Optimization strategy (affects scoring weights).
   * @default 'balanced'
   */
  optimization?: OptimizationStrategy;

  /**
   * Custom scoring weights (overrides optimization strategy).
   * Must sum to 1.0.
   */
  weights?: {
    cost: number;     // 0-1
    speed: number;    // 0-1
    quality: number;  // 0-1
  };
}

/**
 * A model with its backend and match score.
 */
export interface ScoredModel {
  /** The model information */
  model: AIModel;

  /** Backend providing this model */
  backend: string;

  /** Overall match score (0-100) */
  score: number;

  /** Score breakdown */
  breakdown: {
    costScore: number;     // 0-100
    speedScore: number;    // 0-100
    qualityScore: number;  // 0-100
  };

  /** Reason for this match/score */
  matchReason: string;

  /** Whether all required capabilities are met */
  meetsRequirements: boolean;
}

/**
 * Available model with backend information.
 */
export interface BackendModel {
  model: AIModel;
  backend: string;
}

/**
 * Default scoring weights by optimization strategy.
 */
const OPTIMIZATION_WEIGHTS: Record<OptimizationStrategy, { cost: number; speed: number; quality: number }> = {
  cost: { cost: 0.6, speed: 0.2, quality: 0.2 },
  speed: { cost: 0.2, speed: 0.6, quality: 0.2 },
  quality: { cost: 0.2, speed: 0.2, quality: 0.6 },
  balanced: { cost: 0.33, speed: 0.33, quality: 0.34 },
};

/**
 * Match and score models based on capability requirements.
 *
 * @param requirements - Capability requirements to match
 * @param availableModels - Available models with their backends
 * @returns Sorted array of scored models (best matches first)
 */
export function matchModels(
  requirements: CapabilityRequirements,
  availableModels: BackendModel[]
): ScoredModel[] {
  const scoredModels: ScoredModel[] = [];

  for (const { model, backend } of availableModels) {
    // Get or infer capabilities
    const capabilities = model.capabilities || inferCapabilities(model.id, model.metadata);

    // Check hard requirements
    const meetsHardRequirements = requirements.required
      ? meetsRequirements(capabilities, requirements.required)
      : true;

    // Score the model
    const scored = scoreModel(model, backend, capabilities, requirements);
    scored.meetsRequirements = meetsHardRequirements;

    scoredModels.push(scored);
  }

  // Sort by score (descending), then by whether requirements are met
  return scoredModels.sort((a, b) => {
    // Prioritize models that meet requirements
    if (a.meetsRequirements !== b.meetsRequirements) {
      return a.meetsRequirements ? -1 : 1;
    }
    // Then by score
    return b.score - a.score;
  });
}

/**
 * Score a single model based on requirements.
 */
function scoreModel(
  model: AIModel,
  backend: string,
  capabilities: Partial<ModelCapabilities>,
  requirements: CapabilityRequirements
): ScoredModel {
  // Get scoring weights
  const weights = requirements.weights ||
    OPTIMIZATION_WEIGHTS[requirements.optimization || 'balanced'];

  // Calculate individual scores
  const costScore = scoreCost(capabilities, requirements.preferred);
  const speedScore = scoreSpeed(capabilities, requirements.preferred);
  const qualityScore = scoreQuality(capabilities, requirements.preferred);

  // Calculate weighted total
  const totalScore = Math.round(
    costScore * weights.cost +
    speedScore * weights.speed +
    qualityScore * weights.quality
  );

  // Determine match reason
  const matchReason = determineMatchReason(
    { costScore, speedScore, qualityScore },
    weights,
    requirements.optimization || 'balanced'
  );

  return {
    model,
    backend,
    score: totalScore,
    breakdown: {
      costScore,
      speedScore,
      qualityScore,
    },
    matchReason,
    meetsRequirements: true, // Will be set correctly by matchModels
  };
}

/**
 * Score cost (lower cost = higher score).
 */
function scoreCost(
  capabilities: Partial<ModelCapabilities>,
  preferred?: CapabilityRequirements['preferred']
): number {
  if (!capabilities.pricing) {
    return 50; // Neutral score if no pricing data
  }

  // Calculate average cost per 1k tokens (assuming 50/50 input/output ratio)
  const avgCost = (capabilities.pricing.input + capabilities.pricing.output) / 2;

  // If max cost specified, score based on how far below it is
  if (preferred?.maxCostPer1kTokens) {
    if (avgCost > preferred.maxCostPer1kTokens) {
      return 0; // Exceeds max cost
    }
    // Score: 100 at free, 0 at maxCost
    return Math.round(100 * (1 - avgCost / preferred.maxCostPer1kTokens));
  }

  // Otherwise, score based on absolute cost (cheaper = better)
  // Assume $0.10/1k tokens is expensive (score=0), free is perfect (score=100)
  const maxExpensiveCost = 0.10;
  const score = Math.max(0, 100 * (1 - avgCost / maxExpensiveCost));
  return Math.round(score);
}

/**
 * Score speed (lower latency = higher score).
 */
function scoreSpeed(
  capabilities: Partial<ModelCapabilities>,
  preferred?: CapabilityRequirements['preferred']
): number {
  const latency = capabilities.latency?.p95 || capabilities.latency?.p50;

  if (!latency) {
    return 50; // Neutral score if no latency data
  }

  // If max latency specified, score based on how far below it is
  if (preferred?.maxLatencyMs) {
    if (latency > preferred.maxLatencyMs) {
      return 0; // Exceeds max latency
    }
    // Score: 100 at instant, 0 at maxLatency
    return Math.round(100 * (1 - latency / preferred.maxLatencyMs));
  }

  // Otherwise, score based on absolute latency (faster = better)
  // Assume 5000ms is slow (score=0), instant is perfect (score=100)
  const maxSlowLatency = 5000;
  const score = Math.max(0, 100 * (1 - latency / maxSlowLatency));
  return Math.round(score);
}

/**
 * Score quality (higher quality = higher score).
 */
function scoreQuality(
  capabilities: Partial<ModelCapabilities>,
  preferred?: CapabilityRequirements['preferred']
): number {
  const quality = capabilities.qualityScore;

  if (!quality) {
    return 50; // Neutral score if no quality data
  }

  // If min quality specified, check threshold
  if (preferred?.minQualityScore) {
    if (quality < preferred.minQualityScore) {
      return 0; // Below minimum quality
    }
  }

  // Quality score is already 0-100, return as-is
  return Math.round(quality);
}

/**
 * Determine human-readable match reason.
 */
function determineMatchReason(
  breakdown: { costScore: number; speedScore: number; qualityScore: number },
  _weights: { cost: number; speed: number; quality: number },
  optimization: OptimizationStrategy
): string {
  const { costScore, speedScore, qualityScore } = breakdown;

  // Determine which metric is prioritized
  if (optimization === 'cost') {
    if (costScore >= 80) return 'Best cost efficiency';
    if (costScore >= 60) return 'Good cost/quality balance';
    return 'Meets cost requirements';
  }

  if (optimization === 'speed') {
    if (speedScore >= 80) return 'Fastest response time';
    if (speedScore >= 60) return 'Good speed/quality balance';
    return 'Meets speed requirements';
  }

  if (optimization === 'quality') {
    if (qualityScore >= 90) return 'Highest quality';
    if (qualityScore >= 80) return 'Excellent quality';
    return 'Good quality';
  }

  // Balanced strategy
  const avgScore = (costScore + speedScore + qualityScore) / 3;
  if (avgScore >= 80) return 'Best overall balance';
  if (avgScore >= 60) return 'Good balance of cost/speed/quality';
  return 'Meets requirements';
}

/**
 * Filter models by hard requirements only.
 */
export function filterByRequirements(
  availableModels: BackendModel[],
  requirements: CapabilityRequirements['required']
): BackendModel[] {
  if (!requirements) return availableModels;

  return availableModels.filter(({ model }) => {
    const capabilities = model.capabilities || inferCapabilities(model.id, model.metadata);
    return meetsRequirements(capabilities, requirements);
  });
}

/**
 * Find the best model match for requirements.
 * Returns null if no models meet requirements.
 */
export function findBestModel(
  requirements: CapabilityRequirements,
  availableModels: BackendModel[]
): ScoredModel | null {
  const scored = matchModels(requirements, availableModels);
  const best = scored.find((m) => m.meetsRequirements);
  return best || null;
}

/**
 * Get top N model matches.
 */
export function getTopMatches(
  requirements: CapabilityRequirements,
  availableModels: BackendModel[],
  count: number = 3
): ScoredModel[] {
  const scored = matchModels(requirements, availableModels);
  return scored.filter((m) => m.meetsRequirements).slice(0, count);
}
