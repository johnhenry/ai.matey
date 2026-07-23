/**
 * Claude Opus 4.7+ (incl. 4.8) and Sonnet 5 return HTTP 400 if
 * temperature/top_p/top_k are set to a non-default value. The Anthropic
 * adapter must omit these params for those models and surface a warning
 * instead of forwarding them into a request that will be rejected.
 */

import { describe, it, expect } from 'vitest';
import { AnthropicBackendAdapter, supportsSamplingParams } from 'ai.matey.backend';
import type { IRChatRequest } from 'ai.matey.types';

function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'hello' }],
    parameters: { temperature: 0.7, topP: 0.9, topK: 40 },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

describe('supportsSamplingParams', () => {
  it.each([
    ['claude-opus-4-7', false],
    ['claude-opus-4.7', false],
    ['claude-opus-4-8', false],
    ['claude-opus-4.8', false],
    ['claude-opus-4-9', false],
    ['claude-sonnet-5', false],
    ['claude-sonnet-5-20260630', false],
    ['claude-opus-4-5-20251101', true],
    ['claude-opus-4.5', true],
    ['claude-sonnet-4-5-20250929', true],
    ['claude-haiku-4-5-20251001', true],
    ['claude-3-5-sonnet-20241022', true],
  ])('%s -> %s', (model, expected) => {
    expect(supportsSamplingParams(model)).toBe(expected);
  });
});

describe('Anthropic backend sampling param mapping', () => {
  const adapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

  it('omits temperature/top_p/top_k for Sonnet 5', () => {
    const req = adapter.fromIR(makeRequest({ parameters: { model: 'claude-sonnet-5', temperature: 0.7, topP: 0.9, topK: 40 } }));
    expect(req.temperature).toBeUndefined();
    expect(req.top_p).toBeUndefined();
    expect(req.top_k).toBeUndefined();
  });

  it('omits temperature/top_p/top_k for Opus 4.8', () => {
    const req = adapter.fromIR(makeRequest({ parameters: { model: 'claude-opus-4-8', temperature: 0.7, topP: 0.9, topK: 40 } }));
    expect(req.temperature).toBeUndefined();
    expect(req.top_p).toBeUndefined();
    expect(req.top_k).toBeUndefined();
  });

  it('still sends temperature/top_p/top_k for older models like Opus 4.5', () => {
    const req = adapter.fromIR(
      makeRequest({ parameters: { model: 'claude-opus-4-5-20251101', temperature: 0.7, topP: 0.9, topK: 40 } })
    );
    expect(req.temperature).toBe(0.7);
    expect(req.top_p).toBe(0.9);
    expect(req.top_k).toBe(40);
  });

  it('uses the new claude-sonnet-5 default, so sampling params are omitted with no explicit model', () => {
    const req = adapter.fromIR(makeRequest({ parameters: { temperature: 0.7, topP: 0.9, topK: 40 } }));
    expect(req.model).toBe('claude-sonnet-5');
    expect(req.temperature).toBeUndefined();
  });

  it('adds a parameter-unsupported warning when sampling params are dropped', () => {
    const response = adapter.toIR(
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      makeRequest({ parameters: { model: 'claude-sonnet-5', temperature: 0.7 } }),
      10
    );

    expect(response.metadata.warnings).toEqual([
      expect.objectContaining({ category: 'parameter-unsupported' }),
    ]);
  });

  it('does not add a warning when no sampling params were requested', () => {
    const response = adapter.toIR(
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      makeRequest({ parameters: { model: 'claude-sonnet-5' } }),
      10
    );

    expect(response.metadata.warnings).toBeUndefined();
  });

  it('does not add a warning for models that still support sampling params', () => {
    const response = adapter.toIR(
      {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        model: 'claude-opus-4-5-20251101',
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      makeRequest({ parameters: { model: 'claude-opus-4-5-20251101', temperature: 0.7 } }),
      10
    );

    expect(response.metadata.warnings).toBeUndefined();
  });
});
