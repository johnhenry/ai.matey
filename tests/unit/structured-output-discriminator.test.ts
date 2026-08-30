/**
 * How `zodToJsonSchema` decides *what kind of schema it is looking at* (#66).
 *
 * Before this fix the discriminator read `_def.typeName || schema.constructor.name`.
 * Zod v4 has no `typeName`, so on the major most consumers are installing it
 * relied entirely on `constructor.name` -- a class *identifier*. esbuild and
 * Vite happen to preserve those, but a name-mangling minifier does not, and
 * losing them did not break one branch: it broke every branch at once and
 * degraded every field of every schema to `{ type: 'string' }`, silently,
 * only in the production bundle.
 *
 * The replacement keys off string *data* Zod stores in `_def` -- `typeName`
 * ('ZodString') on v3, `type` ('string') on v4 -- with `constructor.name` kept
 * only as a last resort. String literals survive any minifier.
 *
 * These tests are separated from `structured-output.test.ts` because they are
 * not schema-conversion assertions: they drive a real esbuild bundle and
 * hand-built schema shapes, and they exist to pin the *mechanism*.
 *
 * The v3-shaped schemas below are also the only coverage of the `zod@^3` half
 * of the declared peer range (`^3.0.0 || ^4.0.0`); the repo installs v4. Their
 * shapes were taken from a real zod@3.25.76: `_def.typeName`, `_def.value` for
 * a literal, `_def.values` for an enum, `_def.type` for an array element and
 * `_def.shape()` as a thunk.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { schemaToToolDefinition } from '@johnhenry/aimatey-utils';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Workspace packages reached at *runtime* from the bundled sources.
 *
 * The suite runs straight from `src` and `npm test` never builds `dist`, so
 * node resolution -- which these standalone esbuild bundles use, unlike every
 * other test, which goes through `vitest.config.ts`'s aliases -- would fail
 * on the package entry points. `import type` specifiers are erased before
 * esbuild resolves anything, so only real imports need listing.
 */
const WORKSPACE_ALIAS = {
  '@johnhenry/aimatey-errors': join(repoRoot, 'packages/ai.matey.errors/src/index.ts'),
  '@johnhenry/aimatey-types': join(repoRoot, 'packages/ai.matey.types/src/index.ts'),
};

// ============================================================================
// Hand-built schema shapes: no usable constructor name at all
// ============================================================================

/** A schema-shaped object with a null prototype -- `constructor` is undefined. */
function bare(def: Record<string, unknown>, description?: string): any {
  const schema = Object.create(null);
  schema._def = def;
  schema.parse = (value: unknown) => value;
  schema.safeParse = (value: unknown) => ({ success: true, data: value });
  if (description !== undefined) schema.description = description;
  return schema;
}

const parametersOf = (schema: any): any =>
  schemaToToolDefinition(schema, 'extract', 'Extract').function.parameters;

describe('zod type discrimination (#66)', () => {
  describe('with no constructor name available at all', () => {
    it('converts a zod v4 shape from _def.type', () => {
      // v4: `_def.type` is a string constant.
      const schema = bare({
        type: 'object',
        shape: {
          id: bare({
            type: 'union',
            options: [bare({ type: 'string' }), bare({ type: 'number' })],
          }),
          when: bare({ type: 'date' }),
          kind: bare({ type: 'literal', values: ['user'] }),
          note: bare({ type: 'nullable', innerType: bare({ type: 'string' }) }),
          meta: bare({
            type: 'record',
            keyType: bare({ type: 'string' }),
            valueType: bare({ type: 'string' }),
          }),
        },
      });

      expect(parametersOf(schema).properties).toEqual({
        id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        when: { type: 'string', format: 'date-time' },
        kind: { type: 'string', enum: ['user'] },
        note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        meta: { type: 'object', additionalProperties: { type: 'string' } },
      });
    });

    it('converts a zod v3 shape from _def.typeName', () => {
      // v3: `_def.typeName` is a string constant, `_def.shape` a thunk,
      // `_def.type` the *element* of an array (an object, not a tag).
      const string3 = bare({ typeName: 'ZodString' });
      const schema = bare({
        typeName: 'ZodObject',
        shape: () => ({
          id: bare({
            typeName: 'ZodUnion',
            options: [string3, bare({ typeName: 'ZodNumber' })],
          }),
          tags: bare({ typeName: 'ZodArray', type: string3 }),
          kind: bare({ typeName: 'ZodLiteral', value: 'user' }),
          status: bare({ typeName: 'ZodEnum', values: ['on', 'off'] }),
          note: bare({ typeName: 'ZodNullable', innerType: string3 }),
          nick: bare({ typeName: 'ZodOptional', innerType: string3 }),
          when: bare({ typeName: 'ZodDate' }),
        }),
      });

      const parameters = parametersOf(schema);

      expect(parameters.properties).toEqual({
        id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        tags: { type: 'array', items: { type: 'string' } },
        kind: { type: 'string', enum: ['user'] },
        status: { type: 'string', enum: ['on', 'off'] },
        note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        nick: { type: 'string' },
        when: { type: 'string', format: 'date-time' },
      });
      // `.optional()` is the only one dropped from required; `.nullable()`
      // stays, because Zod still requires the key to be present.
      expect(parameters.required).toEqual(['id', 'tags', 'kind', 'status', 'note', 'when']);
    });
  });

  it('trusts _def over a misleading constructor name', () => {
    // The failure mode of the old discriminator in reverse: if
    // `constructor.name` were consulted first, this would convert as a string.
    class ZodString {
      _def = {
        type: 'union',
        options: [bare({ type: 'string' }), bare({ type: 'boolean' })],
      };
      parse = (value: unknown) => value;
      safeParse = (value: unknown) => ({ success: true, data: value });
    }

    expect(
      parametersOf(bare({ type: 'object', shape: { field: new ZodString() } })).properties
    ).toEqual({ field: { anyOf: [{ type: 'string' }, { type: 'boolean' }] } });
  });

  // ==========================================================================
  // The real thing: an aggressively minified bundle
  // ==========================================================================

  describe('inside a minified bundle', () => {
    let outDir: string;
    let bundled: { convert: (label: string) => unknown };

    beforeAll(async () => {
      outDir = mkdtempSync(join(tmpdir(), 'aimatey-minified-'));

      const outfile = join(outDir, 'bundle.mjs');

      // A consumer-shaped entry point: real Zod, real converter, one bundle.
      const entry = `
        import { z } from 'zod';
        import { schemaToToolDefinition } from './packages/ai.matey.utils/src/structured-output.ts';

        const schemas = {
          union: z.object({ field: z.union([z.string(), z.number()]) }),
          record: z.object({ field: z.record(z.string(), z.string()) }),
          date: z.object({ field: z.date() }),
          literal: z.object({ field: z.literal('user') }),
          nullable: z.object({ field: z.string().nullable() }),
          optional: z.object({ field: z.string().optional() }),
          array: z.object({ field: z.array(z.number()) }),
          enum: z.object({ field: z.enum(['a', 'b']) }),
          nested: z.object({ field: z.object({ inner: z.boolean() }) }),
          unsupported: z.object({ field: z.bigint() }),
        };

        export function convert(label) {
          const toolDef = schemaToToolDefinition(schemas[label], 'extract', 'Extract');
          return { parameters: toolDef.function.parameters, warnings: toolDef.warnings ?? [] };
        }
      `;

      buildSync({
        stdin: { contents: entry, resolveDir: repoRoot, loader: 'ts', sourcefile: 'entry.ts' },
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'es2022',
        alias: WORKSPACE_ALIAS,
        // The aggressive settings: mangle everything that can be mangled and
        // explicitly do *not* preserve function/class names.
        minify: true,
        minifyIdentifiers: true,
        keepNames: false,
        legalComments: 'none',
        outfile,
      });

      const module = (await import(pathToFileURL(outfile).href)) as {
        convert: (label: string) => any;
      };

      bundled = { convert: module.convert };
    });

    afterAll(() => {
      rmSync(outDir, { recursive: true, force: true });
    });

    it.each([
      ['union', { anyOf: [{ type: 'string' }, { type: 'number' }] }],
      ['record', { type: 'object', additionalProperties: { type: 'string' } }],
      ['date', { type: 'string', format: 'date-time' }],
      ['literal', { type: 'string', enum: ['user'] }],
      ['nullable', { anyOf: [{ type: 'string' }, { type: 'null' }] }],
      ['optional', { type: 'string' }],
      ['array', { type: 'array', items: { type: 'number' } }],
      ['enum', { type: 'string', enum: ['a', 'b'] }],
      [
        'nested',
        { type: 'object', properties: { inner: { type: 'boolean' } }, required: ['inner'] },
      ],
    ])('still converts %s correctly after minification', (label, expected) => {
      expect((bundled.convert(label as string) as any).parameters.properties.field).toEqual(
        expected
      );
    });

    it('still warns, rather than claiming string, for an unrepresentable type', () => {
      const result = bundled.convert('unsupported') as any;

      expect(result.parameters.properties.field).toEqual({});
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].category).toBe('content-type-unsupported');
    });
  });
});

// A minified bundle is only evidence if it really is minified.
describe('the minified fixture is actually minified', () => {
  it('mangles identifiers and drops formatting', () => {
    const built = buildSync({
      stdin: {
        contents: `
          import { schemaToToolDefinition } from './packages/ai.matey.utils/src/structured-output.ts';
          export const run = (schema) => schemaToToolDefinition(schema, 'extract', 'Extract');
        `,
        resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
        loader: 'ts',
        sourcefile: 'entry.ts',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      alias: WORKSPACE_ALIAS,
      minify: true,
      keepNames: false,
      write: false,
    });

    const source = built.outputFiles[0]?.text ?? '';

    // Internal function names are gone...
    expect(source).not.toContain('zodTypeTag');
    expect(source).not.toContain('convertByTag');
    // ...but the tags the discriminator keys on are string data, so they
    // survive verbatim. This is the property the fix depends on.
    expect(source).toContain('typeName');
    expect(source).toContain('nullable');
  });
});
