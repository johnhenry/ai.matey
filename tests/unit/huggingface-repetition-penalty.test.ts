/**
 * Regression tests: the Hugging Face adapter must map IR `frequencyPenalty`
 * onto a `repetition_penalty` that is inside Hugging Face's accepted domain.
 *
 * Previously the adapter used
 *   `frequencyPenalty ? 1 + frequencyPenalty : undefined`
 * which had two defects (#87):
 *
 *  1. Truthiness dropped an explicit `frequencyPenalty: 0` -- a valid, neutral
 *     value distinct from "unset", and the value used by the IR's own
 *     documented example -- so it silently became `undefined`.
 *  2. Negative values are truthy, so they passed the guard and went through
 *     `1 + x`, yielding `0` at `x === -1` and negatives below that.
 *
 * `repetition_penalty` is a strictly positive multiplicative parameter:
 * text-generation-inference rejects `<= 0.0` outright
 * (`ValidationError::RepetitionPenalty`; its OpenAPI schema declares
 * `exclusive_minimum = 0.0`) and `transformers`'
 * `RepetitionPenaltyLogitsProcessor` raises on any non-positive penalty. So the
 * old behaviour did not merely degrade quality, it produced requests the
 * provider refuses.
 */

import { describe, it, expect } from 'vitest';
import { HuggingFaceBackendAdapter } from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

function makeIRRequest(frequencyPenalty?: number): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello!' }],
    parameters: {
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      ...(frequencyPenalty === undefined ? {} : { frequencyPenalty }),
    },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
  };
}

describe('Hugging Face adapter repetition_penalty mapping', () => {
  const adapter = new HuggingFaceBackendAdapter({ apiKey: 'test-key' });

  const penaltyFor = (frequencyPenalty?: number): number | undefined =>
    adapter.fromIR(makeIRRequest(frequencyPenalty)).parameters?.repetition_penalty;

  it('maps an explicit frequencyPenalty of 0 to the neutral 1, not undefined', () => {
    expect(penaltyFor(0)).toBe(1);
  });

  it('omits repetition_penalty entirely when frequencyPenalty is unset', () => {
    expect(penaltyFor(undefined)).toBeUndefined();
  });

  it('maps positive penalties through 1 + x, as before', () => {
    expect(penaltyFor(0.5)).toBe(1.5);
    expect(penaltyFor(1)).toBe(2);
    expect(penaltyFor(2)).toBe(3);
  });

  it('keeps negative penalties strictly positive instead of emitting 0 or less', () => {
    // The pre-fix transform produced 0 here, which TGI rejects outright.
    expect(penaltyFor(-1)).toBe(0.5);
    // The pre-fix transform produced -1 here.
    expect(penaltyFor(-2)).toBeCloseTo(1 / 3, 10);
  });

  it('never emits a non-positive repetition_penalty anywhere in the IR range', () => {
    for (let x = -2; x <= 2.0001; x += 0.05) {
      const penalty = penaltyFor(Number(x.toFixed(4)));
      expect(penalty).toBeDefined();
      expect(penalty as number).toBeGreaterThan(0);
    }
  });

  it('keeps the mapping monotonically increasing across the IR range', () => {
    const samples = [-2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 2];
    const penalties = samples.map((x) => penaltyFor(x) as number);

    for (let i = 1; i < penalties.length; i++) {
      expect(penalties[i] as number).toBeGreaterThan(penalties[i - 1] as number);
    }
  });

  it('places negative penalties below the neutral 1 and positive ones above', () => {
    // HF documents 0 < p < 1 as "encourage repetition" and p > 1 as
    // "discourage", matching the sign convention of IR frequencyPenalty.
    expect(penaltyFor(-0.5) as number).toBeLessThan(1);
    expect(penaltyFor(0.5) as number).toBeGreaterThan(1);
  });

  it('clamps out-of-range IR values rather than leaving the HF domain', () => {
    expect(penaltyFor(50)).toBe(3);
    expect(penaltyFor(-50)).toBeCloseTo(1 / 3, 10);
  });
});
