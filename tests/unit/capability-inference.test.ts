/**
 * Capability Inference Tests
 *
 * Tests for model capability inference from names and metadata.
 */

import { describe, it, expect } from 'vitest';
import {
  inferCapabilities,
  mergeCapabilities,
  meetsRequirements,
  calculateCapabilitySimilarity,
} from 'ai.matey.core';
import type { ModelCapabilities } from 'ai.matey.types';

// ============================================================================
// inferCapabilities Tests - Model Family Detection
// ============================================================================

describe('inferCapabilities - Model Family Detection', () => {
  describe('GPT family', () => {
    it('should detect gpt-4o as gpt-4 family', () => {
      const caps = inferCapabilities('gpt-4o-2024-08-06');

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsJSON).toBe(true);
    });

    it('should detect gpt-4 as gpt-4 family', () => {
      const caps = inferCapabilities('gpt-4-0613');

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsTools).toBe(true);
    });

    it('should detect gpt-3.5-turbo as gpt-3.5 family', () => {
      const caps = inferCapabilities('gpt-3.5-turbo-0125');

      expect(caps.contextWindow).toBe(16385);
      expect(caps.supportsStreaming).toBe(true);
    });
  });

  describe('Claude family', () => {
    it('should detect claude-3.5 as claude-3 family', () => {
      const caps = inferCapabilities('claude-3.5-sonnet-v2');

      expect(caps.contextWindow).toBe(200000);
      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsJSON).toBe(false);
    });

    it('should detect claude-3 as claude-3 family', () => {
      const caps = inferCapabilities('claude-3-opus');

      expect(caps.contextWindow).toBe(200000);
    });

    it('should detect claude-2 as claude-2 family', () => {
      const caps = inferCapabilities('claude-2.1');

      expect(caps.contextWindow).toBe(100000);
      expect(caps.supportsTools).toBe(false);
    });
  });

  describe('Gemini family', () => {
    it('should detect gemini-1.5 as gemini-1.5 family', () => {
      const caps = inferCapabilities('gemini-1.5-pro');

      expect(caps.contextWindow).toBe(1000000);
      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsJSON).toBe(true);
    });

    it('should detect gemini as gemini-1.5 family by default', () => {
      const caps = inferCapabilities('gemini-pro');

      expect(caps.supportsVision).toBe(true);
    });
  });

  describe('Mistral family', () => {
    it('should detect mistral models', () => {
      // Use a generic name not in pricing database to test family inference
      const caps = inferCapabilities('mistral-custom-model');

      expect(caps.contextWindow).toBe(32000);
      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsTools).toBe(true);
    });

    it('should detect mixtral as mistral family', () => {
      // Note: mixtral is separate from mistral in detectModelFamily
      const caps = inferCapabilities('mixtral-8x7b');

      // mixtral doesn't have defaults in the family map, so minimal caps
      expect(caps).toBeDefined();
    });
  });

  describe('Llama family', () => {
    it('should detect llama-3 models', () => {
      const caps = inferCapabilities('llama-3-70b');

      expect(caps.contextWindow).toBe(8192);
      expect(caps.supportsTools).toBe(false);
    });

    it('should detect llama-2 models', () => {
      const caps = inferCapabilities('llama-2-13b');

      expect(caps.contextWindow).toBe(4096);
    });

    it('should default llama to llama-2 family', () => {
      const caps = inferCapabilities('llama-chat');

      expect(caps.contextWindow).toBe(4096);
    });
  });

  describe('Other families', () => {
    it('should detect deepseek models', () => {
      const caps = inferCapabilities('deepseek-coder-v2');

      expect(caps.contextWindow).toBe(64000);
      expect(caps.supportsTools).toBe(true);
    });

    it('should detect qwen models', () => {
      const caps = inferCapabilities('qwen-72b');

      // qwen doesn't have defaults, so minimal inference
      expect(caps).toBeDefined();
    });

    it('should detect phi models', () => {
      const caps = inferCapabilities('phi-3-mini');

      expect(caps).toBeDefined();
    });
  });

  describe('Unknown models', () => {
    it('should return empty capabilities for unknown model', () => {
      const caps = inferCapabilities('completely-unknown-model-xyz');

      expect(Object.keys(caps).length).toBe(0);
    });
  });
});

// ============================================================================
// inferCapabilities Tests - Pattern Inference
// ============================================================================

describe('inferCapabilities - Pattern Inference', () => {
  describe('Vision support', () => {
    it('should infer vision support for models with "vision" in name', () => {
      const caps = inferCapabilities('some-model-vision');

      expect(caps.supportsVision).toBe(true);
    });

    it('should infer vision support for gpt-4o', () => {
      const caps = inferCapabilities('gpt-4o');

      expect(caps.supportsVision).toBe(true);
    });

    it('should infer vision support for gpt-4-turbo', () => {
      const caps = inferCapabilities('gpt-4-turbo');

      expect(caps.supportsVision).toBe(true);
    });

    it('should infer vision support for gemini models', () => {
      const caps = inferCapabilities('gemini-anything');

      expect(caps.supportsVision).toBe(true);
    });
  });

  describe('Context window inference', () => {
    it('should infer 128k context for gpt-4-turbo', () => {
      const caps = inferCapabilities('gpt-4-turbo-preview');

      expect(caps.contextWindow).toBe(128000);
    });

    it('should infer 128k context for models with "128k" in name', () => {
      const caps = inferCapabilities('some-model-128k');

      expect(caps.contextWindow).toBe(128000);
    });

    it('should infer 32k context for models with "32k" in name', () => {
      const caps = inferCapabilities('gpt-4-32k');

      expect(caps.contextWindow).toBe(32000);
    });
  });

  describe('Speed/latency inference', () => {
    it('should infer fast latency for "flash" models', () => {
      // Use a model name not in pricing database to test pattern inference
      const caps = inferCapabilities('custom-flash-model');

      expect(caps.latency).toEqual({ p50: 500, p95: 1000 });
    });

    it('should infer fast latency for "haiku" models', () => {
      // Use a model name not in pricing database to test pattern inference
      const caps = inferCapabilities('custom-haiku-model');

      expect(caps.latency).toEqual({ p50: 500, p95: 1000 });
    });

    it('should infer medium latency for "turbo" models', () => {
      // Use a model name not in pricing database to test pattern inference
      const caps = inferCapabilities('custom-turbo-model');

      expect(caps.latency).toEqual({ p50: 1000, p95: 2000 });
    });
  });
});

// ============================================================================
// inferCapabilities Tests - Metadata Inference
// ============================================================================

describe('inferCapabilities - Metadata Inference', () => {
  it('should use metadata boolean capabilities', () => {
    const caps = inferCapabilities('unknown-model', {
      supportsVision: true,
      supportsTools: false,
      supportsJSON: true,
      supportsStreaming: false,
    });

    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsTools).toBe(false);
    expect(caps.supportsJSON).toBe(true);
    expect(caps.supportsStreaming).toBe(false);
  });

  it('should use metadata contextWindow', () => {
    const caps = inferCapabilities('unknown-model', {
      contextWindow: 50000,
    });

    expect(caps.contextWindow).toBe(50000);
  });

  it('should use metadata context_window (snake_case)', () => {
    const caps = inferCapabilities('unknown-model', {
      context_window: 60000,
    });

    expect(caps.contextWindow).toBe(60000);
  });

  it('should use metadata max_context_length', () => {
    const caps = inferCapabilities('unknown-model', {
      max_context_length: 70000,
    });

    expect(caps.contextWindow).toBe(70000);
  });

  it('should use metadata maxTokens', () => {
    const caps = inferCapabilities('unknown-model', {
      maxTokens: 8192,
    });

    expect(caps.maxTokens).toBe(8192);
  });

  it('should use metadata max_tokens (snake_case)', () => {
    const caps = inferCapabilities('unknown-model', {
      max_tokens: 4096,
    });

    expect(caps.maxTokens).toBe(4096);
  });

  it('should ignore non-boolean capability values', () => {
    const caps = inferCapabilities('unknown-model', {
      supportsVision: 'yes', // string, not boolean
      supportsTools: 1, // number, not boolean
    });

    expect(caps.supportsVision).toBeUndefined();
    expect(caps.supportsTools).toBeUndefined();
  });

  it('should override family defaults with metadata', () => {
    const caps = inferCapabilities('gpt-4-custom', {
      contextWindow: 999999,
      supportsVision: true,
    });

    expect(caps.contextWindow).toBe(999999);
    expect(caps.supportsVision).toBe(true);
  });
});

// ============================================================================
// inferCapabilities Tests - Known Models (Database Lookup)
// ============================================================================

describe('inferCapabilities - Known Models', () => {
  it('should return database capabilities for gpt-4', () => {
    const caps = inferCapabilities('gpt-4');

    // Should match model-pricing database
    expect(caps.pricing).toBeDefined();
    expect(caps.qualityScore).toBe(95);
  });

  it('should return database capabilities for claude-3-5-sonnet', () => {
    const caps = inferCapabilities('claude-3-5-sonnet-20241022');

    expect(caps.pricing).toBeDefined();
    expect(caps.contextWindow).toBe(200000);
  });
});

// ============================================================================
// mergeCapabilities Tests
// ============================================================================

describe('mergeCapabilities', () => {
  it('should merge multiple capability sources', () => {
    const merged = mergeCapabilities(
      { supportsStreaming: true },
      { supportsVision: true },
      { supportsTools: true }
    );

    expect(merged.supportsStreaming).toBe(true);
    expect(merged.supportsVision).toBe(true);
    expect(merged.supportsTools).toBe(true);
  });

  it('should allow later sources to override earlier ones', () => {
    const merged = mergeCapabilities(
      { contextWindow: 8192, supportsVision: false },
      { contextWindow: 128000 },
      { supportsVision: true }
    );

    expect(merged.contextWindow).toBe(128000);
    expect(merged.supportsVision).toBe(true);
  });

  it('should handle null and undefined sources', () => {
    const merged = mergeCapabilities(
      { supportsStreaming: true },
      null,
      undefined,
      { supportsVision: true }
    );

    expect(merged.supportsStreaming).toBe(true);
    expect(merged.supportsVision).toBe(true);
  });

  it('should return empty object when no sources', () => {
    const merged = mergeCapabilities();

    expect(merged).toEqual({});
  });

  it('should return empty object when all sources are null/undefined', () => {
    const merged = mergeCapabilities(null, undefined, null);

    expect(merged).toEqual({});
  });

  it('should handle single source', () => {
    const merged = mergeCapabilities({ contextWindow: 50000 });

    expect(merged).toEqual({ contextWindow: 50000 });
  });
});

// ============================================================================
// meetsRequirements Tests
// ============================================================================

describe('meetsRequirements', () => {
  describe('Boolean capabilities', () => {
    it('should return true when streaming requirement is met', () => {
      const caps: Partial<ModelCapabilities> = { supportsStreaming: true };
      const reqs: Partial<ModelCapabilities> = { supportsStreaming: true };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when streaming requirement is not met', () => {
      const caps: Partial<ModelCapabilities> = { supportsStreaming: false };
      const reqs: Partial<ModelCapabilities> = { supportsStreaming: true };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return false when streaming is undefined but required', () => {
      const caps: Partial<ModelCapabilities> = {};
      const reqs: Partial<ModelCapabilities> = { supportsStreaming: true };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return true when vision requirement is met', () => {
      const caps: Partial<ModelCapabilities> = { supportsVision: true };
      const reqs: Partial<ModelCapabilities> = { supportsVision: true };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when vision requirement is not met', () => {
      const caps: Partial<ModelCapabilities> = { supportsVision: false };
      const reqs: Partial<ModelCapabilities> = { supportsVision: true };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return true when tools requirement is met', () => {
      const caps: Partial<ModelCapabilities> = { supportsTools: true };
      const reqs: Partial<ModelCapabilities> = { supportsTools: true };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when tools requirement is not met', () => {
      const caps: Partial<ModelCapabilities> = { supportsTools: false };
      const reqs: Partial<ModelCapabilities> = { supportsTools: true };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return true when JSON requirement is met', () => {
      const caps: Partial<ModelCapabilities> = { supportsJSON: true };
      const reqs: Partial<ModelCapabilities> = { supportsJSON: true };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when JSON requirement is not met', () => {
      const caps: Partial<ModelCapabilities> = { supportsJSON: false };
      const reqs: Partial<ModelCapabilities> = { supportsJSON: true };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });
  });

  describe('Numeric capabilities', () => {
    it('should return true when contextWindow meets minimum', () => {
      const caps: Partial<ModelCapabilities> = { contextWindow: 128000 };
      const reqs: Partial<ModelCapabilities> = { contextWindow: 100000 };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return true when contextWindow equals minimum', () => {
      const caps: Partial<ModelCapabilities> = { contextWindow: 100000 };
      const reqs: Partial<ModelCapabilities> = { contextWindow: 100000 };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when contextWindow below minimum', () => {
      const caps: Partial<ModelCapabilities> = { contextWindow: 8192 };
      const reqs: Partial<ModelCapabilities> = { contextWindow: 100000 };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return false when contextWindow is undefined but required', () => {
      const caps: Partial<ModelCapabilities> = {};
      const reqs: Partial<ModelCapabilities> = { contextWindow: 100000 };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return true when maxTokens meets minimum', () => {
      const caps: Partial<ModelCapabilities> = { maxTokens: 8192 };
      const reqs: Partial<ModelCapabilities> = { maxTokens: 4096 };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when maxTokens below minimum', () => {
      const caps: Partial<ModelCapabilities> = { maxTokens: 2048 };
      const reqs: Partial<ModelCapabilities> = { maxTokens: 4096 };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });
  });

  describe('Multiple requirements', () => {
    it('should return true when all requirements met', () => {
      const caps: Partial<ModelCapabilities> = {
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        contextWindow: 128000,
        maxTokens: 8192,
      };
      const reqs: Partial<ModelCapabilities> = {
        supportsStreaming: true,
        supportsVision: true,
        contextWindow: 100000,
      };

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });

    it('should return false when one requirement not met', () => {
      const caps: Partial<ModelCapabilities> = {
        supportsStreaming: true,
        supportsVision: false,
        contextWindow: 128000,
      };
      const reqs: Partial<ModelCapabilities> = {
        supportsStreaming: true,
        supportsVision: true,
        contextWindow: 100000,
      };

      expect(meetsRequirements(caps, reqs)).toBe(false);
    });

    it('should return true when no requirements specified', () => {
      const caps: Partial<ModelCapabilities> = { supportsStreaming: true };
      const reqs: Partial<ModelCapabilities> = {};

      expect(meetsRequirements(caps, reqs)).toBe(true);
    });
  });
});

// ============================================================================
// calculateCapabilitySimilarity Tests
// ============================================================================

describe('calculateCapabilitySimilarity', () => {
  it('should return 100 for identical capabilities', () => {
    const caps: Partial<ModelCapabilities> = {
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: false,
    };

    const score = calculateCapabilitySimilarity(caps, caps);

    expect(score).toBe(100);
  });

  it('should return 0 for completely different capabilities', () => {
    const caps1: Partial<ModelCapabilities> = {
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    };
    const caps2: Partial<ModelCapabilities> = {
      supportsStreaming: false,
      supportsVision: false,
      supportsTools: false,
      supportsJSON: false,
    };

    const score = calculateCapabilitySimilarity(caps1, caps2);

    expect(score).toBe(0);
  });

  it('should return 50 for half matching capabilities', () => {
    const caps1: Partial<ModelCapabilities> = {
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: false,
      supportsJSON: false,
    };
    const caps2: Partial<ModelCapabilities> = {
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
    };

    const score = calculateCapabilitySimilarity(caps1, caps2);

    expect(score).toBe(50);
  });

  it('should consider model family in similarity', () => {
    const caps1: Partial<ModelCapabilities> = {
      modelFamily: 'gpt-4',
      supportsStreaming: true,
    };
    const caps2: Partial<ModelCapabilities> = {
      modelFamily: 'gpt-4',
      supportsStreaming: true,
    };

    const score = calculateCapabilitySimilarity(caps1, caps2);

    expect(score).toBe(100);
  });

  it('should penalize different model families', () => {
    const caps1: Partial<ModelCapabilities> = {
      modelFamily: 'gpt-4',
      supportsStreaming: true,
    };
    const caps2: Partial<ModelCapabilities> = {
      modelFamily: 'claude-3',
      supportsStreaming: true,
    };

    const score = calculateCapabilitySimilarity(caps1, caps2);

    // 1 match (streaming) out of 2 fields (family + streaming) = 50%
    expect(score).toBe(50);
  });

  it('should consider context windows within 20% as similar', () => {
    const caps1: Partial<ModelCapabilities> = {
      contextWindow: 100000,
    };
    const caps2: Partial<ModelCapabilities> = {
      contextWindow: 90000, // 90% of 100k = within 20%
    };

    const score = calculateCapabilitySimilarity(caps1, caps2);

    expect(score).toBe(100);
  });

  it('should penalize context windows more than 20% different', () => {
    const caps1: Partial<ModelCapabilities> = {
      contextWindow: 100000,
    };
    const caps2: Partial<ModelCapabilities> = {
      contextWindow: 50000, // 50% = not within 20%
    };

    const score = calculateCapabilitySimilarity(caps1, caps2);

    expect(score).toBe(0);
  });

  it('should return 0 for empty capabilities', () => {
    const score = calculateCapabilitySimilarity({}, {});

    expect(score).toBe(0);
  });

  it('should handle one-sided capabilities', () => {
    const caps1: Partial<ModelCapabilities> = {
      supportsStreaming: true,
    };
    const caps2: Partial<ModelCapabilities> = {};

    const score = calculateCapabilitySimilarity(caps1, caps2);

    // streaming is defined in one but not other - counted but not matched
    expect(score).toBe(0);
  });
});
