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
 * Iterations needed for one sample of `run` to take about `SAMPLE_TARGET_MS`.
 *
 * Derived from a probe rather than fixed, so a fast pattern gets many
 * iterations while a pathological one - which is exactly when these tests
 * should fail - still returns in seconds rather than minutes.
 */
const SAMPLE_TARGET_MS = 5;

function iterationsFor(run: () => void): number {
  run();
  const start = performance.now();
  run();
  const probe = Math.max(performance.now() - start, 0.001);
  return Math.max(1, Math.min(2000, Math.ceil(SAMPLE_TARGET_MS / probe)));
}

/** Mean cost of one call, over `iterations` back-to-back calls. */
function sample(run: () => void, iterations: number): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    run();
  }
  return (performance.now() - start) / iterations;
}

/**
 * Cost of `large` relative to `small`, measured as **interleaved pairs**.
 *
 * The obvious implementation - time `small`, then time `large`, then divide -
 * is what makes a scaling test flaky, and it failed here under load with
 * ratios up to 21x where the true value is 4x. The premise of a ratio
 * assertion is that a loaded machine slows both measurements by the same
 * factor, and that premise only holds if the two measurements happen at
 * roughly the same time. Taken minutes apart in a parallel test run, they see
 * different amounts of contention and the ratio measures the machine rather
 * than the pattern.
 *
 * So each sample times both sizes back to back and forms its own ratio, and
 * the result is the smallest ratio observed. Contention spanning a pair
 * cancels in that pair's division; contention hitting only one half inflates
 * that pair, and another pair is used instead. Taking the minimum is sound
 * because interference can only ever make a measurement slower, never faster.
 */
const SAMPLES = 7;

function scalingRatio(small: () => void, large: () => void): number {
  const smallIterations = iterationsFor(small);
  const largeIterations = iterationsFor(large);

  let best = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const smallMs = sample(small, smallIterations);
    const largeMs = sample(large, largeIterations);
    best = Math.min(best, largeMs / smallMs);
  }
  return best;
}

/** Best-of-five per-call cost, for the absolute-budget assertions. */
function perCall(run: () => void): number {
  const iterations = iterationsFor(run);
  let best = Infinity;
  for (let i = 0; i < 5; i++) {
    best = Math.min(best, sample(run, iterations));
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
 * absolute time is what catches a pattern that backtracks but happens to stay
 * under the budget at 60KB - it would not stay under it at 600KB.
 *
 * The inputs differ by 4x, which is what makes the two hypotheses easy to tell
 * apart: linear costs ~4x, quadratic ~16x. A 2x spread would put the answers at
 * 2 and 4 with nothing but measurement noise in between - that version of this
 * test failed on its first full run at a measured 3.04.
 *
 * The limit sits at 10 rather than at the 8 midpoint: measurement error here is
 * one-sided, since interference can only inflate a ratio, so the headroom is
 * spent on the side it is actually needed. 10 is still 1.6x below quadratic.
 * Measured ratios cluster at 3.9-4.1 on an idle machine and stayed under 5
 * under eight competing CPU-bound processes.
 */
const SCALING_FACTOR = 4;
const SCALING_LIMIT = 10;

describe('detection cost grows linearly, not quadratically (#80)', () => {
  it.each(Object.keys(CORPORA))('detectPII on %s scales linearly', (corpus) => {
    const make = CORPORA[corpus]!;
    const small = make(SIZE / SCALING_FACTOR);
    const large = make(SIZE);

    const ratio = scalingRatio(
      () => detectPII(small, DEFAULT_PII_PATTERNS),
      () => detectPII(large, DEFAULT_PII_PATTERNS)
    );

    expect(ratio).toBeLessThan(SCALING_LIMIT);
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
