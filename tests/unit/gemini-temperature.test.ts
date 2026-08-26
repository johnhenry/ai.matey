/**
 * Regression tests: Gemini frontend/backend adapters must pass `temperature`
 * through unmodified, like every other adapter.
 *
 * Previously both adapters used `temperature ? temperature * 2 : undefined`
 * (frontend) / `temperature ? temperature / 2 : undefined` (backend). This
 * had two bugs:
 *  1. It applied an undocumented scale conversion that no other adapter
 *     (OpenAI, Anthropic, Mistral, Ollama, Chrome AI) applies -- they all
 *     pass `temperature` straight through regardless of the provider's own
 *     native range.
 *  2. It used truthiness, so an explicit `temperature: 0` (a valid, distinct
 *     value from "unset") was silently converted to `undefined` instead of
 *     being preserved.
 */

import { describe, it, expect } from 'vitest';
import { GeminiBackendAdapter } from '@johnhenry/aimatey-backend';
import { GeminiFrontendAdapter, type GeminiRequest } from '@johnhenry/aimatey-frontend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

function makeIRRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello!' }],
    parameters: { model: 'gemini-1.5-pro' },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

function makeGeminiRequest(temperature: number | undefined): GeminiRequest {
  return {
    contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
    generationConfig: temperature === undefined ? undefined : { temperature },
  };
}

describe('Gemini backend adapter temperature handling', () => {
  const adapter = new GeminiBackendAdapter({ apiKey: 'test-key' });

  it('preserves temperature: 0 instead of dropping it', () => {
    const req = adapter.fromIR(makeIRRequest({ parameters: { model: 'gemini-1.5-pro', temperature: 0 } }));
    expect(req.generationConfig?.temperature).toBe(0);
  });

  it('passes a non-zero temperature through unmodified (no /2 scaling)', () => {
    const req = adapter.fromIR(
      makeIRRequest({ parameters: { model: 'gemini-1.5-pro', temperature: 0.8 } })
    );
    expect(req.generationConfig?.temperature).toBe(0.8);
  });

  it('leaves temperature undefined when not provided', () => {
    const req = adapter.fromIR(makeIRRequest());
    expect(req.generationConfig?.temperature).toBeUndefined();
  });
});

describe('Gemini frontend adapter temperature handling', () => {
  const adapter = new GeminiFrontendAdapter();

  it('preserves temperature: 0 instead of dropping it', async () => {
    const irRequest = await adapter.toIR(makeGeminiRequest(0));
    expect(irRequest.parameters?.temperature).toBe(0);
  });

  it('passes a non-zero temperature through unmodified (no *2 scaling)', async () => {
    const irRequest = await adapter.toIR(makeGeminiRequest(0.4));
    expect(irRequest.parameters?.temperature).toBe(0.4);
  });

  it('leaves temperature undefined when not provided', async () => {
    const irRequest = await adapter.toIR(makeGeminiRequest(undefined));
    expect(irRequest.parameters?.temperature).toBeUndefined();
  });
});
