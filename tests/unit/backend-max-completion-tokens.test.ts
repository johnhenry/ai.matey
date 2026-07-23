/**
 * gpt-5.x / o1-o3-o4 reasoning models require `max_completion_tokens`
 * instead of the legacy `max_tokens` parameter (#19).
 */

import { describe, it, expect } from 'vitest';
import { OpenAIBackendAdapter, requiresMaxCompletionTokens } from 'ai.matey.backend';
import type { IRChatRequest } from 'ai.matey.types';

function makeRequest(model: string, maxTokens = 200): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'hello' }],
    parameters: { model, maxTokens },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
  };
}

describe('requiresMaxCompletionTokens', () => {
  it.each([
    ['gpt-5.4-nano', true],
    ['gpt-5', true],
    ['gpt-5-mini', true],
    ['o1', true],
    ['o1-preview', true],
    ['o3', true],
    ['o3-mini', true],
    ['o4-mini', true],
    ['gpt-4.1-nano', false],
    ['gpt-4o-mini', false],
    ['gpt-4', false],
    ['gpt-3.5-turbo', false],
  ])('%s -> %s', (model, expected) => {
    expect(requiresMaxCompletionTokens(model)).toBe(expected);
  });

  it('does not false-positive on unrelated model names containing "o3"', () => {
    // Guards the o1/o3/o4 regex against matching random substrings.
    expect(requiresMaxCompletionTokens('foo3-bar')).toBe(false);
  });
});

describe('OpenAI backend max_tokens vs max_completion_tokens mapping', () => {
  const adapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });

  it('sends max_completion_tokens for gpt-5.x models', () => {
    const req = adapter.fromIR(makeRequest('gpt-5.4-nano', 200));
    expect(req.max_completion_tokens).toBe(200);
    expect(req.max_tokens).toBeUndefined();
  });

  it('sends max_completion_tokens for o-series reasoning models', () => {
    const req = adapter.fromIR(makeRequest('o3-mini', 500));
    expect(req.max_completion_tokens).toBe(500);
    expect(req.max_tokens).toBeUndefined();
  });

  it('sends max_tokens for gpt-4.x models', () => {
    const req = adapter.fromIR(makeRequest('gpt-4.1-nano', 300));
    expect(req.max_tokens).toBe(300);
    expect(req.max_completion_tokens).toBeUndefined();
  });

  it('sends max_tokens for the fallback default model', () => {
    // Default model is 'gpt-5.6-terra' when neither the request nor config
    // specify one - it must also take the max_completion_tokens path.
    const req = adapter.fromIR({
      messages: [{ role: 'user', content: 'hi' }],
      parameters: { maxTokens: 100 },
      metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    });
    expect(req.model).toBe('gpt-5.6-terra');
    expect(req.max_completion_tokens).toBe(100);
    expect(req.max_tokens).toBeUndefined();
  });
});
