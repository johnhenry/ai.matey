/**
 * Tests for Capability Matcher
 */

import { describe, it, expect } from 'vitest';
import {
  matchModels,
  findBestModel,
  getTopMatches,
  filterByRequirements,
  type CapabilityRequirements,
  type BackendModel,
  type ScoredModel,
} from '../../src/core/capability-matcher.js';
import type { AIModel } from '../../src/types/models.js';

describe('Capability Matcher', () => {
  // Sample models for testing
  const cheapFastModel: AIModel = {
    id: 'fast-cheap-1',
    name: 'Fast Cheap Model',
    capabilities: {
      contextWindow: 8000,
      maxTokens: 2000,
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: false,
      supportsJSON: true,
      pricing: { input: 0.0001, output: 0.0002 },
      latency: { p50: 500, p95: 800 },
      qualityScore: 60, // Lower quality
    },
  };

  const expensiveQualityModel: AIModel = {
    id: 'quality-1',
    name: 'High Quality Model',
    capabilities: {
      contextWindow: 200000,
      maxTokens: 8000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
      pricing: { input: 0.01, output: 0.03 },
      latency: { p50: 2000, p95: 4000 },
      qualityScore: 95,
    },
  };

  const balancedModel: AIModel = {
    id: 'balanced-1',
    name: 'Balanced Model',
    capabilities: {
      contextWindow: 100000,
      maxTokens: 4000,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
      pricing: { input: 0.003, output: 0.015 },
      latency: { p50: 1500, p95: 3000 },
      qualityScore: 85,
    },
  };

  const availableModels: BackendModel[] = [
    { model: cheapFastModel, backend: 'backend-a' },
    { model: expensiveQualityModel, backend: 'backend-b' },
    { model: balancedModel, backend: 'backend-c' },
  ];

  describe('matchModels', () => {
    it('should score all models with balanced optimization', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'balanced',
      };

      const scored = matchModels(requirements, availableModels);

      expect(scored).toHaveLength(3);
      expect(scored[0]!.score).toBeGreaterThanOrEqual(0);
      expect(scored[0]!.score).toBeLessThanOrEqual(100);
      expect(scored[0]!.breakdown).toHaveProperty('costScore');
      expect(scored[0]!.breakdown).toHaveProperty('speedScore');
      expect(scored[0]!.breakdown).toHaveProperty('qualityScore');
    });

    it('should prioritize cheap models with cost optimization', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'cost',
      };

      const scored = matchModels(requirements, availableModels);

      // Cheap model should score highest
      expect(scored[0]!.backend).toBe('backend-a');
      expect(scored[0]!.breakdown.costScore).toBeGreaterThan(scored[1]!.breakdown.costScore);
    });

    it('should prioritize fast models with speed optimization', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'speed',
      };

      const scored = matchModels(requirements, availableModels);

      // Fast model should score highest
      expect(scored[0]!.backend).toBe('backend-a');
      expect(scored[0]!.breakdown.speedScore).toBeGreaterThan(scored[1]!.breakdown.speedScore);
    });

    it('should prioritize quality models with quality optimization', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'quality',
      };

      const scored = matchModels(requirements, availableModels);

      // Quality model should score highest
      expect(scored[0]!.backend).toBe('backend-b');
      expect(scored[0]!.breakdown.qualityScore).toBeGreaterThan(scored[1]!.breakdown.qualityScore);
    });

    it('should respect custom optimization weights', () => {
      const requirements: CapabilityRequirements = {
        weights: {
          cost: 0.8,
          speed: 0.1,
          quality: 0.1,
        },
      };

      const scored = matchModels(requirements, availableModels);

      // Should heavily favor cheap model
      expect(scored[0]!.backend).toBe('backend-a');
    });

    it('should filter by hard requirements', () => {
      const requirements: CapabilityRequirements = {
        required: {
          supportsVision: true,
          contextWindow: 100000,
        },
      };

      const scored = matchModels(requirements, availableModels);

      // Only models with vision and large context should meet requirements
      const meetingReqs = scored.filter(s => s.meetsRequirements);
      expect(meetingReqs).toHaveLength(2); // balanced and quality
      expect(meetingReqs.every(s => s.model.capabilities?.supportsVision)).toBe(true);
    });

    it('should prioritize models meeting requirements', () => {
      const requirements: CapabilityRequirements = {
        required: {
          supportsTools: true,
        },
        optimization: 'cost',
      };

      const scored = matchModels(requirements, availableModels);

      // Models meeting requirements should come first
      expect(scored[0]!.meetsRequirements).toBe(true);
      const firstNonMeeting = scored.findIndex(s => !s.meetsRequirements);
      if (firstNonMeeting >= 0) {
        expect(firstNonMeeting).toBeGreaterThan(0);
      }
    });

    it('should apply preferred requirements to scoring', () => {
      const requirements: CapabilityRequirements = {
        preferred: {
          maxCostPer1kTokens: 0.005,
          maxLatencyMs: 2000,
          minQualityScore: 80,
        },
        optimization: 'balanced',
      };

      const scored = matchModels(requirements, availableModels);

      expect(scored).toHaveLength(3);
      // Models closer to preferred values should score higher
      expect(scored[0]!.score).toBeGreaterThan(0);
    });
  });

  describe('findBestModel', () => {
    it('should return best matching model', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'cost',
      };

      const best = findBestModel(requirements, availableModels);

      expect(best).not.toBeNull();
      expect(best!.backend).toBe('backend-a'); // cheapest model
      expect(best!.meetsRequirements).toBe(true);
    });

    it('should return null if no models meet requirements', () => {
      const requirements: CapabilityRequirements = {
        required: {
          supportsVision: true,
          supportsTools: true,
          contextWindow: 500000, // None have this
        },
      };

      const best = findBestModel(requirements, availableModels);

      expect(best).toBeNull();
    });

    it('should return best model meeting all requirements', () => {
      const requirements: CapabilityRequirements = {
        required: {
          supportsVision: true,
          supportsTools: true,
        },
        optimization: 'cost',
      };

      const best = findBestModel(requirements, availableModels);

      expect(best).not.toBeNull();
      expect(best!.model.capabilities?.supportsVision).toBe(true);
      expect(best!.model.capabilities?.supportsTools).toBe(true);
      // Should be the cheaper of the two models with these capabilities
      expect(best!.backend).toBe('backend-c'); // balanced model
    });
  });

  describe('getTopMatches', () => {
    it('should return top N matches', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'balanced',
      };

      const top = getTopMatches(requirements, availableModels, 2);

      expect(top).toHaveLength(2);
      expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score);
    });

    it('should only return models meeting requirements', () => {
      const requirements: CapabilityRequirements = {
        required: {
          supportsVision: true,
        },
      };

      const top = getTopMatches(requirements, availableModels, 5);

      expect(top.length).toBeLessThanOrEqual(2); // Only 2 models have vision
      expect(top.every(m => m.meetsRequirements)).toBe(true);
      expect(top.every(m => m.model.capabilities?.supportsVision)).toBe(true);
    });

    it('should default to 3 matches if count not specified', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'balanced',
      };

      const top = getTopMatches(requirements, availableModels);

      expect(top.length).toBeLessThanOrEqual(3);
    });
  });

  describe('filterByRequirements', () => {
    it('should filter models by boolean requirements', () => {
      const filtered = filterByRequirements(availableModels, {
        supportsVision: true,
        supportsTools: true,
      });

      expect(filtered).toHaveLength(2); // balanced and quality
      expect(filtered.every(m => m.model.capabilities?.supportsVision)).toBe(true);
      expect(filtered.every(m => m.model.capabilities?.supportsTools)).toBe(true);
    });

    it('should filter models by context window', () => {
      const filtered = filterByRequirements(availableModels, {
        contextWindow: 100000,
      });

      expect(filtered).toHaveLength(2); // balanced and quality
      expect(filtered.every(m => m.model.capabilities!.contextWindow! >= 100000)).toBe(true);
    });

    it('should filter models by max tokens', () => {
      const filtered = filterByRequirements(availableModels, {
        maxTokens: 4000,
      });

      expect(filtered).toHaveLength(2); // balanced and quality
      expect(filtered.every(m => m.model.capabilities!.maxTokens! >= 4000)).toBe(true);
    });

    it('should return all models if no requirements specified', () => {
      const filtered = filterByRequirements(availableModels, undefined);

      expect(filtered).toHaveLength(3);
    });

    it('should handle multiple requirements', () => {
      const filtered = filterByRequirements(availableModels, {
        supportsStreaming: true,
        supportsJSON: true,
        contextWindow: 50000,
      });

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(m => {
        const caps = m.model.capabilities;
        return caps?.supportsStreaming === true &&
               caps?.supportsJSON === true &&
               caps?.contextWindow! >= 50000;
      })).toBe(true);
    });
  });

  describe('Match Reasons', () => {
    it('should provide meaningful match reason for cost optimization', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'cost',
      };

      const scored = matchModels(requirements, availableModels);

      expect(scored[0]!.matchReason).toBeDefined();
      expect(typeof scored[0]!.matchReason).toBe('string');
      expect(scored[0]!.matchReason.length).toBeGreaterThan(0);
    });

    it('should provide meaningful match reason for quality optimization', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'quality',
      };

      const scored = matchModels(requirements, availableModels);

      expect(scored[0]!.matchReason).toBeDefined();
      expect(scored[0]!.matchReason).toMatch(/quality/i);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty model list', () => {
      const requirements: CapabilityRequirements = {
        optimization: 'balanced',
      };

      const scored = matchModels(requirements, []);

      expect(scored).toHaveLength(0);
    });

    it('should handle models without capabilities', () => {
      const modelWithoutCaps: BackendModel = {
        model: {
          id: 'no-caps',
          name: 'No Capabilities Model',
        },
        backend: 'backend-d',
      };

      const requirements: CapabilityRequirements = {
        optimization: 'balanced',
      };

      const scored = matchModels(requirements, [modelWithoutCaps]);

      expect(scored).toHaveLength(1);
      // Should still score it (with neutral scores)
      expect(scored[0]!.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle models with partial capabilities', () => {
      const partialModel: BackendModel = {
        model: {
          id: 'partial',
          name: 'Partial Model',
          capabilities: {
            contextWindow: 8000,
            supportsStreaming: true,
            // Missing pricing, latency, quality
          },
        },
        backend: 'backend-e',
      };

      const requirements: CapabilityRequirements = {
        optimization: 'cost',
      };

      const scored = matchModels(requirements, [partialModel]);

      expect(scored).toHaveLength(1);
      expect(scored[0]!.score).toBeGreaterThanOrEqual(0);
    });
  });
});
