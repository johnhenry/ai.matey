/**
 * Model Pricing Tests
 *
 * Tests for model pricing registry and override functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getModelPricing,
  getModelCapabilities,
  getAllPricedModels,
  getModelsByFamily,
  setPricingOverride,
  clearPricingOverride,
  clearAllPricingOverrides,
  getPricingWithOverrides,
} from 'ai.matey.core';

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  // Clear all overrides before each test
  clearAllPricingOverrides();
});

// ============================================================================
// getModelPricing Tests
// ============================================================================

describe('getModelPricing', () => {
  it('should return pricing for known OpenAI models', () => {
    const pricing = getModelPricing('gpt-4');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.03);
    expect(pricing?.output).toBe(0.06);
  });

  it('should return pricing for gpt-4-turbo', () => {
    const pricing = getModelPricing('gpt-4-turbo');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.01);
    expect(pricing?.output).toBe(0.03);
  });

  it('should return pricing for gpt-3.5-turbo', () => {
    const pricing = getModelPricing('gpt-3.5-turbo');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.0005);
    expect(pricing?.output).toBe(0.0015);
  });

  it('should return pricing for gpt-4o', () => {
    const pricing = getModelPricing('gpt-4o');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.005);
    expect(pricing?.output).toBe(0.015);
  });

  it('should return pricing for gpt-4o-mini', () => {
    const pricing = getModelPricing('gpt-4o-mini');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.00015);
    expect(pricing?.output).toBe(0.0006);
  });

  it('should return pricing for known Anthropic models', () => {
    const pricing = getModelPricing('claude-3-5-sonnet-20241022');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.003);
    expect(pricing?.output).toBe(0.015);
  });

  it('should return pricing for claude-3-opus', () => {
    const pricing = getModelPricing('claude-3-opus-20240229');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.015);
    expect(pricing?.output).toBe(0.075);
  });

  it('should return pricing for claude-3-haiku', () => {
    const pricing = getModelPricing('claude-3-haiku-20240307');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.00025);
    expect(pricing?.output).toBe(0.00125);
  });

  it('should return pricing for Gemini models', () => {
    const pricing = getModelPricing('gemini-1.5-pro');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.00125);
    expect(pricing?.output).toBe(0.005);
  });

  it('should return pricing for Mistral models', () => {
    const pricing = getModelPricing('mistral-large-latest');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.002);
    expect(pricing?.output).toBe(0.006);
  });

  it('should return pricing for DeepSeek models', () => {
    const pricing = getModelPricing('deepseek-chat');

    expect(pricing).not.toBeNull();
    expect(pricing?.input).toBe(0.00014);
    expect(pricing?.output).toBe(0.00028);
  });

  it('should return null for unknown model', () => {
    const pricing = getModelPricing('unknown-model-xyz');

    expect(pricing).toBeNull();
  });

  it('should return null for empty string', () => {
    const pricing = getModelPricing('');

    expect(pricing).toBeNull();
  });
});

// ============================================================================
// getModelCapabilities Tests
// ============================================================================

describe('getModelCapabilities', () => {
  it('should return extended capabilities for known model', () => {
    const caps = getModelCapabilities('gpt-4');

    expect(caps).not.toBeNull();
    expect(caps?.pricing).toEqual({ input: 0.03, output: 0.06 });
    expect(caps?.latency).toEqual({ p50: 2000, p95: 4000 });
    expect(caps?.qualityScore).toBe(95);
    expect(caps?.modelFamily).toBe('gpt-4');
    expect(caps?.releaseDate).toBe('2023-03-14');
    expect(caps?.contextWindow).toBe(8192);
  });

  it('should return vision support info', () => {
    const gpt4 = getModelCapabilities('gpt-4');
    const gpt4Turbo = getModelCapabilities('gpt-4-turbo');

    expect(gpt4?.supportsVision).toBe(false);
    expect(gpt4Turbo?.supportsVision).toBe(true);
  });

  it('should return tools support info', () => {
    const caps = getModelCapabilities('claude-3-5-sonnet-20241022');

    expect(caps?.supportsTools).toBe(true);
  });

  it('should return JSON support info', () => {
    const openai = getModelCapabilities('gpt-4');
    const anthropic = getModelCapabilities('claude-3-5-sonnet-20241022');

    expect(openai?.supportsJSON).toBe(true);
    expect(anthropic?.supportsJSON).toBe(false);
  });

  it('should return null for unknown model', () => {
    const caps = getModelCapabilities('unknown-model');

    expect(caps).toBeNull();
  });

  it('should return large context windows for modern models', () => {
    const gpt4o = getModelCapabilities('gpt-4o');
    const claude = getModelCapabilities('claude-3-5-sonnet-20241022');
    const gemini = getModelCapabilities('gemini-1.5-pro');

    expect(gpt4o?.contextWindow).toBe(128000);
    expect(claude?.contextWindow).toBe(200000);
    expect(gemini?.contextWindow).toBe(1000000);
  });
});

// ============================================================================
// getAllPricedModels Tests
// ============================================================================

describe('getAllPricedModels', () => {
  it('should return array of model IDs', () => {
    const models = getAllPricedModels();

    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it('should include OpenAI models', () => {
    const models = getAllPricedModels();

    expect(models).toContain('gpt-4');
    expect(models).toContain('gpt-4-turbo');
    expect(models).toContain('gpt-3.5-turbo');
    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4o-mini');
  });

  it('should include Anthropic models', () => {
    const models = getAllPricedModels();

    expect(models).toContain('claude-3-5-sonnet-20241022');
    expect(models).toContain('claude-3-opus-20240229');
    expect(models).toContain('claude-3-haiku-20240307');
  });

  it('should include Gemini models', () => {
    const models = getAllPricedModels();

    expect(models).toContain('gemini-1.5-pro');
    expect(models).toContain('gemini-1.5-flash');
  });

  it('should include Mistral models', () => {
    const models = getAllPricedModels();

    expect(models).toContain('mistral-large-latest');
    expect(models).toContain('mistral-small-latest');
  });

  it('should include DeepSeek models', () => {
    const models = getAllPricedModels();

    expect(models).toContain('deepseek-chat');
    expect(models).toContain('deepseek-coder');
  });
});

// ============================================================================
// getModelsByFamily Tests
// ============================================================================

describe('getModelsByFamily', () => {
  it('should return GPT-4 family models', () => {
    const models = getModelsByFamily('gpt-4');

    expect(models).toContain('gpt-4');
    expect(models).toContain('gpt-4-turbo');
    expect(models).toContain('gpt-4-turbo-preview');
    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4o-mini');
  });

  it('should return GPT-3.5 family models', () => {
    const models = getModelsByFamily('gpt-3.5');

    expect(models).toContain('gpt-3.5-turbo');
  });

  it('should return Claude-3 family models', () => {
    const models = getModelsByFamily('claude-3');

    expect(models).toContain('claude-3-5-sonnet-20241022');
    expect(models).toContain('claude-3-opus-20240229');
    expect(models).toContain('claude-3-sonnet-20240229');
    expect(models).toContain('claude-3-haiku-20240307');
    expect(models).toContain('claude-3-5-haiku-20241022');
  });

  it('should return Gemini 1.5 family models', () => {
    const models = getModelsByFamily('gemini-1.5');

    expect(models).toContain('gemini-1.5-pro');
    expect(models).toContain('gemini-1.5-flash');
    expect(models).toContain('gemini-1.5-flash-8b');
  });

  it('should return Mistral family models', () => {
    const models = getModelsByFamily('mistral');

    expect(models).toContain('mistral-large-latest');
    expect(models).toContain('mistral-medium-latest');
    expect(models).toContain('mistral-small-latest');
  });

  it('should return DeepSeek family models', () => {
    const models = getModelsByFamily('deepseek');

    expect(models).toContain('deepseek-chat');
    expect(models).toContain('deepseek-coder');
  });

  it('should return empty array for unknown family', () => {
    const models = getModelsByFamily('unknown-family');

    expect(models).toHaveLength(0);
  });
});

// ============================================================================
// Pricing Override Tests
// ============================================================================

describe('setPricingOverride', () => {
  it('should set custom pricing for a model', () => {
    setPricingOverride('custom-model', { input: 0.1, output: 0.2 });

    const pricing = getPricingWithOverrides('custom-model');

    expect(pricing).toEqual({ input: 0.1, output: 0.2 });
  });

  it('should override existing database pricing', () => {
    const originalPricing = getModelPricing('gpt-4');
    expect(originalPricing?.input).toBe(0.03);

    setPricingOverride('gpt-4', { input: 0.05, output: 0.10 });

    const overriddenPricing = getPricingWithOverrides('gpt-4');

    expect(overriddenPricing?.input).toBe(0.05);
    expect(overriddenPricing?.output).toBe(0.10);
  });

  it('should allow updating an override', () => {
    setPricingOverride('test-model', { input: 0.1, output: 0.2 });
    setPricingOverride('test-model', { input: 0.3, output: 0.4 });

    const pricing = getPricingWithOverrides('test-model');

    expect(pricing?.input).toBe(0.3);
    expect(pricing?.output).toBe(0.4);
  });
});

describe('clearPricingOverride', () => {
  it('should clear specific override', () => {
    setPricingOverride('model-1', { input: 0.1, output: 0.2 });
    setPricingOverride('model-2', { input: 0.3, output: 0.4 });

    clearPricingOverride('model-1');

    expect(getPricingWithOverrides('model-1')).toBeNull();
    expect(getPricingWithOverrides('model-2')).toEqual({ input: 0.3, output: 0.4 });
  });

  it('should restore database pricing after clearing override', () => {
    const original = getModelPricing('gpt-4');
    setPricingOverride('gpt-4', { input: 0.99, output: 0.99 });

    clearPricingOverride('gpt-4');

    const restored = getPricingWithOverrides('gpt-4');
    expect(restored).toEqual(original);
  });

  it('should not error when clearing non-existent override', () => {
    expect(() => clearPricingOverride('non-existent')).not.toThrow();
  });
});

describe('clearAllPricingOverrides', () => {
  it('should clear all overrides', () => {
    setPricingOverride('model-1', { input: 0.1, output: 0.2 });
    setPricingOverride('model-2', { input: 0.3, output: 0.4 });
    setPricingOverride('model-3', { input: 0.5, output: 0.6 });

    clearAllPricingOverrides();

    expect(getPricingWithOverrides('model-1')).toBeNull();
    expect(getPricingWithOverrides('model-2')).toBeNull();
    expect(getPricingWithOverrides('model-3')).toBeNull();
  });

  it('should restore all database pricing', () => {
    setPricingOverride('gpt-4', { input: 0.99, output: 0.99 });
    setPricingOverride('claude-3-5-sonnet-20241022', { input: 0.99, output: 0.99 });

    clearAllPricingOverrides();

    expect(getPricingWithOverrides('gpt-4')).toEqual(getModelPricing('gpt-4'));
    expect(getPricingWithOverrides('claude-3-5-sonnet-20241022')).toEqual(
      getModelPricing('claude-3-5-sonnet-20241022')
    );
  });

  it('should not error when no overrides exist', () => {
    expect(() => clearAllPricingOverrides()).not.toThrow();
  });
});

describe('getPricingWithOverrides', () => {
  it('should return override when set', () => {
    setPricingOverride('gpt-4', { input: 0.05, output: 0.10 });

    const pricing = getPricingWithOverrides('gpt-4');

    expect(pricing).toEqual({ input: 0.05, output: 0.10 });
  });

  it('should return database pricing when no override', () => {
    const pricing = getPricingWithOverrides('gpt-4');

    expect(pricing).toEqual(getModelPricing('gpt-4'));
  });

  it('should return null for unknown model with no override', () => {
    const pricing = getPricingWithOverrides('unknown-model');

    expect(pricing).toBeNull();
  });

  it('should return override for unknown model when set', () => {
    setPricingOverride('my-custom-model', { input: 0.01, output: 0.02 });

    const pricing = getPricingWithOverrides('my-custom-model');

    expect(pricing).toEqual({ input: 0.01, output: 0.02 });
  });
});
