/**
 * Regression tests: Groq and NVIDIA adapters' estimateCost() must not treat
 * `super.estimateCost()`'s already-dollar result as if it were a token
 * count.
 *
 * Previously both `GroqBackendAdapter.estimateCost()` and
 * `NVIDIABackendAdapter.estimateCost()` did:
 *
 *   const estimatedInputTokens = (await super.estimateCost(request)) || 0;
 *   const inputCost = (estimatedInputTokens * 1000 * RATE) / 1_000_000;
 *
 * But `OpenAIBackendAdapter.estimateCost()` (the `super` here) already
 * returns a dollar amount (`(tokens / 1_000_000) * inputPer1M`), not a
 * token count -- re-multiplying it produced a cost off by orders of
 * magnitude. The fix uses `estimateTokens(request)` directly for the token
 * count, matching every other adapter.
 */

import { describe, it, expect } from 'vitest';
import { GroqBackendAdapter, NVIDIABackendAdapter, estimateTokens } from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

function makeRequest(text: string, maxTokens?: number): IRChatRequest {
  return {
    messages: [{ role: 'user', content: text }],
    parameters: { model: 'llama-3.1-8b-instant', maxTokens },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
  };
}

describe('GroqBackendAdapter.estimateCost', () => {
  const adapter = new GroqBackendAdapter({ apiKey: 'test-key' });

  it('computes cost directly from token count, not from a re-multiplied dollar amount', async () => {
    const request = makeRequest('Hello there, this is a test message for token estimation.', 500);
    const cost = await adapter.estimateCost(request);

    const expectedInputTokens = estimateTokens(request);
    const expectedOutputTokens = Math.min(500, 4000);
    const expected = (expectedInputTokens / 1_000_000) * 0.05 + (expectedOutputTokens / 1_000_000) * 0.1;

    expect(cost).not.toBeNull();
    expect(cost as number).toBeCloseTo(expected, 12);

    // Sanity bound: for a short prompt this should be a small fraction of a
    // cent, not astronomically smaller (the old re-multiplied-dollar bug)
    // nor astronomically larger.
    expect(cost as number).toBeGreaterThan(0);
    expect(cost as number).toBeLessThan(0.001);
  });

  it('scales with input length (proves it is not a near-constant near-zero value)', async () => {
    const shortCost = await adapter.estimateCost(makeRequest('Hi', 10));
    const longCost = await adapter.estimateCost(
      makeRequest('This is a much longer prompt. '.repeat(100), 10)
    );

    expect(shortCost).not.toBeNull();
    expect(longCost).not.toBeNull();
    expect(longCost as number).toBeGreaterThan(shortCost as number);
  });
});

describe('NVIDIABackendAdapter.estimateCost', () => {
  const adapter = new NVIDIABackendAdapter({ apiKey: 'test-key' });

  it('computes cost directly from token count, not from a re-multiplied dollar amount', async () => {
    const request = makeRequest('Hello there, this is a test message for token estimation.', 500);
    const cost = await adapter.estimateCost(request);

    const expectedInputTokens = estimateTokens(request);
    const expectedOutputTokens = Math.min(500, 4000);
    const expected = (expectedInputTokens / 1_000_000) * 0.2 + (expectedOutputTokens / 1_000_000) * 0.2;

    expect(cost).not.toBeNull();
    expect(cost as number).toBeCloseTo(expected, 12);
    expect(cost as number).toBeGreaterThan(0);
    expect(cost as number).toBeLessThan(0.001);
  });

  it('scales with input length (proves it is not a near-constant near-zero value)', async () => {
    const shortCost = await adapter.estimateCost(makeRequest('Hi', 10));
    const longCost = await adapter.estimateCost(
      makeRequest('This is a much longer prompt. '.repeat(100), 10)
    );

    expect(shortCost).not.toBeNull();
    expect(longCost).not.toBeNull();
    expect(longCost as number).toBeGreaterThan(shortCost as number);
  });

  it('returns null for self-hosted/custom endpoints (unchanged behavior)', async () => {
    const selfHosted = new NVIDIABackendAdapter({
      apiKey: 'test-key',
      baseURL: 'https://my-self-hosted-nim.example.com/v1',
    });
    const cost = await selfHosted.estimateCost(makeRequest('Hello'));
    expect(cost).toBeNull();
  });
});
