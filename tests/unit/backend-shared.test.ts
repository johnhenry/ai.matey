/**
 * Backend Shared Utilities Tests
 *
 * Tests for shared backend adapter utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  buildStaticResult,
  applyModelFilter,
  estimateCost,
  DEFAULT_OPENAI_MODELS,
  DEFAULT_ANTHROPIC_MODELS,
} from 'ai.matey.backend.shared';
import type { IRChatRequest, AIModel, ListModelsResult } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createRequest(messages: Array<{ role: string; content: string | any[] }>): IRChatRequest {
  return {
    messages: messages.map(m => ({
      role: m.role as any,
      content: m.content,
    })),
    metadata: {
      requestId: 'test-req-id',
      timestamp: Date.now(),
      provenance: {},
    },
  };
}

function createModel(id: string, capabilities?: AIModel['capabilities']): AIModel {
  return {
    id,
    name: id,
    ownedBy: 'test-provider',
    capabilities,
  };
}

// ============================================================================
// estimateTokens Tests
// ============================================================================

describe('estimateTokens', () => {
  it('should estimate tokens for simple string content', () => {
    const request = createRequest([
      { role: 'user', content: 'Hello, how are you?' },
    ]);

    const tokens = estimateTokens(request);

    // "Hello, how are you?" is 19 chars, 19/4 ≈ 5 tokens
    expect(tokens).toBe(5);
  });

  it('should estimate tokens for multiple messages', () => {
    const request = createRequest([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there!' },
    ]);

    const tokens = estimateTokens(request);

    // 29 + 6 + 9 = 44 chars, 44/4 = 11 tokens
    expect(tokens).toBe(11);
  });

  it('should estimate tokens for content blocks', () => {
    const request = createRequest([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image', source: { type: 'url', url: 'http://example.com/img.png' } },
        ],
      },
    ]);

    const tokens = estimateTokens(request);

    // "What is this?" is 13 chars, 13/4 ≈ 4 tokens (images not counted)
    expect(tokens).toBe(4);
  });

  it('should handle empty messages', () => {
    const request = createRequest([]);

    const tokens = estimateTokens(request);

    expect(tokens).toBe(0);
  });

  it('should handle empty content', () => {
    const request = createRequest([
      { role: 'user', content: '' },
    ]);

    const tokens = estimateTokens(request);

    expect(tokens).toBe(0);
  });

  it('should handle multiple text blocks', () => {
    const request = createRequest([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'First part. ' },
          { type: 'text', text: 'Second part.' },
        ],
      },
    ]);

    const tokens = estimateTokens(request);

    // "First part. " (12) + "Second part." (12) = 24 chars, 24/4 = 6 tokens
    expect(tokens).toBe(6);
  });

  it('should round up token count', () => {
    const request = createRequest([
      { role: 'user', content: 'Hi' }, // 2 chars / 4 = 0.5, should round to 1
    ]);

    const tokens = estimateTokens(request);

    expect(tokens).toBe(1);
  });
});

// ============================================================================
// buildStaticResult Tests
// ============================================================================

describe('buildStaticResult', () => {
  it('should build result from string model IDs', () => {
    const result = buildStaticResult(['gpt-4', 'gpt-3.5-turbo'], 'openai');

    expect(result.models).toHaveLength(2);
    expect(result.models[0].id).toBe('gpt-4');
    expect(result.models[0].name).toBe('gpt-4');
    expect(result.models[0].ownedBy).toBe('openai');
    expect(result.models[1].id).toBe('gpt-3.5-turbo');
  });

  it('should build result from AIModel objects', () => {
    const models: AIModel[] = [
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', ownedBy: 'anthropic' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', ownedBy: 'anthropic' },
    ];

    const result = buildStaticResult(models);

    expect(result.models).toHaveLength(2);
    expect(result.models[0].name).toBe('Claude 3 Sonnet');
    expect(result.models[1].name).toBe('Claude 3 Haiku');
  });

  it('should handle mixed string and AIModel inputs', () => {
    const models = [
      'gpt-4',
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', ownedBy: 'anthropic' },
    ];

    const result = buildStaticResult(models, 'openai');

    expect(result.models).toHaveLength(2);
    expect(result.models[0].ownedBy).toBe('openai');
    expect(result.models[1].ownedBy).toBe('anthropic');
  });

  it('should set source to static', () => {
    const result = buildStaticResult(['gpt-4'], 'openai');

    expect(result.source).toBe('static');
  });

  it('should set isComplete to true', () => {
    const result = buildStaticResult(['gpt-4'], 'openai');

    expect(result.isComplete).toBe(true);
  });

  it('should set fetchedAt to current time', () => {
    const before = Date.now();
    const result = buildStaticResult(['gpt-4'], 'openai');
    const after = Date.now();

    expect(result.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(result.fetchedAt).toBeLessThanOrEqual(after);
  });

  it('should use default ownedBy when not specified', () => {
    const result = buildStaticResult(['my-model']);

    expect(result.models[0].ownedBy).toBe('provider');
  });

  it('should handle empty array', () => {
    const result = buildStaticResult([]);

    expect(result.models).toHaveLength(0);
    expect(result.isComplete).toBe(true);
  });
});

// ============================================================================
// applyModelFilter Tests
// ============================================================================

describe('applyModelFilter', () => {
  const createModelsResult = (models: AIModel[]): ListModelsResult => ({
    models,
    source: 'static',
    fetchedAt: Date.now(),
    isComplete: true,
  });

  it('should return result unchanged when no filter', () => {
    const result = createModelsResult([createModel('model1')]);

    const filtered = applyModelFilter(result);

    expect(filtered).toBe(result);
  });

  it('should return result unchanged when empty filter', () => {
    const result = createModelsResult([createModel('model1')]);

    const filtered = applyModelFilter(result, {});

    expect(filtered.models).toHaveLength(1);
  });

  it('should filter by supportsStreaming', () => {
    const models = [
      createModel('stream-yes', { supportsStreaming: true }),
      createModel('stream-no', { supportsStreaming: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsStreaming: true });

    expect(filtered.models).toHaveLength(1);
    expect(filtered.models[0].id).toBe('stream-yes');
  });

  it('should filter by supportsVision', () => {
    const models = [
      createModel('vision-yes', { supportsVision: true }),
      createModel('vision-no', { supportsVision: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsVision: true });

    expect(filtered.models).toHaveLength(1);
    expect(filtered.models[0].id).toBe('vision-yes');
  });

  it('should filter by supportsTools', () => {
    const models = [
      createModel('tools-yes', { supportsTools: true }),
      createModel('tools-no', { supportsTools: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsTools: true });

    expect(filtered.models).toHaveLength(1);
    expect(filtered.models[0].id).toBe('tools-yes');
  });

  it('should filter by supportsJSON', () => {
    const models = [
      createModel('json-yes', { supportsJSON: true }),
      createModel('json-no', { supportsJSON: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsJSON: true });

    expect(filtered.models).toHaveLength(1);
    expect(filtered.models[0].id).toBe('json-yes');
  });

  it('should filter by multiple capabilities', () => {
    const models = [
      createModel('all', { supportsStreaming: true, supportsVision: true, supportsTools: true }),
      createModel('partial', { supportsStreaming: true, supportsVision: false, supportsTools: true }),
      createModel('none', { supportsStreaming: false, supportsVision: false, supportsTools: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, {
      supportsStreaming: true,
      supportsVision: true,
    });

    expect(filtered.models).toHaveLength(1);
    expect(filtered.models[0].id).toBe('all');
  });

  it('should include models without capabilities info', () => {
    const models = [
      createModel('with-caps', { supportsStreaming: true }),
      createModel('no-caps'), // No capabilities
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsStreaming: true });

    expect(filtered.models).toHaveLength(2);
  });

  it('should set isComplete to false when filtering removes models', () => {
    const models = [
      createModel('stream-yes', { supportsStreaming: true }),
      createModel('stream-no', { supportsStreaming: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsStreaming: true });

    expect(filtered.isComplete).toBe(false);
  });

  it('should keep isComplete true when no models removed', () => {
    const models = [
      createModel('both-stream', { supportsStreaming: true }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsStreaming: true });

    expect(filtered.isComplete).toBe(true);
  });

  it('should handle filtering for false values', () => {
    const models = [
      createModel('vision-yes', { supportsVision: true }),
      createModel('vision-no', { supportsVision: false }),
    ];
    const result = createModelsResult(models);

    const filtered = applyModelFilter(result, { supportsVision: false });

    expect(filtered.models).toHaveLength(1);
    expect(filtered.models[0].id).toBe('vision-no');
  });
});

// ============================================================================
// estimateCost Tests
// ============================================================================

describe('estimateCost', () => {
  it('should estimate cost for Claude 3.5 Sonnet rates', () => {
    const cost = estimateCost(1000, 500, {
      inputPer1M: 3.00,  // $3 per 1M input tokens
      outputPer1M: 15.00, // $15 per 1M output tokens
    });

    // (1000/1M * $3) + (500/1M * $15) = $0.003 + $0.0075 = $0.0105
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it('should estimate cost for GPT-4o rates', () => {
    const cost = estimateCost(10000, 5000, {
      inputPer1M: 5.00,  // $5 per 1M input tokens
      outputPer1M: 15.00, // $15 per 1M output tokens
    });

    // (10000/1M * $5) + (5000/1M * $15) = $0.05 + $0.075 = $0.125
    expect(cost).toBeCloseTo(0.125, 6);
  });

  it('should handle zero tokens', () => {
    const cost = estimateCost(0, 0, {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    });

    expect(cost).toBe(0);
  });

  it('should handle zero input tokens', () => {
    const cost = estimateCost(0, 1000, {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    });

    // (0) + (1000/1M * $15) = $0.015
    expect(cost).toBeCloseTo(0.015, 6);
  });

  it('should handle zero output tokens', () => {
    const cost = estimateCost(1000, 0, {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    });

    // (1000/1M * $3) + (0) = $0.003
    expect(cost).toBeCloseTo(0.003, 6);
  });

  it('should handle large token counts', () => {
    const cost = estimateCost(1_000_000, 500_000, {
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    });

    // (1M/1M * $3) + (500K/1M * $15) = $3 + $7.50 = $10.50
    expect(cost).toBeCloseTo(10.50, 6);
  });

  it('should handle very low rates (cheap models)', () => {
    const cost = estimateCost(100000, 50000, {
      inputPer1M: 0.15,  // $0.15 per 1M (like GPT-4o-mini)
      outputPer1M: 0.60, // $0.60 per 1M
    });

    // (100K/1M * $0.15) + (50K/1M * $0.60) = $0.015 + $0.03 = $0.045
    expect(cost).toBeCloseTo(0.045, 6);
  });
});

// ============================================================================
// DEFAULT_OPENAI_MODELS Tests
// ============================================================================

describe('DEFAULT_OPENAI_MODELS', () => {
  it('should contain expected models', () => {
    const ids = DEFAULT_OPENAI_MODELS.map(m => m.id);

    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('gpt-4o-mini');
    expect(ids).toContain('gpt-4-turbo');
    expect(ids).toContain('gpt-3.5-turbo');
  });

  it('should have ownedBy set to openai', () => {
    for (const model of DEFAULT_OPENAI_MODELS) {
      expect(model.ownedBy).toBe('openai');
    }
  });

  it('should have capabilities defined', () => {
    for (const model of DEFAULT_OPENAI_MODELS) {
      expect(model.capabilities).toBeDefined();
      expect(model.capabilities?.supportsStreaming).toBe(true);
      expect(model.capabilities?.supportsTools).toBe(true);
    }
  });

  it('should have correct vision support', () => {
    const gpt4o = DEFAULT_OPENAI_MODELS.find(m => m.id === 'gpt-4o');
    const gpt35 = DEFAULT_OPENAI_MODELS.find(m => m.id === 'gpt-3.5-turbo');

    expect(gpt4o?.capabilities?.supportsVision).toBe(true);
    expect(gpt35?.capabilities?.supportsVision).toBe(false);
  });

  it('should have context window info', () => {
    const gpt4o = DEFAULT_OPENAI_MODELS.find(m => m.id === 'gpt-4o');

    expect(gpt4o?.capabilities?.contextWindow).toBe(128000);
  });
});

// ============================================================================
// DEFAULT_ANTHROPIC_MODELS Tests
// ============================================================================

describe('DEFAULT_ANTHROPIC_MODELS', () => {
  it('should contain expected models', () => {
    const ids = DEFAULT_ANTHROPIC_MODELS.map(m => m.id);

    expect(ids).toContain('claude-3-5-sonnet-20241022');
    expect(ids).toContain('claude-3-5-haiku-20241022');
    expect(ids).toContain('claude-3-opus-20240229');
  });

  it('should have ownedBy set to anthropic', () => {
    for (const model of DEFAULT_ANTHROPIC_MODELS) {
      expect(model.ownedBy).toBe('anthropic');
    }
  });

  it('should have capabilities defined', () => {
    for (const model of DEFAULT_ANTHROPIC_MODELS) {
      expect(model.capabilities).toBeDefined();
      expect(model.capabilities?.supportsStreaming).toBe(true);
      expect(model.capabilities?.supportsTools).toBe(true);
    }
  });

  it('should have correct vision support', () => {
    const sonnet = DEFAULT_ANTHROPIC_MODELS.find(m => m.id === 'claude-3-5-sonnet-20241022');
    const haiku = DEFAULT_ANTHROPIC_MODELS.find(m => m.id === 'claude-3-5-haiku-20241022');

    expect(sonnet?.capabilities?.supportsVision).toBe(true);
    expect(haiku?.capabilities?.supportsVision).toBe(false);
  });

  it('should not support JSON mode', () => {
    for (const model of DEFAULT_ANTHROPIC_MODELS) {
      expect(model.capabilities?.supportsJSON).toBe(false);
    }
  });

  it('should have 200K context window', () => {
    for (const model of DEFAULT_ANTHROPIC_MODELS) {
      expect(model.capabilities?.contextWindow).toBe(200000);
    }
  });
});
