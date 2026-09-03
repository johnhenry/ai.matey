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
  MODEL_REGISTRY_SEED,
} from '@johnhenry/aimatey-utils';

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
    // Migrated 2026-09-03: mistral-large-2411 was retired 2026-05-31, so the
    // floating alias now points at the current Large.
    expect(getModelEntry('mistral-large-latest')?.id).toBe('mistral-large-2512');
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
    // Repriced 2026-08-16 and vision moved to a dedicated model - see the
    // 2026-09-03 refresh block below. Context window is unchanged.
    expect(flash?.capabilities?.vision).toBe(false);
    expect(flash?.contextWindow).toBe(1000000);
    expect(flash?.pricing).toEqual({ inputPer1M: 0.44, outputPer1M: 1.32, cachedInputPer1M: 0.014 });

    expect(getModelEntry('deepseek-v4-pro')?.pricing?.inputPer1M).toBe(1.32);
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
  it('resolves the GPT-5.6 family with 1.05M context', () => {
    // Prices cut 2026-07-30 (terra/luna) and 2026-08-21 (sol); context window
    // corrected to the documented 1,050,000 (= 922,000 input + 128,000 out).
    expect(getModelEntry('gpt-5.6-sol')?.pricing).toEqual({
      inputPer1M: 4.0,
      outputPer1M: 20.0,
      cachedInputPer1M: 0.4,
    });
    expect(getModelEntry('gpt-5.6-terra')?.contextWindow).toBe(1050000);
    expect(getModelEntry('gpt-5.6-luna')?.pricing?.inputPer1M).toBe(0.2);
    expect(getModelContextWindow('gpt-5.6-terra')).toBe(1050000);
  });

  it('marks the deprecated dated GPT-5/o3 snapshot family deprecated but priced', () => {
    expect(getModelEntry('gpt-5')?.deprecated).toBe(true);
    expect(getModelEntry('gpt-5-mini')?.deprecated).toBe(true);
    expect(getModelEntry('gpt-5-nano')?.deprecated).toBe(true);
    expect(getModelEntry('o3')?.deprecated).toBe(true);
    // o4-mini WAS confirmed deprecated on 2026-09-03: OpenAI's deprecations
    // table names the bare alias, announced 2026-04-22, shutdown 2026-10-23.
    // The 2026-07-23 pass could not confirm it and correctly left it alone.
    expect(getModelEntry('o4-mini')?.deprecated).toBe(true);
    expect(getModelEntry('o4-mini')?.pricing?.inputPer1M).toBe(1.1);
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

describe('2026-09-03 provider refresh', () => {
  it('seeds the current Claude lineup, including the ids that previously fell through', () => {
    // Before this refresh, 'claude-fable-5-1' prefix-matched onto the
    // 'claude-fable-5' entry and billed cache reads at $1.00 instead of
    // $0.25 - a 4x overcount that looked like a successful resolution.
    expect(getModelEntry('claude-fable-5-1')?.id).toBe('claude-fable-5-1');
    expect(getModelEntry('claude-fable-5-1')?.pricing?.cachedInputPer1M).toBe(0.25);
    expect(getModelEntry('claude-fable-5')?.pricing?.cachedInputPer1M).toBe(1.0);

    expect(getModelEntry('claude-opus-5')?.family).toBe('claude-5');
    expect(getModelContextWindow('claude-opus-5')).toBe(1000000);
  });

  it('prices Claude Sonnet 5 at the $2/$10 that became standard', () => {
    // The file had bet on an increase to $3/$15 on 2026-09-01 that Anthropic
    // cancelled, over-pricing the mainstream Sonnet model by 50%.
    expect(getModelPricingInfo('claude-sonnet-5')).toEqual({
      inputPer1M: 2.0,
      outputPer1M: 10.0,
      cachedInputPer1M: 0.2,
    });
  });

  it('gives Claude Opus 4.8 its documented 1M context window', () => {
    expect(getModelContextWindow('claude-opus-4-8')).toBe(1000000);
    expect(getModelEntry('claude-opus-4.8')?.maxOutputTokens).toBe(128000);
    expect(getModelEntry('claude-opus-4-8')?.releaseDate).toBe('2026-05-28');
  });

  it('keeps DeepSeek image support on the only model that accepts images', () => {
    // Capability routing was previously picking a model that 400s on images.
    expect(getModelEntry('deepseek-v4-flash-vision-exp')?.capabilities?.vision).toBe(true);
    expect(getModelEntry('deepseek-v4-flash')?.capabilities?.vision).toBe(false);
    expect(getModelEntry('deepseek-v4-pro')?.capabilities?.vision).toBe(false);
  });

  it('migrates every Mistral -latest alias off a retired model', () => {
    expect(getModelEntry('mistral-medium-latest')?.id).toBe('mistral-medium-3-5');
    expect(getModelEntry('mistral-small-latest')?.id).toBe('mistral-small-2603');
    expect(getModelEntry('codestral-latest')?.id).toBe('codestral-2508');

    for (const id of [
      'mistral-large-2411',
      'mistral-medium-2505',
      'mistral-small-2501',
      'codestral-2501',
    ]) {
      const entry = getModelEntry(id);
      expect(entry?.deprecated, `${id} should be deprecated`).toBe(true);
      expect(entry?.pricing?.inputPer1M, `${id} should keep its price`).toBeTypeOf('number');
    }
  });

  it('corrects Grok 4.5 and seeds Grok 4.6', () => {
    // grok-4.5's context and pricing were placeholders copied from grok-4.3.
    expect(getModelContextWindow('grok-4.5')).toBe(500000);
    expect(getModelEntry('grok-4.5')?.pricing).toEqual({
      inputPer1M: 2.0,
      outputPer1M: 6.0,
      cachedInputPer1M: 0.3,
    });
    expect(getModelEntry('grok-4.6')?.contextWindow).toBe(500000);
    expect(getModelEntry('grok-3')?.deprecated).toBe(true);
  });

  it('corrects the Gemini Flash prices that were seeded as estimates', () => {
    expect(getModelEntry('gemini-3.6-flash')?.pricing?.inputPer1M).toBe(0.75);
    expect(getModelEntry('gemini-3.5-flash-lite')?.pricing?.outputPer1M).toBe(2.5);
    expect(getModelEntry('gemini-3.8-flash')?.family).toBe('gemini-3');
    expect(getModelEntry('gemini-embedding-2-preview')?.id).toBe('gemini-embedding-2');
  });

  it('seeds the Moonshot K2 line without inventing release dates', () => {
    expect(getModelEntry('kimi-k2.6')?.provider).toBe('moonshot');
    expect(getModelEntry('moonshotai/kimi-k2.7-code')?.id).toBe('kimi-k2.7-code');
    // Moonshot publishes no release dates for active models; omitted, not guessed.
    expect(getModelEntry('kimi-k2.6')?.releaseDate).toBeUndefined();
  });
});

describe('seed data invariants', () => {
  it('every entry has the required identity fields', () => {
    for (const entry of MODEL_REGISTRY_SEED) {
      expect(entry.id, 'entry is missing an id').toBeTruthy();
      expect(entry.provider, `${entry.id} is missing a provider`).toBeTruthy();
      expect(entry.family, `${entry.id} is missing a family`).toBeTruthy();
    }
  });

  it('ids are unique', () => {
    const ids = MODEL_REGISTRY_SEED.map((entry) => entry.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, 'duplicate ids silently shadow each other in the index').toEqual([]);
  });

  it('aliases are unique and never collide with a canonical id', () => {
    // buildIndex() writes aliases into a Map, so a duplicate alias silently
    // resolves to whichever entry happens to come last in the seed.
    const ids = new Set(MODEL_REGISTRY_SEED.map((entry) => entry.id));
    const aliases = MODEL_REGISTRY_SEED.flatMap((entry) => [...(entry.aliases ?? [])]);

    const duplicates = aliases.filter((alias, i) => aliases.indexOf(alias) !== i);
    expect(duplicates, 'duplicate aliases resolve non-deterministically').toEqual([]);

    const collisions = aliases.filter((alias) => ids.has(alias));
    expect(collisions, 'an alias shadowed by a canonical id is dead weight').toEqual([]);
  });

  it('deprecated entries keep their pricing, because cost tracking needs it', () => {
    // This is the header's stated reason for never deleting an entry: a
    // deprecated model stripped of its prices makes historical usage
    // unpriceable, and getModelPricingInfo() would return null for it.
    const deprecated = MODEL_REGISTRY_SEED.filter((entry) => entry.deprecated);
    expect(deprecated.length).toBeGreaterThan(20);

    for (const entry of deprecated) {
      expect(entry.pricing, `${entry.id} lost its pricing`).toBeDefined();
      expect(getModelPricingInfo(entry.id), `${entry.id} prices to null`).not.toBeNull();
    }
  });

  it('every price is a finite, non-negative number', () => {
    for (const entry of MODEL_REGISTRY_SEED) {
      if (!entry.pricing) continue;
      const { inputPer1M, outputPer1M, cachedInputPer1M } = entry.pricing;
      for (const [label, value] of [
        ['inputPer1M', inputPer1M],
        ['outputPer1M', outputPer1M],
        ['cachedInputPer1M', cachedInputPer1M],
      ] as const) {
        if (value === undefined) continue;
        expect(Number.isFinite(value), `${entry.id}.${label} is not finite`).toBe(true);
        expect(value, `${entry.id}.${label} is negative`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a cached-input rate is never more expensive than base input', () => {
    for (const entry of MODEL_REGISTRY_SEED) {
      const { inputPer1M, cachedInputPer1M } = entry.pricing ?? {};
      if (cachedInputPer1M === undefined || inputPer1M === undefined) continue;
      expect(cachedInputPer1M, `${entry.id} caches dearer than it reads`).toBeLessThanOrEqual(
        inputPer1M,
      );
    }
  });

  it('embedding entries declare their output dimensions', () => {
    const embeddings = MODEL_REGISTRY_SEED.filter((entry) => entry.kind === 'embedding');
    expect(embeddings.length).toBeGreaterThan(0);
    for (const entry of embeddings) {
      expect(entry.embeddingDimensions, `${entry.id} has no dimensions`).toBeGreaterThan(0);
    }
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
