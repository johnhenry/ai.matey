/**
 * Detection performance budget (#80)
 *
 * The default detection patterns run on **every user message** under a default
 * configuration - `createSecurityMiddleware` redacts by default (#55). Node is
 * single-threaded per process, so a pattern that backtracks is not one slow
 * request: it stalls every concurrent request on the instance.
 *
 * The default `email` pattern was quadratic in input length on text containing
 * no `@` at all. Measured on `'1.1.1'` repeated - ordinary developer text, no
 * PII anywhere - 10 KB cost 51 ms, 20 KB 213 ms, 40 KB 663 ms and 60 KB
 * 1542 ms. Doubling the input roughly quadrupled the work, so a handful of
 * innocuous-looking 60 KB messages is a trivial denial of service.
 *
 * **A correctness test cannot catch that.** This file is the thing that can:
 * it runs every pattern in `DEFAULT_PII_PATTERNS` and every pattern in
 * `DEFAULT_INJECTION_PATTERNS` against inputs built to be each pattern's worst
 * case, and fails if any of them blows the budget. It iterates the exported
 * records rather than a hard-coded list, so a pattern added later is measured
 * automatically instead of inheriting the same trap.
 *
 * ## Reading a failure
 *
 * The budget is deliberately loose - roughly 100x the headroom the current
 * patterns have - because CI machines are noisy and a flaky performance test
 * gets deleted. A failure here is not "this got 20% slower"; it is "this
 * pattern backtracks", which is a difference of three orders of magnitude.
 * The scaling test below is the sharper instrument: it asserts the *shape* of
 * the cost curve rather than its absolute value, so it is immune to a slow
 * machine.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PII_PATTERNS,
  DEFAULT_INJECTION_PATTERNS,
  detectPII,
  detectPromptInjection,
} from '@johnhenry/aimatey-middleware';

// ============================================================================
// Adversarial corpora
// ============================================================================

const KB = 1024;

const repeatTo = (unit: string, bytes: number): string =>
  unit.repeat(Math.ceil(bytes / unit.length)).slice(0, bytes);

/**
 * Each entry is the worst case for at least one default pattern. None of them
 * contains any actual PII or any actual injection attempt - the point is the
 * cost of *rejecting* them.
 */
const CORPORA: Record<string, (bytes: number) => string> = {
  // #80 as reported: version strings, no `@` anywhere. Worst case for `email`.
  'version strings, no @': (n) => repeatTo('1.1.1', n),
  // One unbroken run of local-part characters, still no `@`.
  'local-part run, no @': (n) => repeatTo('a.b_c%d+e-', n),
  // `@` everywhere but never a valid address: forces the tail to fail late.
  'dense @, never a TLD': (n) => repeatTo('aaaa@aaaa', n),
  'dense @, trailing dot': (n) => repeatTo('abc@def.', n),
  // Worst case for `ssn` / `phone` / `creditCard`.
  'digits and separators': (n) => repeatTo('123-45-', n),
  // Worst case for `ipAddress`.
  'dotted quads': (n) => repeatTo('192.168.1.', n),
  // Worst case for the `apiKey` prefix alternation: many near-prefix starts.
  'near key prefixes': (n) => repeatTo('sk-ant-api0 sk_live_ ghp_ xoxb- ', n),
  // Worst cases for the injection patterns: the trigger word without the rest.
  'ignore-prefix run': (n) => repeatTo('ignore all of the previous ', n),
  'ignore + whitespace run': (n) => repeatTo(`ignore${' '.repeat(2000)}`, n),
  'jailbreak framing run': (n) => repeatTo('you are now a DAN acting as developer ', n),
  // A control: ordinary prose, which is what almost every real message is.
  prose: (n) => repeatTo('The quick brown fox jumps over the lazy dog. ', n),
};

/** Best of three, after a warm-up, so JIT noise cannot inflate a budget. */
function fastest(run: () => void): number {
  run();
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

/**
 * Per-call cost, repeated enough times that one sample is ~10ms rather than a
 * fraction of one, and taken as the best of five samples.
 *
 * Both halves matter for the ratio assertions below, and both are the
 * difference between a useful test and a flaky one. A single 0.3ms measurement
 * is mostly timer noise, and a ratio of two noisy measurements is noise
 * squared. Taking the *minimum* is the right estimator here because contention
 * from another process on the machine can only ever inflate a sample, never
 * deflate one - so the best of five is the closest thing to an uncontended
 * reading that a shared runner will give up.
 *
 * The repeat count is derived from a probe rather than fixed, so a fast pattern
 * gets many iterations while a pathological one - which is exactly when this
 * test should fail - still returns in seconds instead of minutes.
 */
const SAMPLE_TARGET_MS = 10;
const SAMPLES = 5;

function perCall(run: () => void): number {
  run();
  const probeStart = performance.now();
  run();
  const probe = Math.max(performance.now() - probeStart, 0.001);
  const iterations = Math.max(1, Math.min(2000, Math.ceil(SAMPLE_TARGET_MS / probe)));

  let best = Infinity;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      run();
    }
    best = Math.min(best, (performance.now() - start) / iterations);
  }
  return best;
}

/**
 * Per-call budget for one pattern against one 60 KB input.
 *
 * Every current pattern lands under 0.4 ms; the quadratic `email` pattern took
 * ~1500 ms. 50 ms therefore has ~100x headroom over the real numbers while
 * still being ~30x below the bug it exists to catch.
 */
const BUDGET_MS = 50;
const SIZE = 60 * KB;

// ============================================================================
// Budget
// ============================================================================

describe('default detection patterns stay within budget on adversarial input (#80)', () => {
  const cases: Array<[string, string, RegExp]> = [];
  for (const corpus of Object.keys(CORPORA)) {
    for (const [name, pattern] of Object.entries(DEFAULT_PII_PATTERNS)) {
      cases.push([`pii:${name}`, corpus, pattern]);
    }
    DEFAULT_INJECTION_PATTERNS.forEach((pattern, index) => {
      cases.push([`injection:[${index}]`, corpus, pattern]);
    });
  }

  it.each(cases)('%s on 60KB of %s', (_name, corpus, pattern) => {
    const text = CORPORA[corpus]!(SIZE);
    const elapsed = fastest(() => {
      pattern.lastIndex = 0;
      text.match(pattern);
    });

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});

// ============================================================================
// Shape of the cost curve
// ============================================================================

/**
 * The sharper test. Asserting the *shape* of the cost curve rather than an
 * absolute time means a slow or loaded CI machine cannot make it fail, because
 * both measurements are slowed by the same factor.
 *
 * The inputs differ by 4x, which is what makes the two hypotheses easy to tell
 * apart: linear costs ~4x, quadratic ~16x. A 2x spread would put the answers at
 * 2 and 4 with nothing but measurement noise in between - that version of this
 * test failed on its first full run at a measured 3.04.
 */
const SCALING_FACTOR = 4;
const SCALING_LIMIT = 8;

describe('detection cost grows linearly, not quadratically (#80)', () => {
  it.each(Object.keys(CORPORA))('detectPII on %s scales linearly', (corpus) => {
    const make = CORPORA[corpus]!;
    const small = make(SIZE / SCALING_FACTOR);
    const large = make(SIZE);

    const smallMs = perCall(() => detectPII(small, DEFAULT_PII_PATTERNS));
    const largeMs = perCall(() => detectPII(large, DEFAULT_PII_PATTERNS));

    expect(largeMs / smallMs).toBeLessThan(SCALING_LIMIT);
  });

  it('the reported input no longer costs seconds', () => {
    // #80's exact reproduction: `'1.1.1'` repeated, no `@` anywhere.
    const text = repeatTo('1.1.1', 60 * KB);

    expect(detectPII(text, DEFAULT_PII_PATTERNS).detected).toBe(false);
    expect(perCall(() => detectPII(text, DEFAULT_PII_PATTERNS))).toBeLessThan(BUDGET_MS);
  });

  it('injection detection stays cheap on the same input', () => {
    const text = repeatTo('ignore all of the previous ', 60 * KB);

    expect(perCall(() => detectPromptInjection(text, DEFAULT_INJECTION_PATTERNS))).toBeLessThan(
      BUDGET_MS
    );
  });
});
