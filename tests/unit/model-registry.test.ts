/**
 * Model registry tests
 *
 * The registry in ai.matey.utils is the single source of truth for model
 * metadata. These tests cover lookup resolution (exact → alias → prefix
 * fallback), runtime registration precedence, pricing overrides, and reset
 * isolation.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  getModelEntry,
  getModelPricingInfo,
  getModelContextWindow,
  getModelsByProvider,
  getModelEntriesByFamily,
  registerModels,
  overrideModelPricing,
  resetModelRegistry,
} from 'ai.matey.utils';

afterEach(() => {
  resetModelRegistry();
});

describe('getModelEntry', () => {
  it('resolves current-generation ids exactly', () => {
    expect(getModelEntry('gpt-5.1')?.provider).toBe('openai');
    expect(getModelEntry('claude-sonnet-4-5-20250929')?.provider).toBe('anthropic');
    expect(getModelEntry('gemini-3-pro')?.provider).toBe('gemini');
  });

  it('resolves aliases', () => {
    expect(getModelEntry('claude-sonnet-4-5')?.id).toBe('claude-sonnet-4-5-20250929');
    expect(getModelEntry('mistral-large-latest')?.id).toBe('mistral-large-2411');
  });

  it('falls back to the longest matching prefix for unknown snapshots', () => {
    // A future dated snapshot of a known family resolves to the family entry
    const entry = getModelEntry('claude-sonnet-4-5-20991231');
    expect(entry?.id).toBe('claude-sonnet-4-5-20250929');

    expect(getModelEntry('gpt-5.1-2027-preview')?.family).toBe('gpt-5');
  });

  it('returns null for unknown and empty ids', () => {
    expect(getModelEntry('unknown-model-xyz')).toBeNull();
    expect(getModelEntry('')).toBeNull();
  });
});

describe('registerModels', () => {
  it('adds new models at runtime', () => {
    registerModels([
      {
        id: 'gpt-7-preview',
        provider: 'openai',
        family: 'gpt-7',
        pricing: { inputPer1M: 4.0, outputPer1M: 20.0 },
        contextWindow: 800000,
      },
    ]);

    expect(getModelEntry('gpt-7-preview')?.family).toBe('gpt-7');
    expect(getModelContextWindow('gpt-7-preview')).toBe(800000);
    expect(getModelPricingInfo('gpt-7-preview')).toEqual({ inputPer1M: 4.0, outputPer1M: 20.0 });
  });

  it('user entries take precedence over the seed', () => {
    registerModels([
      {
        id: 'gpt-5.1',
        provider: 'openai',
        family: 'gpt-5',
        pricing: { inputPer1M: 99, outputPer1M: 99 },
      },
    ]);

    expect(getModelPricingInfo('gpt-5.1')?.inputPer1M).toBe(99);
  });
});

describe('pricing overrides', () => {
  it('overrides win over entry pricing', () => {
    overrideModelPricing('gpt-5.1', { inputPer1M: 0.5, outputPer1M: 5 });
    expect(getModelPricingInfo('gpt-5.1')).toEqual({ inputPer1M: 0.5, outputPer1M: 5 });
  });
});

describe('reset isolation', () => {
  it('resetModelRegistry clears registrations and overrides', () => {
    registerModels([{ id: 'temp-model-abcdef', provider: 'test', family: 'temp' }]);
    overrideModelPricing('gpt-5.1', { inputPer1M: 1, outputPer1M: 1 });

    resetModelRegistry();

    expect(getModelEntry('temp-model-abcdef')).toBeNull();
    expect(getModelPricingInfo('gpt-5.1')?.inputPer1M).toBe(1.25);
  });
});

describe('queries', () => {
  it('lists models by provider and family', () => {
    const anthropic = getModelsByProvider('anthropic');
    expect(anthropic.length).toBeGreaterThan(3);
    expect(anthropic.every((entry) => entry.provider === 'anthropic')).toBe(true);

    const claude4 = getModelEntriesByFamily('claude-4');
    expect(claude4.some((entry) => entry.id.startsWith('claude-opus-4-5'))).toBe(true);
  });

  it('marks superseded models as deprecated but keeps their pricing', () => {
    const gpt4 = getModelEntry('gpt-4');
    expect(gpt4?.deprecated).toBe(true);
    expect(gpt4?.pricing?.inputPer1M).toBe(30.0);
  });
});
