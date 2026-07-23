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

describe('2026-07 provider refresh', () => {
  it('resolves DeepSeek V4 models with vision and current pricing', () => {
    const flash = getModelEntry('deepseek-v4-flash');
    expect(flash?.capabilities?.vision).toBe(true);
    expect(flash?.contextWindow).toBe(1000000);
    expect(flash?.pricing).toEqual({ inputPer1M: 0.14, outputPer1M: 0.28, cachedInputPer1M: 0.003 });

    expect(getModelEntry('deepseek-v4-pro')?.pricing?.inputPer1M).toBe(0.435);
  });

  it('marks retired DeepSeek ids deprecated but priced', () => {
    const chat = getModelEntry('deepseek-chat');
    expect(chat?.deprecated).toBe(true);
    expect(chat?.pricing?.inputPer1M).toBe(0.27);
    expect(getModelEntry('deepseek-reasoner')?.deprecated).toBe(true);
  });

  it('resolves claude-sonnet-5 with 1M context', () => {
    const sonnet5 = getModelEntry('claude-sonnet-5');
    expect(sonnet5?.family).toBe('claude-5');
    expect(sonnet5?.contextWindow).toBe(1000000);
    expect(getModelContextWindow('claude-sonnet-5')).toBe(1000000);
  });

  it('resolves current Gemini and Grok generations', () => {
    expect(getModelEntry('gemini-3.5-flash')?.pricing?.inputPer1M).toBe(1.5);
    expect(getModelEntry('gemini-3.1-pro')?.id).toBe('gemini-3.1-pro-preview');
    expect(getModelEntry('grok-4.3')?.capabilities?.vision).toBe(true);
    // Alias resolution for the grok-4.20 variants
    expect(getModelEntry('grok-4.20-0309-non-reasoning')?.id).toBe('grok-4.20-0309-reasoning');
  });
});

describe('2026-07-23 provider refresh', () => {
  it('resolves the GPT-5.6 family with 1M context', () => {
    expect(getModelEntry('gpt-5.6-sol')?.pricing).toEqual({ inputPer1M: 5.0, outputPer1M: 30.0 });
    expect(getModelEntry('gpt-5.6-terra')?.contextWindow).toBe(1000000);
    expect(getModelEntry('gpt-5.6-luna')?.pricing?.inputPer1M).toBe(1.0);
    expect(getModelContextWindow('gpt-5.6-terra')).toBe(1000000);
  });

  it('marks the deprecated dated GPT-5/o3 snapshot family deprecated but priced', () => {
    expect(getModelEntry('gpt-5')?.deprecated).toBe(true);
    expect(getModelEntry('gpt-5-mini')?.deprecated).toBe(true);
    expect(getModelEntry('gpt-5-nano')?.deprecated).toBe(true);
    expect(getModelEntry('o3')?.deprecated).toBe(true);
    // o4-mini was not confirmed deprecated - must not be flipped
    expect(getModelEntry('o4-mini')?.deprecated).toBeFalsy();
    expect(getModelEntry('gpt-5')?.pricing?.inputPer1M).toBe(1.25);
  });

  it('resolves Claude Opus 4.8 and Fable 5', () => {
    expect(getModelEntry('claude-opus-4-8')?.family).toBe('claude-4');
    expect(getModelEntry('claude-opus-4.8')?.id).toBe('claude-opus-4-8');
    expect(getModelEntry('claude-fable-5')?.family).toBe('claude-5');
  });

  it('resolves Grok 4.5 and Gemini 3.6 Flash / 3.5 Flash-Lite', () => {
    expect(getModelEntry('grok-4.5')?.family).toBe('grok');
    expect(getModelEntry('gemini-3.6-flash')?.family).toBe('gemini-3');
    expect(getModelEntry('gemini-3.5-flash-lite')?.family).toBe('gemini-3');
  });

  it('resolves Moonshot Kimi K3 as a new provider section', () => {
    const kimi = getModelEntry('kimi-k3');
    expect(kimi?.provider).toBe('moonshot');
    expect(kimi?.family).toBe('moonshot');
    expect(kimi?.contextWindow).toBe(1048576);
    // OpenRouter-listed alias resolves to the same entry
    expect(getModelEntry('moonshotai/kimi-k3')?.id).toBe('kimi-k3');
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
