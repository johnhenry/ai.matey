/**
 * Structured Output with Zod - TDD Test Suite
 *
 * Tests for Zod schema integration, validation, and type inference.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { IRChatRequest, IRChatResponse } from '@johnhenry/aimatey-types';
import {
  createGenerateObject,
  schemaToToolDefinition,
  validateWithSchema,
  detectPII,
  redactPII,
  detectPromptInjection,
  sanitizeText,
  DEFAULT_PII_PATTERNS,
  DEFAULT_INJECTION_PATTERNS,
} from '@johnhenry/aimatey-utils';

// Types we'll need to implement for generateObject/streamObject
interface GenerateObjectOptions<T extends z.ZodType> {
  schema: T;
  prompt: string;
  model?: string;
  messages?: IRChatRequest['messages'];
  temperature?: number;
  maxRetries?: number;
}

interface GenerateObjectResult<T> {
  object: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

interface StreamObjectOptions<T extends z.ZodType> {
  schema: T;
  prompt: string;
  model?: string;
  messages?: IRChatRequest['messages'];
  onPartial?: (partial: Partial<z.infer<T>>) => void;
}

// These will be implemented in the next phase
declare function generateObject<T extends z.ZodType>(
  options: GenerateObjectOptions<T>
): Promise<GenerateObjectResult<z.infer<T>>>;

declare function streamObject<T extends z.ZodType>(
  options: StreamObjectOptions<T>
): AsyncGenerator<Partial<z.infer<T>>, z.infer<T>>;

// ============================================================================
// Test Suite
// ============================================================================

describe('Structured Output with Zod', () => {
  // ============================================================================
  // 1. Schema to Tool Definition Converter
  // ============================================================================

  describe('schemaToToolDefinition', () => {
    it('should convert simple Zod object schema to tool definition', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const toolDef = schemaToToolDefinition(schema, 'get_user', 'Get user information');

      expect(toolDef).toEqual({
        type: 'function',
        function: {
          name: 'get_user',
          description: 'Get user information',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name', 'age'],
          },
        },
      });
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().optional(),
      });

      const toolDef = schemaToToolDefinition(schema, 'user');

      expect(toolDef.function.parameters.required).toEqual(['name']);
      expect(toolDef.function.parameters.properties.email).toBeDefined();
    });

    it('should handle nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
        metadata: z.object({
          createdAt: z.string(),
        }),
      });

      const toolDef = schemaToToolDefinition(schema, 'complex');

      expect(toolDef.function.parameters.properties.user.type).toBe('object');
      expect(toolDef.function.parameters.properties.user.properties.name.type).toBe('string');
    });

    it('should handle arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()),
        scores: z.array(z.number()),
      });

      const toolDef = schemaToToolDefinition(schema, 'arrays');

      expect(toolDef.function.parameters.properties.tags).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should handle enums', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']),
      });

      const toolDef = schemaToToolDefinition(schema, 'status');

      expect(toolDef.function.parameters.properties.status).toEqual({
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      });
    });

    it('should include Zod descriptions in schema', () => {
      const schema = z.object({
        name: z.string().describe('The user full name'),
        age: z.number().describe('Age in years'),
      });

      const toolDef = schemaToToolDefinition(schema, 'user');

      expect(toolDef.function.parameters.properties.name.description).toBe('The user full name');
      expect(toolDef.function.parameters.properties.age.description).toBe('Age in years');
    });
  });

  // ============================================================================
  // 1b. JSON Schema conversion fidelity (#66)
  // ============================================================================

  /**
   * The converted JSON Schema *is* the tool contract sent to the provider.
   * Before #66 every type the converter did not recognize fell through to
   * `{ type: 'string' }`: the model was told to return a string for a field
   * that had to be a union/record/date/literal, it obliged, `validateWithSchema`
   * rejected the response, and `generateObject` burned every retry before
   * throwing -- with nothing anywhere saying the schema was the problem.
   *
   * `properties.<field>` is asserted directly, which is the level the bug
   * lived at.
   */
  describe('schemaToToolDefinition: JSON Schema conversion (#66)', () => {
    const convert = (schema: z.ZodType): any =>
      schemaToToolDefinition(schema, 'extract', 'Extract').function.parameters;

    const field = (schema: z.ZodType): any => convert(z.object({ field: schema })).properties.field;

    describe('the reported reproduction', () => {
      // The exact schema from the issue. Every property came back
      // `{ type: 'string' }`, and all five were listed in `required`.
      const reported = z.object({
        id: z.union([z.string(), z.number()]),
        meta: z.record(z.string(), z.string()),
        when: z.date(),
        kind: z.literal('user'),
        nullableNote: z.string().nullable(),
      });

      it('no longer describes every field as a plain string', () => {
        const properties = convert(reported).properties;

        for (const [name, property] of Object.entries<any>(properties)) {
          expect(property, `${name} is still degraded to a bare string`).not.toEqual({
            type: 'string',
          });
        }
      });

      it('converts each reported field to its real JSON Schema shape', () => {
        expect(convert(reported).properties).toEqual({
          id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          meta: { type: 'object', additionalProperties: { type: 'string' } },
          when: { type: 'string', format: 'date-time' },
          kind: { type: 'string', enum: ['user'] },
          nullableNote: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        });
      });
    });

    describe('types that already worked', () => {
      it.each([
        ['string', z.string(), { type: 'string' }],
        ['number', z.number(), { type: 'number' }],
        ['boolean', z.boolean(), { type: 'boolean' }],
        ['enum', z.enum(['a', 'b']), { type: 'string', enum: ['a', 'b'] }],
        ['array', z.array(z.number()), { type: 'array', items: { type: 'number' } }],
      ])('keeps %s unchanged', (_label, schema, expected) => {
        expect(field(schema as z.ZodType)).toEqual(expected);
      });
    });

    describe('types that silently degraded to string', () => {
      it('converts a union to anyOf', () => {
        expect(field(z.union([z.string(), z.number()]))).toEqual({
          anyOf: [{ type: 'string' }, { type: 'number' }],
        });
      });

      it('converts a discriminated union to anyOf over its members', () => {
        const schema = z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('a'), a: z.string() }),
          z.object({ kind: z.literal('b'), b: z.number() }),
        ]);

        expect(field(schema)).toEqual({
          anyOf: [
            {
              type: 'object',
              properties: { kind: { type: 'string', enum: ['a'] }, a: { type: 'string' } },
              required: ['kind', 'a'],
            },
            {
              type: 'object',
              properties: { kind: { type: 'string', enum: ['b'] }, b: { type: 'number' } },
              required: ['kind', 'b'],
            },
          ],
        });
      });

      it('converts an intersection to allOf', () => {
        const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));

        expect(field(schema)).toEqual({
          allOf: [
            { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
            { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
          ],
        });
      });

      it('converts a record to an object with typed additionalProperties', () => {
        expect(field(z.record(z.string(), z.number()))).toEqual({
          type: 'object',
          additionalProperties: { type: 'number' },
        });
      });

      it('converts a date to a date-time string', () => {
        expect(field(z.date())).toEqual({ type: 'string', format: 'date-time' });
      });

      it.each([
        ['a string literal', z.literal('user'), { type: 'string', enum: ['user'] }],
        ['a number literal', z.literal(42), { type: 'number', enum: [42] }],
        ['a boolean literal', z.literal(true), { type: 'boolean', enum: [true] }],
      ])('converts %s to a single-member enum', (_label, schema, expected) => {
        // `enum` rather than `const`: this schema is a provider wire format,
        // and `const` support across tool-schema validators is uneven.
        expect(field(schema as z.ZodType)).toEqual(expected);
      });

      it('converts a tuple to a positional array', () => {
        expect(field(z.tuple([z.string(), z.number()]))).toEqual({
          type: 'array',
          prefixItems: [{ type: 'string' }, { type: 'number' }],
          minItems: 2,
          maxItems: 2,
        });
      });

      it('describes the rest element of a variadic tuple', () => {
        expect(field(z.tuple([z.string()], z.number()))).toEqual({
          type: 'array',
          prefixItems: [{ type: 'string' }],
          minItems: 1,
          items: { type: 'number' },
        });
      });

      it('converts null to the null type', () => {
        expect(field(z.null())).toEqual({ type: 'null' });
      });
    });

    describe('nullable, optional and default', () => {
      it('allows null for a nullable field', () => {
        expect(field(z.string().nullable())).toEqual({
          anyOf: [{ type: 'string' }, { type: 'null' }],
        });
      });

      it('keeps a nullable field in required', () => {
        // Deliberate: `z.string().nullable()` rejects `undefined`, so the key
        // must be present -- it is the *value* that may be null. Dropping it
        // from `required` would invite the model to omit the key and reproduce
        // #66 in the other direction (schema says optional, Zod then rejects
        // the response). This matches Zod's own `z.toJSONSchema()`.
        expect(convert(z.object({ note: z.string().nullable() })).required).toEqual(['note']);
      });

      it.each([
        ['optional', z.string().optional()],
        ['nullish', z.string().nullish()],
        ['default', z.string().default('x')],
        ['catch', z.string().catch('x')],
      ])('omits a %s field from required', (_label, schema) => {
        const parameters = convert(z.object({ a: z.string(), b: schema as z.ZodType }));

        expect(parameters.required).toEqual(['a']);
        expect(parameters.properties.b).toBeDefined();
      });

      it('nests null inside the union for a nullable union', () => {
        expect(field(z.union([z.string(), z.number()]).nullable())).toEqual({
          anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
        });
      });

      it('carries the default value through', () => {
        expect(field(z.string().default('draft'))).toEqual({
          type: 'string',
          default: 'draft',
        });
      });

      it('unwraps transforms and pipes to the type the model must produce', () => {
        expect(field(z.string().transform((value) => value.length))).toEqual({ type: 'string' });
        expect(field(z.string().readonly())).toEqual({ type: 'string' });
      });
    });

    describe('nested and recursive schemas', () => {
      it('converts nested objects at every level', () => {
        const schema = z.object({
          user: z.object({
            contact: z.object({
              email: z.string().describe('Work address'),
              alt: z.string().nullable(),
            }),
          }),
        });

        expect(convert(schema).properties.user.properties.contact).toEqual({
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Work address' },
            alt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['email', 'alt'],
        });
      });

      it('terminates on a self-referencing schema instead of recursing forever', () => {
        const Category: any = z.object({
          name: z.string(),
          get children() {
            return z.array(Category).optional();
          },
        });

        const toolDef = schemaToToolDefinition(Category, 'extract', 'Extract');
        const parameters: any = toolDef.function.parameters;

        expect(parameters.properties.name).toEqual({ type: 'string' });
        // The repeated node is described as "any value" -- unconstrained, but
        // never a false claim, and flagged.
        expect(parameters.properties.children).toEqual({ type: 'array', items: {} });
        expect(toolDef.warnings?.some((warning) => /Recursive/i.test(warning.message))).toBe(true);
      });

      it('terminates on a z.lazy() cycle', () => {
        const Node: any = z.lazy(() =>
          z.object({ value: z.string(), next: (Node as z.ZodType).optional() })
        );

        const parameters: any = schemaToToolDefinition(
          z.object({ node: Node }),
          'extract',
          'Extract'
        ).function.parameters;

        expect(parameters.properties.node.properties.value).toEqual({ type: 'string' });
      });
    });

    describe('unconstrained and unrepresentable types', () => {
      it.each([
        ['any', z.any()],
        ['unknown', z.unknown()],
      ])('converts %s to the empty (any-value) schema without warning', (_label, schema) => {
        // `{}` is the JSON Schema spelling of "any value" -- an exact
        // rendering of z.any()/z.unknown(), so nothing was lost.
        const toolDef = schemaToToolDefinition(
          z.object({ field: schema as z.ZodType }),
          'extract',
          'Extract'
        );

        expect((toolDef.function.parameters as any).properties.field).toEqual({});
        expect(toolDef.warnings).toBeUndefined();
      });

      it.each([
        ['bigint', z.bigint()],
        ['symbol', z.symbol()],
        ['never', z.never()],
        ['custom', z.custom<() => void>()],
      ])('warns instead of claiming %s is a string', (label, schema) => {
        const toolDef = schemaToToolDefinition(
          z.object({ field: schema as z.ZodType }),
          'extract',
          'Extract'
        );
        const property = (toolDef.function.parameters as any).properties.field;

        // The regression the issue is about: never silently "string".
        expect(property).not.toEqual({ type: 'string' });
        expect(property).toEqual({});

        expect(toolDef.warnings).toHaveLength(1);
        expect(toolDef.warnings?.[0]).toMatchObject({
          category: 'content-type-unsupported',
          severity: 'warning',
          field: 'field',
          source: 'zod-json-schema',
        });
        // The message names the offending type.
        expect(toolDef.warnings?.[0]?.message).toContain(label);
      });

      it('names the field path of a nested unsupported type', () => {
        const toolDef = schemaToToolDefinition(
          z.object({ outer: z.object({ inner: z.array(z.bigint()) }) }),
          'extract',
          'Extract'
        );

        expect(toolDef.warnings?.[0]?.field).toBe('outer.inner.[]');
      });
    });

    describe('lossy but representable types', () => {
      it.each([
        ['date', z.date()],
        ['set', z.set(z.string())],
        ['map', z.map(z.string(), z.number())],
      ])('warns that %s does not survive the JSON round trip', (label, schema) => {
        const toolDef = schemaToToolDefinition(
          z.object({ field: schema as z.ZodType }),
          'extract',
          'Extract'
        );

        expect(toolDef.warnings).toHaveLength(1);
        expect(toolDef.warnings?.[0]?.category).toBe('content-type-unsupported');
        expect(toolDef.warnings?.[0]?.field).toBe('field');
        expect(toolDef.warnings?.[0]?.message).toContain(label);
      });

      it('is right that the round trip fails: z.date() rejects the string it asks for', () => {
        // Why the warning exists at all. The JSON Schema is now correct, but
        // JSON has no date type, so the model returns a string and z.date()
        // rejects it -- a second, independent reason generateObject would burn
        // its retries. The warning points at z.coerce.date().
        expect(z.date().safeParse('2026-01-01T00:00:00.000Z').success).toBe(false);
        expect(z.coerce.date().safeParse('2026-01-01T00:00:00.000Z').success).toBe(true);
      });
    });

    describe('warning plumbing', () => {
      it('attaches no warnings to a faithful conversion', () => {
        const toolDef = schemaToToolDefinition(
          z.object({ name: z.string(), tags: z.array(z.string()) }),
          'extract',
          'Extract'
        );

        // Absent, not empty: a clean conversion returns exactly the shape it
        // has always returned.
        expect(toolDef.warnings).toBeUndefined();
        expect(Object.prototype.hasOwnProperty.call(toolDef, 'warnings')).toBe(false);
      });

      it('reports every lossy field, once each', () => {
        const toolDef = schemaToToolDefinition(
          z.object({ when: z.date(), amount: z.bigint(), name: z.string() }),
          'extract',
          'Extract'
        );

        expect(toolDef.warnings?.map((warning) => warning.field)).toEqual(['when', 'amount']);
      });
    });

    /**
     * Where a lossy conversion actually surfaces. `zodToJsonSchema` returns a
     * plain JSON Schema with nowhere to put a warning, so the warnings ride
     * out on `ToolDefinition.warnings` (additive, absent when empty) and, for
     * the generateObject/streamObject path, on `IRChatRequest.metadata.warnings`
     * -- the IR channel CLAUDE.md nominates for semantic drift -- plus the text
     * of the failure the caller actually sees.
     */
    describe('reaching the caller through generateObject', () => {
      const stubBridge = (input: Record<string, unknown>) => {
        const requests: IRChatRequest[] = [];
        return {
          requests,
          bridge: {
            executeIR: async (request: IRChatRequest): Promise<IRChatResponse> => {
              requests.push(request);
              return {
                message: {
                  role: 'assistant' as const,
                  content: [
                    { type: 'tool_use' as const, id: 'call_1', name: 'extract_data', input },
                  ],
                },
                finishReason: 'tool_calls',
                metadata: {
                  requestId: request.metadata.requestId,
                  timestamp: Date.now(),
                  provenance: { backend: 'stub' },
                },
              };
            },
            frontend: { metadata: { name: 'openai' } },
            config: { defaultModel: 'gpt-4o' },
          },
        };
      };

      it('puts conversion warnings on the request metadata', async () => {
        const { bridge, requests } = stubBridge({ when: '2026-01-01T00:00:00.000Z' });

        await expect(
          createGenerateObject(bridge)({
            schema: z.object({ when: z.date() }),
            prompt: 'when?',
            maxRetries: 1,
          })
        ).rejects.toThrow();

        expect(requests[0]?.metadata.warnings?.[0]).toMatchObject({
          category: 'content-type-unsupported',
          field: 'when',
          source: 'zod-json-schema',
        });
      });

      it('says so in the validation failure instead of blaming the model', async () => {
        // Before #66 this failed `maxRetries` times with
        // `Validation failed: [...]` and nothing about the schema -- the
        // schema conversion was deterministic, so every retry re-sent the same
        // wrong contract and got the same wrong answer back.
        const { bridge } = stubBridge({ when: '2026-01-01T00:00:00.000Z' });

        await expect(
          createGenerateObject(bridge)({
            schema: z.object({ when: z.date() }),
            prompt: 'when?',
            maxRetries: 1,
          })
        ).rejects.toThrow(/lossy conversion/i);
      });

      it('leaves the request metadata alone for a faithful conversion', async () => {
        const { bridge, requests } = stubBridge({ name: 'Alice' });

        await createGenerateObject(bridge)({
          schema: z.object({ name: z.string() }),
          prompt: 'who?',
          maxRetries: 1,
        });

        expect(requests[0]?.metadata.warnings).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // 2. Runtime Validation
  // ============================================================================

  describe('validateWithSchema', () => {
    it('should validate correct data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validateWithSchema({ name: 'Alice', age: 30 }, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'Alice', age: 30 });
      }
    });

    it('should reject invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validateWithSchema({ name: 'Alice', age: 'thirty' }, schema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle missing required fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validateWithSchema({ name: 'Alice' }, schema);

      expect(result.success).toBe(false);
    });

    it('should allow optional fields to be missing', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().optional(),
      });

      const result = validateWithSchema({ name: 'Alice' }, schema);

      expect(result.success).toBe(true);
    });

    it('should validate nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
      });

      const result = validateWithSchema(
        {
          user: { name: 'Alice', age: 30 },
        },
        schema
      );

      expect(result.success).toBe(true);
    });

    it('should validate arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const result = validateWithSchema({ tags: ['a', 'b', 'c'] }, schema);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // 3. generateObject() - Main API
  // ============================================================================

  describe.skip('generateObject', () => {
    it('should generate object matching schema', async () => {
      const UserSchema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });

      // This would normally call the AI model
      // For testing, we'll mock the implementation
      const result = await generateObject({
        schema: UserSchema,
        prompt: 'Generate a user profile for Alice, age 30',
        model: 'gpt-4',
      });

      expect(result.object).toBeDefined();
      expect(result.object.name).toBe('Alice');
      expect(result.object.age).toBe(30);
      expect(result.usage).toBeDefined();
    });

    it('should validate generated object against schema', async () => {
      const schema = z.object({
        count: z.number().min(1).max(10),
      });

      const result = await generateObject({
        schema,
        prompt: 'Generate a count between 1 and 10',
      });

      expect(result.object.count).toBeGreaterThanOrEqual(1);
      expect(result.object.count).toBeLessThanOrEqual(10);
    });

    it('should retry on validation failure', async () => {
      const schema = z.object({
        value: z.number().positive(),
      });

      const result = await generateObject({
        schema,
        prompt: 'Generate a positive number',
        maxRetries: 3,
      });

      expect(result.object.value).toBeGreaterThan(0);
    });

    it('should work with complex nested schemas', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            bio: z.string(),
          }),
          settings: z.object({
            notifications: z.boolean(),
          }),
        }),
      });

      const result = await generateObject({
        schema,
        prompt: 'Generate a user with profile and settings',
      });

      expect(result.object.user.profile.name).toBeDefined();
      expect(result.object.user.settings.notifications).toBeDefined();
    });

    it('should preserve type safety', async () => {
      const schema = z.object({
        name: z.string(),
        active: z.boolean(),
      });

      const result = await generateObject({ schema, prompt: 'test' });

      // TypeScript should infer the correct type
      const name: string = result.object.name;
      const active: boolean = result.object.active;

      expect(typeof name).toBe('string');
      expect(typeof active).toBe('boolean');
    });
  });

  // ============================================================================
  // 4. Streaming with Partial Objects
  // ============================================================================

  describe.skip('streamObject', () => {
    it('should stream partial objects', async () => {
      const schema = z.object({
        title: z.string(),
        content: z.string(),
        tags: z.array(z.string()),
      });

      const partials: Array<Partial<z.infer<typeof schema>>> = [];

      const stream = streamObject({
        schema,
        prompt: 'Generate a blog post',
        onPartial: (partial) => partials.push(partial),
      });

      let final;
      for await (const partial of stream) {
        final = partial;
      }

      expect(partials.length).toBeGreaterThan(0);
      expect(final).toBeDefined();
      expect(final?.title).toBeDefined();
      expect(final?.content).toBeDefined();
      expect(final?.tags).toBeDefined();
    });

    it('should build up object progressively', async () => {
      const schema = z.object({
        a: z.string(),
        b: z.string(),
        c: z.string(),
      });

      const partials: any[] = [];
      const stream = streamObject({
        schema,
        prompt: 'test',
        onPartial: (p) => partials.push({ ...p }),
      });

      for await (const _ of stream) {
        // Collect all partials
      }

      // Earlier partials should have fewer fields
      expect(Object.keys(partials[0] || {}).length).toBeLessThanOrEqual(
        Object.keys(partials[partials.length - 1] || {}).length
      );
    });
  });

  // ============================================================================
  // 5. Integration with Bridge/Router
  // ============================================================================

  describe.skip('Bridge integration', () => {
    it('should add generateObject method to Bridge', () => {
      // Bridge should be extended with generateObject method
      // This will be implemented in the actual Bridge class
      expect(true).toBe(true); // Placeholder
    });

    it('should work with middleware pipeline', () => {
      // generateObject should go through normal middleware
      expect(true).toBe(true); // Placeholder
    });

    it('should track costs for structured output', () => {
      // Cost tracking middleware should work with generateObject
      expect(true).toBe(true); // Placeholder
    });
  });

  // ============================================================================
  // 6. JSON Schema Fallback
  // ============================================================================

  describe.skip('JSON Schema fallback', () => {
    it('should accept JSON schema directly', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      // Should work with plain JSON schema
      expect(true).toBe(true); // Placeholder
    });
  });
});
