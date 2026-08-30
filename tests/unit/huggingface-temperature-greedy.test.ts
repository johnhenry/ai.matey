/**
 * Regression tests: the Hugging Face adapter must express "decode greedily" in
 * Hugging Face's own vocabulary rather than sending a `temperature` the
 * provider refuses.
 *
 * Previously `fromIR` built, in one object literal (#93):
 *   temperature: request.parameters?.temperature,          // sent raw
 *   top_p:       request.parameters?.topP,                 // sent raw
 *   top_k:       request.parameters?.topK,                 // sent raw
 *   do_sample:   temperature !== undefined && temperature > 0
 *
 * For `temperature: 0` that computes `do_sample: false` -- correct, since that
 * is how greedy decoding is expressed here -- and then sends `temperature: 0`
 * alongside it, which is exactly what the provider rejects.
 *
 * What text-generation-inference actually does, read from its source:
 *
 *  1. `router/src/validation.rs` validates
 *     `temperature.unwrap_or(1.0) <= 0.0 -> ValidationError::Temperature`
 *     ("`temperature` must be strictly positive"). This runs unconditionally,
 *     before and independently of `do_sample`, so `do_sample: false` does not
 *     excuse the zero -- the request fails validation and never reaches the
 *     model. An *omitted* temperature defaults to 1.0 and passes.
 *
 *  2. `server/text_generation_server/utils/tokens.py` decides sampling with
 *       has_warpers = (temperature != 1.0) or (top_k != 0) or (top_p < 1.0) ...
 *       sampling    = do_sample or has_warpers
 *       self.choice = Sampling(...) if sampling else Greedy()
 *     so `top_p`/`top_k` are not ignored under `do_sample: false` -- they
 *     *promote* the request back to sampling, silently overriding it. The
 *     batched `HeterogeneousNextTokenChooser` promotes the same way per request.
 *
 * Hence greedy requests must omit `temperature`, `top_p` and `top_k` together
 * and let TGI's defaults (1.0 / 1.0 / 0) leave `has_warpers` false, so
 * `do_sample: false` is what decides.
 */

import { describe, it, expect } from 'vitest';
import { HuggingFaceBackendAdapter } from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

function makeIRRequest(parameters: Record<string, unknown> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'Hello!' }],
    parameters: {
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      ...parameters,
    },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
  } as IRChatRequest;
}

describe('Hugging Face adapter temperature -> greedy decoding mapping (#93)', () => {
  const adapter = new HuggingFaceBackendAdapter({ apiKey: 'test-key' });

  const paramsFor = (parameters: Record<string, unknown> = {}) =>
    adapter.fromIR(makeIRRequest(parameters)).parameters;

  // --------------------------------------------------------------------------
  // What reaches the wire for each temperature, plus do_sample in each case.
  // --------------------------------------------------------------------------

  describe('temperature: 0 (the deterministic setting)', () => {
    it('omits temperature entirely rather than sending the rejected 0', () => {
      const params = paramsFor({ temperature: 0 });
      expect(params?.temperature).toBeUndefined();
    });

    it('sets do_sample: false, which is how HF expresses greedy decoding', () => {
      expect(paramsFor({ temperature: 0 })?.do_sample).toBe(false);
    });

    it('does not serialize a temperature key onto the wire at all', () => {
      // `undefined` is dropped by JSON.stringify, so the field is genuinely
      // absent from the request body TGI validates -- it is not sent as null.
      const body = JSON.stringify(adapter.fromIR(makeIRRequest({ temperature: 0 })));
      expect(body).not.toContain('temperature');
      expect(JSON.parse(body).parameters).not.toHaveProperty('temperature');
    });
  });

  describe('a small positive temperature', () => {
    it('sends the value through unchanged', () => {
      expect(paramsFor({ temperature: 0.2 })?.temperature).toBe(0.2);
    });

    it('sets do_sample: true', () => {
      expect(paramsFor({ temperature: 0.2 })?.do_sample).toBe(true);
    });
  });

  describe('a large temperature', () => {
    it('sends the value through unchanged', () => {
      expect(paramsFor({ temperature: 2 })?.temperature).toBe(2);
    });

    it('sets do_sample: true', () => {
      expect(paramsFor({ temperature: 2 })?.do_sample).toBe(true);
    });
  });

  describe('temperature: undefined (unset)', () => {
    it('omits temperature', () => {
      expect(paramsFor()?.temperature).toBeUndefined();
    });

    it('sets do_sample: false, as before', () => {
      expect(paramsFor()?.do_sample).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // The parameter never leaves TGI's accepted domain.
  // --------------------------------------------------------------------------

  it('never emits a non-positive temperature, which TGI rejects outright', () => {
    for (let t = 0; t <= 2.0001; t += 0.05) {
      const temperature = paramsFor({ temperature: Number(t.toFixed(4)) })?.temperature;
      if (temperature !== undefined) {
        expect(temperature).toBeGreaterThan(0);
      }
    }
  });

  it('emits a temperature exactly when it is sampling', () => {
    // If do_sample is false the request is greedy and must carry no temperature;
    // if it is true the temperature is meaningful and strictly positive.
    for (const temperature of [undefined, 0, 0.01, 0.5, 1, 1.5, 2]) {
      const params = paramsFor(temperature === undefined ? {} : { temperature });
      if (params?.do_sample) {
        expect(params.temperature).toBeGreaterThan(0);
      } else {
        expect(params?.temperature).toBeUndefined();
      }
    }
  });

  // --------------------------------------------------------------------------
  // top_p / top_k must not defeat the greedy request.
  // --------------------------------------------------------------------------

  describe('top_p / top_k under greedy decoding', () => {
    it('omits top_p and top_k when temperature is 0, so they cannot re-enable sampling', () => {
      const params = paramsFor({ temperature: 0, topP: 0.9, topK: 40 });

      expect(params?.do_sample).toBe(false);
      // TGI computes `sampling = do_sample or has_warpers`, and both
      // `top_p < 1.0` and `top_k != 0` set has_warpers -- either one would
      // silently override do_sample: false and sample anyway.
      expect(params?.top_p).toBeUndefined();
      expect(params?.top_k).toBeUndefined();
    });

    it('leaves nothing in the greedy body that TGI would treat as a warper', () => {
      const body = JSON.parse(
        JSON.stringify(adapter.fromIR(makeIRRequest({ temperature: 0, topP: 0.9, topK: 40 })))
      );

      expect(body.parameters).not.toHaveProperty('temperature');
      expect(body.parameters).not.toHaveProperty('top_p');
      expect(body.parameters).not.toHaveProperty('top_k');
      expect(body.parameters.do_sample).toBe(false);
    });

    it('still forwards top_p and top_k when the request is actually sampling', () => {
      const params = paramsFor({ temperature: 0.7, topP: 0.9, topK: 40 });

      expect(params?.do_sample).toBe(true);
      expect(params?.top_p).toBe(0.9);
      expect(params?.top_k).toBe(40);
    });

    it('leaves the unset-temperature case alone, forwarding top_p and top_k as before', () => {
      // Only an explicit `temperature: 0` signals greedy intent. An unset
      // temperature is not a request to decode greedily, so this path is
      // deliberately unchanged by #93.
      const params = paramsFor({ topP: 0.9, topK: 40 });

      expect(params?.top_p).toBe(0.9);
      expect(params?.top_k).toBe(40);
    });
  });

  // --------------------------------------------------------------------------
  // The greedy path must not disturb the neighbouring parameters.
  // --------------------------------------------------------------------------

  it('keeps the other parameters intact on a greedy request', () => {
    const params = paramsFor({ temperature: 0, maxTokens: 128, frequencyPenalty: 0.5 });

    expect(params?.max_new_tokens).toBe(128);
    expect(params?.repetition_penalty).toBe(1.5);
    expect(params?.return_full_text).toBe(false);
  });
});
