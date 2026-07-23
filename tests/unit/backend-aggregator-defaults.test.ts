/**
 * Default model bumps for the "aggregator" adapters (OpenRouter, Fireworks,
 * Together AI) - platforms that route to many providers'/vendors' models
 * rather than owning a single model lineage. Verified against each
 * platform's live model catalog on 2026-07-23 (see the changeset for the
 * exact endpoints checked) rather than assumed from a single vendor's docs.
 */

import { describe, it, expect } from 'vitest';
import {
  OpenRouterBackendAdapter,
  FireworksAIBackendAdapter,
  TogetherAIBackendAdapter,
} from 'ai.matey.backend';
import type { IRChatRequest } from 'ai.matey.types';

function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'hi' }],
    parameters: {},
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

describe('OpenRouter default model', () => {
  it('defaults to anthropic/claude-haiku-4.5 (verified live on OpenRouter, not claude-3-haiku)', () => {
    const adapter = new OpenRouterBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('anthropic/claude-haiku-4.5');
  });
});

describe('Fireworks AI default model', () => {
  it('defaults to deepseek-v4-flash (verified live on fireworks.ai/models), not llama-v3p1-8b', () => {
    const adapter = new FireworksAIBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('accounts/fireworks/models/deepseek-v4-flash');
  });

  it('advertises a 1M context ceiling matching current models', () => {
    const adapter = new FireworksAIBackendAdapter({ apiKey: 'test-key' });
    expect(adapter.metadata.capabilities.maxContextTokens).toBe(1000000);
  });
});

describe('Together AI default model', () => {
  it('defaults to deepseek-ai/DeepSeek-V4-Pro (verified live on together.ai/models), not Llama 3.1', () => {
    const adapter = new TogetherAIBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('deepseek-ai/DeepSeek-V4-Pro');
  });

  it('advertises a 1M context ceiling matching current models', () => {
    const adapter = new TogetherAIBackendAdapter({ apiKey: 'test-key' });
    expect(adapter.metadata.capabilities.maxContextTokens).toBe(1000000);
  });
});
