/**
 * Stable, dependency-free string hashing for cache keys.
 *
 * The middleware caches key their entries on a hash of `JSON.stringify(...)`
 * of the cacheable parts of a request. That hash is an *index*, not a
 * security primitive, so it does not need to be cryptographic -- and it must
 * not drag Node's `crypto` module into the module graph, because
 * `@johnhenry/aimatey-middleware` is consumed from browsers, webviews,
 * Capacitor and Electron renderers, where bundlers externalize `crypto` and
 * `createHash` ends up `undefined` at runtime.
 *
 * {@link stableHash} therefore implements FNV-1a (64-bit) in pure JavaScript,
 * run as two independently-seeded lanes and finalized with Murmur3's
 * `fmix32` avalanche step, producing a 128-bit digest as 32 lowercase hex
 * characters.
 *
 * Properties:
 * - **Deterministic and portable.** Only `charCodeAt`, 32-bit integer
 *   arithmetic and `Math.imul` are used, all of which are exactly specified
 *   by ECMAScript. The same input produces the same digest in every engine,
 *   on every platform, forever.
 * - **Total over UTF-16.** Each code unit is fed to the hash as two bytes,
 *   so the mapping from string to byte stream is injective: surrogate pairs
 *   (emoji), combining marks, and even lone surrogates all hash distinctly.
 *   No `TextEncoder` is required (and its U+FFFD substitution for lone
 *   surrogates is avoided).
 * - **Wide enough for a cache.** 128 bits puts the 50%-collision birthday
 *   bound around 2^64 entries, versus ~77,000 for a 32-bit key.
 *
 * This is *not* a cryptographic hash: it is trivially invertible and offers
 * no preimage or second-preimage resistance. Do not use it for signatures,
 * integrity checks or anything an adversary is motivated to collide.
 *
 * Cost, measured on Node 24 / Apple silicon: ~0.9 µs for a typical single-turn
 * request key (~80 bytes) and ~115 µs for a 20-message conversation (~11 KB),
 * against 0.33 µs and 4 µs for native `createHash('sha256')`. Native SHA-256
 * wins on throughput -- it is a hardware instruction -- but at these absolute
 * numbers a cache lookup is still four orders of magnitude cheaper than the
 * inference call it avoids.
 *
 * @module
 */

// FNV-1a 64-bit offset basis: 0xcbf29ce484222325
const OFFSET_A_HI = 0xcbf29ce4;
const OFFSET_A_LO = 0x84222325;

// Second lane seed (the 64-bit golden-ratio constant, 0x9e3779b97f4a7c15).
// FNV is seeded by varying the offset basis.
const OFFSET_B_HI = 0x9e3779b9;
const OFFSET_B_LO = 0x7f4a7c15;

/**
 * One FNV-1a 64-bit lane over the UTF-16 code units of `input`.
 *
 * JavaScript numbers cannot hold a 64-bit product, so the state is kept as
 * two 32-bit halves and the multiplication by the FNV prime
 * `0x100000001b3` is expanded using the identity
 *
 * ```text
 * h * 0x100000001b3  ==  (h << 40) + (h << 8) + h * 0xb3   (mod 2^64)
 * ```
 *
 * since `0x100000001b3 == 2^40 + 2^8 + 0xb3`. Every intermediate stays
 * below 2^53 and is therefore exact.
 *
 * All carries are computed with `Math.imul` and 16-bit limbs rather than
 * `Math.floor(x / 2 ** 32)`; the float divisions dominated the profile and
 * removing them makes the whole hash ~3x faster.
 */
function fnv1a64(input: string, offsetHi: number, offsetLo: number): { hi: number; lo: number } {
  let hi = offsetHi >>> 0;
  let lo = offsetLo >>> 0;
  const length = input.length;

  for (let i = 0; i < length; i++) {
    const unit = input.charCodeAt(i);

    // Feed the code unit as two bytes (low first). Doing this per code unit
    // rather than per code point keeps the string -> byte stream mapping
    // injective for every possible JS string.
    for (let half = 0; half < 2; half++) {
      const byte = half === 0 ? unit & 0xff : unit >>> 8;

      // h ^= byte -- the byte only ever touches the low 8 bits.
      lo = (lo ^ byte) >>> 0;

      // h << 8. Its low half doubles as the high half of h << 40, because
      // shifting h left by 40 moves lo's low 24 bits into hi's bits 8..31
      // and drops everything else past 2^64.
      const shiftedLo = (lo << 8) >>> 0;
      const shiftedHi = ((hi << 8) | (lo >>> 24)) >>> 0;

      // h * 0xb3, in 16-bit limbs so nothing exceeds 2^24.
      const lowProduct = (lo & 0xffff) * 0xb3;
      const highProduct = (lo >>> 16) * 0xb3;
      const productLo = (lowProduct + ((highProduct & 0xffff) << 16)) >>> 0;
      const productHi =
        ((highProduct >>> 16) +
          Math.imul(hi, 0xb3) +
          (lowProduct + (highProduct & 0xffff) * 65536 > 4294967295 ? 1 : 0)) >>>
        0;

      // Sum the three terms. (h << 40) contributes nothing to the low half.
      const sum = shiftedLo + productLo;
      lo = sum >>> 0;
      hi = (shiftedLo + shiftedHi + productHi + (sum > 4294967295 ? 1 : 0)) >>> 0;
    }
  }

  return { hi, lo };
}

/**
 * Murmur3 32-bit finalizer. A bijection on uint32, so it improves avalanche
 * (making short prefixes of the digest usable) without introducing any
 * collisions of its own.
 */
function fmix32(value: number): number {
  let h = value >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function toHex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hash a string to a stable 128-bit digest, rendered as 32 lowercase hex
 * characters.
 *
 * Non-cryptographic. Intended for cache keys and other content-addressed
 * lookups. Works identically in Node, Deno, Bun, browsers and webviews, and
 * is synchronous (unlike `crypto.subtle.digest`).
 *
 * @example
 * ```typescript
 * stableHash(JSON.stringify({ model: 'gpt-4o', messages }));
 * // => '3f2a...'  (32 hex chars)
 * ```
 */
export function stableHash(input: string): string {
  const a = fnv1a64(input, OFFSET_A_HI, OFFSET_A_LO);
  const b = fnv1a64(input, OFFSET_B_HI, OFFSET_B_LO);

  return toHex8(fmix32(a.hi)) + toHex8(fmix32(a.lo)) + toHex8(fmix32(b.hi)) + toHex8(fmix32(b.lo));
}
