/**
 * Structured output without Zod (issue #59)
 *
 * `zod` is an *optional* peer dependency, so the path this file exercises --
 * a consumer who never installed it -- is the one that actually runs for most
 * consumers of `@johnhenry/aimatey-utils`. It was also the broken one.
 *
 * `structured-output.ts` used to probe availability with a bare
 * `require('zod')`. In the CJS build that worked; in the ESM build (which is
 * what `"type": "module"` makes the default, and what every bundler picks up)
 * `require` is not defined, the `ReferenceError` was swallowed by the
 * surrounding `catch`, and *every* entry point threw
 * "Zod is required for structured output features but is not installed" --
 * including for consumers who had Zod installed and working.
 *
 * The fix removes the module probe entirely. The module never needed the `z`
 * namespace: every entry point is handed a schema the caller built, so the
 * schema *is* the injected Zod instance. What remains is a structural check on
 * that argument, which behaves identically in ESM, CJS and the browser.
 *
 * Note the deliberate omission: this file never imports `zod`. It models a
 * consumer who does not have it, so the assertions below hold in that world.
 *
 * Companion to `structured-output.test.ts` (the Zod-present behaviour) and to
 * `browser-safety.test.ts` (which now fails the build on any `require()` in a
 * package's `src` directory).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  schemaToToolDefinition,
  validateWithSchema,
  createGenerateObject,
  createStreamObject,
} from '@johnhenry/aimatey-utils';

/**
 * Values a consumer without Zod could plausibly end up passing: nothing at
 * all, a hand-written JSON Schema, a plain object, a string.
 */
const NON_SCHEMAS: Array<[label: string, value: unknown]> = [
  ['undefined', undefined],
  ['null', null],
  ['a plain object', { type: 'object', properties: { name: { type: 'string' } } }],
  ['a string', 'z.object({ name: z.string() })'],
  ['an array', [1, 2, 3]],
  ['a function', () => undefined],
  ['a bare object with only safeParse', { safeParse: () => ({ success: true, data: {} }) }],
];

function expectHelpfulZodError(thrown: unknown): void {
  expect(thrown).toBeInstanceOf(Error);
  const message = (thrown as Error).message;

  // Actionable: names the dependency and how to get it.
  expect(message).toContain('Zod schema');
  expect(message).toContain('npm install zod');

  // ...and specifically NOT the #59 failure: a module-system error, or the
  // old message that blamed a missing install even when Zod was present.
  expect(message).not.toContain('require is not defined');
  expect(thrown).not.toBeInstanceOf(ReferenceError);
}

const bridgeStub = () => {
  const executeIR = vi.fn();
  const executeIRStream = vi.fn();
  return {
    executeIR,
    executeIRStream,
    frontend: { metadata: { name: 'openai' } },
    config: { defaultModel: 'gpt-4o' },
  };
};

describe('structured output without zod installed (#59)', () => {
  it('imports the module without zod present', () => {
    // The import at the top of this file is the assertion: if the module
    // reached for `zod` (or `require`) at load time, this file could not be
    // collected at all.
    expect(typeof schemaToToolDefinition).toBe('function');
    expect(typeof validateWithSchema).toBe('function');
  });

  describe('schemaToToolDefinition', () => {
    it.each(NON_SCHEMAS)('throws an actionable error for %s', (_label, value) => {
      let thrown: unknown;
      try {
        schemaToToolDefinition(value as never, 'extract', 'Extract');
      } catch (error) {
        thrown = error;
      }
      expectHelpfulZodError(thrown);
    });

    it('names the offending parameter', () => {
      expect(() => schemaToToolDefinition(undefined as never)).toThrow(/`schema`/);
    });
  });

  describe('validateWithSchema', () => {
    it.each(NON_SCHEMAS)('throws an actionable error for %s', (_label, value) => {
      let thrown: unknown;
      try {
        validateWithSchema({ name: 'Alice' }, value as never);
      } catch (error) {
        thrown = error;
      }
      expectHelpfulZodError(thrown);
    });
  });

  describe('generateObject', () => {
    it('rejects with an actionable error and never calls the bridge', async () => {
      const bridge = bridgeStub();
      const generateObject = createGenerateObject(bridge as never);

      let thrown: unknown;
      try {
        await generateObject({ schema: undefined as never, prompt: 'hi' });
      } catch (error) {
        thrown = error;
      }

      expectHelpfulZodError(thrown);
      // Fail fast: the schema is checked before the retry loop, so a bad
      // schema costs zero provider calls rather than `maxRetries` of them.
      expect(bridge.executeIR).not.toHaveBeenCalled();
    });
  });

  describe('streamObject', () => {
    it('rejects with an actionable error and never opens a stream', async () => {
      const bridge = bridgeStub();
      const streamObject = createStreamObject(bridge as never);

      let thrown: unknown;
      try {
        for await (const _partial of streamObject({ schema: null as never, prompt: 'hi' })) {
          // unreachable
        }
      } catch (error) {
        thrown = error;
      }

      expectHelpfulZodError(thrown);
      expect(bridge.executeIRStream).not.toHaveBeenCalled();
    });
  });

  describe('the caller supplies the Zod instance', () => {
    // The corollary of removing the module probe: `utils` holds no runtime
    // reference to `zod`, so anything structurally shaped like a Zod schema
    // works. Real consumers pass real Zod schemas (covered in
    // `structured-output.test.ts`); this proves nothing is being loaded
    // behind their back.
    const duckTypedString = {
      _def: { typeName: 'ZodString' },
      description: 'A name',
      parse: (value: unknown) => value,
      safeParse: (value: unknown) => ({ success: true, data: value }),
    };

    const duckTypedObject = {
      _def: { typeName: 'ZodObject' },
      shape: { name: duckTypedString },
      parse: (value: unknown) => value,
      safeParse: (value: unknown) => ({ success: true, data: value }),
    };

    it('converts a structurally-Zod schema to a tool definition', () => {
      const toolDef = schemaToToolDefinition(duckTypedObject, 'extract', 'Extract');

      expect(toolDef).toEqual({
        type: 'function',
        function: {
          name: 'extract',
          description: 'Extract',
          parameters: {
            type: 'object',
            properties: { name: { type: 'string', description: 'A name' } },
            required: ['name'],
          },
        },
      });
    });

    it('delegates validation to the supplied schema', () => {
      const safeParse = vi.fn(() => ({ success: true, data: { name: 'Alice' } }));
      const schema = { ...duckTypedObject, safeParse };

      const result = validateWithSchema({ name: 'Alice' }, schema);

      expect(safeParse).toHaveBeenCalledWith({ name: 'Alice' });
      expect(result).toEqual({ success: true, data: { name: 'Alice' } });
    });
  });
});
