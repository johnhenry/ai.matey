/**
 * Structured Output with Zod
 *
 * This module provides utilities for working with Zod schemas for structured LLM outputs.
 * It includes:
 * - Schema to tool definition conversion
 * - Runtime validation
 * - Type-safe object generation
 * - Streaming with partial objects
 *
 * **IMPORTANT**: These utilities operate on Zod schemas supplied by the caller.
 * `zod` is an optional peer dependency -- install it with `npm install zod` and
 * pass the schemas you build with it. This module does not import `zod` at all,
 * not even for types (#59 removed the last runtime reference; #66 removed the
 * last type reference), so it stays browser-safe and adds nothing to a bundle
 * for consumers who never touch structured output.
 */

import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRTool,
  IRWarning,
} from '@johnhenry/aimatey-types';
import { extractToolCalls } from './tools.js';

// ============================================================================
// Zod Schema Detection
// ============================================================================

/**
 * Structural test for "this value is a usable Zod schema".
 *
 * This module never needs the `z` namespace itself -- every entry point is
 * handed a schema the caller already built, so the schema *is* the injected
 * Zod instance (the same injectable pattern `@johnhenry/aimatey-mcp` uses for
 * MCP clients). Checking the value we were given, rather than loading the
 * `zod` module to prove it exists, keeps this file free of any runtime
 * reference to `zod`: no `require`, no dynamic `import()`, nothing for a
 * browser bundler to externalize, and the public API stays synchronous.
 *
 * Issue #59: the previous implementation probed availability with a bare
 * `require('zod')`. `require` is not defined in an ES module, so in the ESM
 * build every structured-output function threw -- and, because the failure
 * was swallowed by a `catch`, it threw the *misleading* "Zod is not
 * installed" error even when Zod was installed and working.
 *
 * Recognizes Zod v3 (`ZodType` instances expose `_def`/`parse`/`safeParse`)
 * and Zod v4 (`_def` is a getter over the internal `_zod.def`; `parse` and
 * `safeParse` are unchanged), matching the `^3 || ^4` peer range.
 */
function isZodSchema(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { _def?: unknown; parse?: unknown; safeParse?: unknown };

  return (
    typeof candidate.parse === 'function' &&
    typeof candidate.safeParse === 'function' &&
    typeof candidate._def === 'object' &&
    candidate._def !== null
  );
}

/**
 * Describe a rejected value for the error message, without stringifying
 * something potentially huge.
 */
function describeValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'an array';
  }
  if (typeof value === 'string') {
    const shown = value.length > 40 ? `${value.slice(0, 40)}...` : value;
    return `the string ${JSON.stringify(shown)}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `a ${typeof value} (${value.toString()})`;
  }
  if (typeof value === 'object') {
    // `Object.create(null)` has no `constructor`, hence the optional call.
    const name: string | undefined = value.constructor?.name;
    return name !== undefined && name !== 'Object' ? `a ${name} instance` : 'a plain object';
  }
  return `a ${typeof value}`;
}

/**
 * Assert that `schema` is a Zod schema before it is used.
 *
 * Both failure modes -- Zod not installed at all, and Zod installed but
 * something else passed -- land here, so the message covers both.
 *
 * @throws Error if the value is not a Zod schema
 */
function assertZodSchema(schema: unknown, parameterName: string = 'schema'): void {
  if (isZodSchema(schema)) {
    return;
  }

  throw new Error(
    `Structured output requires a Zod schema, but \`${parameterName}\` was ` +
      `${describeValue(schema)}. Zod is an optional peer dependency: install it with ` +
      '`npm install zod` and pass a schema built with it, e.g. z.object({ ... }).\n' +
      'See: https://github.com/johnhenry/ai.matey#structured-output'
  );
}

// ============================================================================
// Types
// ============================================================================

/**
 * OpenAI-compatible tool definition format
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
  /**
   * Semantic drift recorded while converting the Zod schema (issue #66).
   *
   * Present only when the conversion actually lost something -- a type with
   * no JSON Schema representation, a recursive node, a `z.date()` that will
   * arrive as a string. Absent otherwise, so a clean conversion returns
   * exactly the shape it always has.
   */
  warnings?: IRWarning[];
}

/**
 * JSON Schema representation (the subset used for tool/function parameter
 * schemas -- i.e. the contract actually sent to the provider).
 *
 * `type` is optional: `{}` is the JSON Schema spelling of "any value", which
 * is what an unconstrained (`z.any()`) or unrepresentable field converts to,
 * and a node described with `anyOf`/`allOf` has no single `type` either.
 * Claiming `{ type: 'string' }` for those cases is exactly the bug in #66.
 */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  prefixItems?: JSONSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JSONSchema;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  format?: string;
  required?: string[];
  description?: string;
}

/**
 * PII match information
 */
export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
}

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  detected: boolean;
  matches: PIIMatch[];
}

/**
 * PII pattern configuration
 */
export interface PIIPattern {
  type: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Validation result
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; errors: any[] }; // Using any[] to avoid importing z.ZodIssue

// ============================================================================
// Schema to Tool Definition Converter
// ============================================================================

/**
 * Convert a Zod schema to an OpenAI tool definition
 *
 * @param schema - Zod schema to convert
 * @param name - Function name for the tool
 * @param description - Description of what the tool does
 * @returns OpenAI-compatible tool definition
 */
export function schemaToToolDefinition(
  schema: any, // Using any to avoid importing z.ZodType
  name: string = 'extract_data',
  description: string = 'Extract structured data from the input'
): ToolDefinition {
  // Ensure the caller handed us a real Zod schema
  assertZodSchema(schema);

  const { schema: jsonSchema, warnings } = zodToJsonSchema(schema);

  const definition: ToolDefinition = {
    type: 'function',
    function: {
      name,
      description,
      parameters: jsonSchema,
    },
  };

  // Attached only when non-empty: a faithful conversion returns the same
  // shape it always did, so this is additive for every existing caller.
  if (warnings.length > 0) {
    definition.warnings = warnings;
  }

  return definition;
}

// ============================================================================
// Zod -> JSON Schema Conversion
// ============================================================================

/**
 * Canonical, lowercase tag for one Zod schema node: `'string'`, `'union'`,
 * `'record'`, ...
 *
 * Issue #66: every conversion branch keys off this one function, so it has to
 * work on both majors of the peer range (`zod@^3 || ^4`) *and* survive a
 * minifier. The three sources are tried in order of reliability:
 *
 * 1. **Zod v3** stores a string constant in `_def.typeName` (`'ZodString'`).
 * 2. **Zod v4** dropped `typeName`, but stores its own string constant in
 *    `_def.type` (`'string'`). Both are *data*, not identifiers, so no
 *    minifier can rewrite them. (The `typeof` guard and the v3-first ordering
 *    matter: in v3 `_def.type` is the *element schema* of a `ZodArray`, an
 *    object, not a tag.)
 * 3. `constructor.name` last. It is what the previous implementation relied
 *    on for all of v4 -- and it is the one source a name-mangling bundler can
 *    destroy, which would previously have collapsed *every* branch at once and
 *    silently converted every schema to `{ type: 'string' }`.
 *
 * Anything unrecognized returns `''`, which the converter reports as a
 * warning rather than guessing.
 */
function zodTypeTag(schema: unknown): string {
  const node = schema as { _def?: Record<string, unknown>; constructor?: { name?: string } } | null;
  const def: Record<string, unknown> = (node?._def as Record<string, unknown>) ?? {};

  if (typeof def.typeName === 'string' && def.typeName.length > 0) {
    return canonicalTag(def.typeName);
  }

  if (typeof def.type === 'string' && def.type.length > 0) {
    return canonicalTag(def.type);
  }

  const constructorName = node?.constructor?.name;
  if (typeof constructorName === 'string' && constructorName.length > 0) {
    return canonicalTag(constructorName);
  }

  return '';
}

/**
 * Fold the v3 spelling, the v4 spelling and the class-name spelling of the
 * same concept onto one tag, so each conversion branch is written once.
 */
const TAG_ALIASES: Readonly<Record<string, string>> = {
  // v3 `ZodDiscriminatedUnion` vs v4 `_def.type === 'union'`
  discriminatedunion: 'union',
  // v3 `ZodNativeEnum` vs v4 `_def.type === 'enum'`
  nativeenum: 'enum',
  // v3 `ZodPipeline` vs v4 `_def.type === 'pipe'`
  pipeline: 'pipe',
  // v3 `ZodBranded` vs v4 (`.brand()` returns the schema unchanged)
  brand: 'branded',
  // v4 class names, for the constructor-name fallback only
  numberformat: 'number',
  stringformat: 'string',
  templateliteral: 'template_literal',
};

function canonicalTag(raw: string): string {
  const bare = (raw.startsWith('Zod') ? raw.slice(3) : raw).toLowerCase();
  return TAG_ALIASES[bare] ?? bare;
}

/**
 * Wrappers whose only job is to hold an inner schema. The wire format cares
 * about the inner type, so the converter unwraps them.
 */
function innerSchemaOf(def: Record<string, any>): unknown {
  // optional / nullable / default / catch / readonly / nonoptional
  if (def.innerType !== undefined) {
    return def.innerType;
  }
  // v3 ZodEffects (.transform / .refine / .preprocess)
  if (def.schema !== undefined) {
    return def.schema;
  }
  // v3 ZodPipeline / v4 ZodPipe -- the *input* side is what the model produces
  if (def.in !== undefined) {
    return def.in;
  }
  // ZodLazy
  if (typeof def.getter === 'function') {
    return def.getter();
  }
  // v3 ZodBranded / ZodPromise (`_def.type` holds a schema, not a tag)
  if (def.type !== undefined && typeof def.type !== 'string') {
    return def.type;
  }
  return undefined;
}

/**
 * Would Zod accept this field being absent? Governs `required`.
 *
 * Structural rather than behavioural (a `safeParse(undefined)` probe would be
 * shorter but would also call user refinements, and would misread the
 * duck-typed schemas this module deliberately supports). `nullable` is *not*
 * in the optional set: `z.string().nullable()` rejects `undefined`, so the
 * field stays required and gains `null` as an allowed *value* -- the same
 * split Zod's own `z.toJSONSchema()` makes.
 */
function isOptionalField(schema: unknown, depth: number = 0): boolean {
  if (depth > MAX_CONVERSION_DEPTH) {
    return false;
  }

  const def = (schema as { _def?: Record<string, any> } | null)?._def ?? {};

  switch (zodTypeTag(schema)) {
    // Absent input is accepted (`.default()`/`.catch()` even supply a value).
    case 'optional':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'undefined':
    case 'void':
      return true;

    // Explicitly re-required.
    case 'nonoptional':
      return false;

    // Transparent wrappers: ask the schema underneath.
    case 'nullable':
    case 'readonly':
    case 'branded':
    case 'lazy':
    case 'pipe':
    case 'effects':
      return isOptionalField(innerSchemaOf(def), depth + 1);

    // `z.union([z.string(), z.undefined()])` accepts an absent field.
    case 'union':
      return (
        Array.isArray(def.options) &&
        def.options.some((option: unknown) => isOptionalField(option, depth + 1))
      );

    default:
      return false;
  }
}

/** Guard against pathological (or hostile) `z.lazy()` getters. */
const MAX_CONVERSION_DEPTH = 32;

/**
 * Mutable conversion state threaded through the recursion.
 *
 * `warnings` is the answer to "where does a lossy conversion go?": the
 * converter never returns a schema that quietly lies about a type, it records
 * an `IRWarning` and returns a schema that claims nothing.
 */
interface ConversionContext {
  readonly warnings: IRWarning[];
  readonly path: string[];
  /** Schema nodes on the current path, for cycle detection. */
  readonly active: Set<unknown>;
}

function currentField(ctx: ConversionContext): string | undefined {
  return ctx.path.length > 0 ? ctx.path.join('.') : undefined;
}

function addWarning(
  ctx: ConversionContext,
  warning: {
    message: string;
    severity?: IRWarning['severity'];
    originalValue?: unknown;
    transformedValue?: unknown;
  }
): void {
  ctx.warnings.push({
    category: 'content-type-unsupported',
    severity: warning.severity ?? 'warning',
    message: warning.message,
    ...(currentField(ctx) !== undefined ? { field: currentField(ctx) } : {}),
    ...(warning.originalValue !== undefined ? { originalValue: warning.originalValue } : {}),
    ...(warning.transformedValue !== undefined
      ? { transformedValue: warning.transformedValue }
      : {}),
    source: 'zod-json-schema',
  });
}

/** Describe a node for a warning message, without leaking the whole schema. */
function describeTag(schema: unknown, tag: string): string {
  if (tag.length > 0) {
    return tag;
  }
  const constructorName = (schema as { constructor?: { name?: string } } | null)?.constructor?.name;
  return typeof constructorName === 'string' && constructorName.length > 0
    ? constructorName
    : 'an unrecognized schema';
}

/**
 * Convert a Zod schema to JSON Schema, collecting a warning for every
 * conversion that loses meaning.
 *
 * Kept internal: the warnings reach callers on `ToolDefinition.warnings` and,
 * for `generateObject`/`streamObject`, on `IRChatRequest.metadata.warnings`.
 */
function zodToJsonSchema(schema: unknown): { schema: JSONSchema; warnings: IRWarning[] } {
  const ctx: ConversionContext = { warnings: [], path: [], active: new Set() };
  return { schema: convertNode(schema, ctx, 0), warnings: ctx.warnings };
}

function convertNode(schema: unknown, ctx: ConversionContext, depth: number): JSONSchema {
  if (depth > MAX_CONVERSION_DEPTH) {
    addWarning(ctx, {
      message: `Schema nesting exceeded ${MAX_CONVERSION_DEPTH} levels; the remainder is described as an unconstrained value.`,
    });
    return {};
  }

  if (typeof schema !== 'object' || schema === null) {
    addWarning(ctx, {
      message: `Expected a Zod schema but found ${describeValue(schema)}; described as an unconstrained value.`,
    });
    return {};
  }

  // Recursive schema (`z.lazy()`, or an object referencing itself through a
  // getter). Emitting `{}` keeps the cycle finite without claiming a type.
  if (ctx.active.has(schema)) {
    addWarning(ctx, {
      message:
        'Recursive schema: the repeated node is described as an unconstrained value, so nested occurrences are not constrained by the tool schema.',
      severity: 'info',
    });
    return {};
  }

  ctx.active.add(schema);
  try {
    return withDescription(schema, convertByTag(schema, ctx, depth));
  } finally {
    ctx.active.delete(schema);
  }
}

/** Zod stores `.describe()` text on the schema object in both majors. */
function withDescription(schema: unknown, result: JSONSchema): JSONSchema {
  const description = (schema as { description?: unknown }).description;
  if (
    typeof description === 'string' &&
    description.length > 0 &&
    result.description === undefined
  ) {
    return { ...result, description };
  }
  return result;
}

function convertByTag(schema: unknown, ctx: ConversionContext, depth: number): JSONSchema {
  const def = (schema as { _def?: Record<string, any> })._def ?? {};
  const tag = zodTypeTag(schema);
  const next = (child: unknown, segment?: string): JSONSchema => {
    if (segment !== undefined) {
      ctx.path.push(segment);
    }
    try {
      return convertNode(child, ctx, depth + 1);
    } finally {
      if (segment !== undefined) {
        ctx.path.pop();
      }
    }
  };

  switch (tag) {
    // ---- Primitives -------------------------------------------------------
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'null':
      return { type: 'null' };

    // `{}` is the JSON Schema spelling of "any value" -- an exact, lossless
    // rendering of `z.any()`/`z.unknown()`, so no warning.
    case 'any':
    case 'unknown':
      return {};

    // ---- Objects ----------------------------------------------------------
    case 'object': {
      const shape = resolveShape(schema, def);
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];

      for (const [key, field] of Object.entries(shape)) {
        properties[key] = next(field, key);
        if (!isOptionalField(field)) {
          required.push(key);
        }
      }

      const result: JSONSchema = { type: 'object', properties };
      if (required.length > 0) {
        result.required = required;
      }
      return result;
    }

    // A record is an object with unconstrained keys.
    case 'record': {
      const result: JSONSchema = { type: 'object' };
      if (def.valueType !== undefined) {
        result.additionalProperties = next(def.valueType, '(value)');
      }
      return result;
    }

    // ---- Collections ------------------------------------------------------
    case 'array':
      // v4 keeps the element in `_def.element`, v3 in `_def.type`.
      return { type: 'array', items: next(def.element ?? def.type, '[]') };

    case 'tuple': {
      const items: unknown[] = Array.isArray(def.items) ? def.items : [];
      const result: JSONSchema = {
        type: 'array',
        prefixItems: items.map((item, index) => next(item, `[${index}]`)),
        minItems: items.length,
      };
      if (def.rest !== undefined && def.rest !== null) {
        result.items = next(def.rest, '[]');
      } else {
        result.maxItems = items.length;
      }
      return result;
    }

    case 'set': {
      addWarning(ctx, {
        message:
          'z.set() is sent as a JSON array (JSON has no Set). The model returns an array, which z.set() rejects -- wrap it in a preprocess/transform, or use z.array() with a uniqueness refinement.',
      });
      return { type: 'array', items: next(def.valueType, '[]'), uniqueItems: true };
    }

    case 'map': {
      addWarning(ctx, {
        message:
          'z.map() is sent as a JSON array of [key, value] pairs (JSON has no Map). The model returns an array, which z.map() rejects -- wrap it in a preprocess/transform, or use z.record().',
      });
      return {
        type: 'array',
        items: {
          type: 'array',
          prefixItems: [next(def.keyType, '(key)'), next(def.valueType, '(value)')],
          minItems: 2,
          maxItems: 2,
        },
      };
    }

    // ---- Enumerations and constants ---------------------------------------
    case 'enum': {
      const values = enumValues(def);
      const result: JSONSchema = { enum: values };
      const type = commonJsonType(values);
      if (type !== undefined) {
        result.type = type;
      }
      return result;
    }

    case 'literal': {
      // v4 stores an array in `_def.values` (`z.literal(['a', 'b'])`),
      // v3 a single `_def.value`.
      const values: unknown[] = Array.isArray(def.values) ? [...def.values] : [def.value];
      const representable = values.filter(isJsonPrimitive);

      if (representable.length !== values.length) {
        addWarning(ctx, {
          message: `Literal value of type ${values
            .filter((value) => !isJsonPrimitive(value))
            .map((value) => typeof value)
            .join(', ')} has no JSON Schema representation; described as an unconstrained value.`,
          originalValue: values.map((value) => String(value)),
        });
        if (representable.length === 0) {
          return {};
        }
      }

      // `enum` with a single member rather than `const`: this schema is a
      // provider wire format, and `enum` is universally understood by tool
      // schema validators while `const` support is uneven.
      const result: JSONSchema = { enum: representable };
      const type = commonJsonType(representable);
      if (type !== undefined) {
        result.type = type;
      }
      return result;
    }

    // ---- Composition ------------------------------------------------------
    case 'union': {
      const options: unknown[] = Array.isArray(def.options) ? def.options : [];
      if (options.length === 0) {
        addWarning(ctx, { message: 'Union with no options; described as an unconstrained value.' });
        return {};
      }
      // `anyOf` for both plain and discriminated unions: `oneOf` (what Zod
      // itself emits for discriminated unions) is rejected or ignored by
      // several providers' tool-schema validators, and `anyOf` is a correct,
      // weaker statement of the same thing.
      return {
        anyOf: options.map((option, index) => next(option, `|${index}`)),
      };
    }

    case 'intersection':
      return { allOf: [next(def.left, '&0'), next(def.right, '&1')] };

    // ---- Modifiers --------------------------------------------------------
    case 'nullable': {
      const inner = next(innerSchemaOf(def));
      // Flatten rather than nesting anyOf inside anyOf.
      const branches = Array.isArray(inner.anyOf) ? inner.anyOf : [inner];
      return { anyOf: [...branches, { type: 'null' }] };
    }

    case 'optional':
    case 'nonoptional':
    case 'readonly':
    case 'branded':
    case 'lazy':
    case 'pipe':
    case 'effects':
    case 'catch':
      return next(innerSchemaOf(def));

    case 'default':
    case 'prefault': {
      const result = next(innerSchemaOf(def));
      const defaultValue = resolveDefaultValue(def);
      return defaultValue === undefined ? result : { ...result, default: defaultValue };
    }

    // ---- Representable on the wire, but Zod will reject what comes back ----
    case 'date':
      addWarning(ctx, {
        message:
          'z.date() is sent as an ISO 8601 date-time string (JSON has no date type). The model returns a string, which z.date() rejects -- use z.coerce.date() (or z.iso.datetime()) so the response validates.',
        transformedValue: { type: 'string', format: 'date-time' },
      });
      return { type: 'string', format: 'date-time' };

    // ---- No JSON representation -------------------------------------------
    default: {
      addWarning(ctx, {
        message: `${describeTag(
          schema,
          tag
        )} has no JSON Schema representation; described as an unconstrained value, so the model receives no guidance for this field.`,
        originalValue: tag.length > 0 ? tag : undefined,
      });
      return {};
    }
  }
}

/**
 * v3 keeps the object shape behind a thunk (`_def.shape()`) exposed as the
 * `shape` getter; v4 stores it directly on `_def.shape`.
 */
function resolveShape(schema: unknown, def: Record<string, any>): Record<string, unknown> {
  const fromSchema = (schema as { shape?: unknown }).shape;
  if (typeof fromSchema === 'object' && fromSchema !== null) {
    return fromSchema as Record<string, unknown>;
  }
  if (typeof def.shape === 'function') {
    try {
      return (def.shape() ?? {}) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof def.shape === 'object' && def.shape !== null) {
    return def.shape as Record<string, unknown>;
  }
  return {};
}

/**
 * v4 exposes enum members as `_def.entries` (`{ a: 'a' }`), v3 as
 * `_def.values`. Numeric TS enums additionally carry a reverse mapping
 * (`{ A: 1, 1: 'A' }`), which is dropped.
 */
function enumValues(def: Record<string, any>): unknown[] {
  const source = def.entries ?? def.values ?? def.options;
  if (source === undefined || source === null) {
    return [];
  }

  if (Array.isArray(source)) {
    return [...source];
  }

  const entries = Object.entries(source as Record<string, unknown>);
  const hasNumericMember = entries.some(([, value]) => typeof value === 'number');
  const values = hasNumericMember
    ? entries.filter(([, value]) => typeof value === 'number').map(([, value]) => value)
    : entries.map(([, value]) => value);

  return [...new Set(values)];
}

function isJsonPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/** The JSON Schema `type` shared by every value, or `undefined` if mixed. */
function commonJsonType(values: readonly unknown[]): string | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const types = new Set(
    values.map((value) => {
      if (value === null) {
        return 'null';
      }
      if (typeof value === 'number') {
        return 'number';
      }
      if (typeof value === 'boolean') {
        return 'boolean';
      }
      if (typeof value === 'string') {
        return 'string';
      }
      return 'unknown';
    })
  );

  if (types.size !== 1 || types.has('unknown')) {
    return undefined;
  }
  return [...types][0];
}

/**
 * v3 stores the default behind a thunk, v4 stores the value. Only
 * JSON-serializable defaults are emitted -- the field is an annotation, so a
 * value that cannot cross the wire is simply omitted.
 */
function resolveDefaultValue(def: Record<string, any>): unknown {
  try {
    const raw = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
    if (raw === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(raw)) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Render conversion warnings for an error message, so a validation failure
 * caused by a lossy schema says so instead of looking like a model error.
 */
function describeConversionWarnings(warnings: readonly IRWarning[]): string {
  if (warnings.length === 0) {
    return '';
  }

  const lines = warnings.map((warning) =>
    warning.field !== undefined
      ? `  - ${warning.field}: ${warning.message}`
      : `  - ${warning.message}`
  );

  return (
    '\n\nThe JSON Schema sent to the provider is a lossy conversion of the supplied Zod ' +
    'schema, which may be the reason the response does not validate:\n' +
    lines.join('\n')
  );
}

// ============================================================================
// Runtime Validation
// ============================================================================

/**
 * Validate data against a Zod schema
 *
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @returns Validation result with typed data or errors
 */
export function validateWithSchema<T = any>(data: unknown, schema: any): ValidationResult<T> {
  // Ensure the caller handed us a real Zod schema
  assertZodSchema(schema);

  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.issues,
  };
}

// ============================================================================
// PII Detection and Redaction (from validation-middleware)
// ============================================================================

/**
 * Default PII patterns for detection
 */
export const DEFAULT_PII_PATTERNS: PIIPattern[] = [
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    type: 'phone',
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED_SSN]',
  },
  {
    type: 'creditCard',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: '[REDACTED_CREDIT_CARD]',
  },
];

/**
 * Default prompt injection patterns
 */
export const DEFAULT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+previous/i,
  /system:\s*new\s+instruction/i,
  /forget\s+everything/i,
  /disregard\s+all/i,
];

/**
 * Detect PII in text
 */
export function detectPII(
  text: string,
  patterns: PIIPattern[] = DEFAULT_PII_PATTERNS
): PIIDetectionResult {
  const matches: PIIMatch[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.pattern);
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: pattern.type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return {
    detected: matches.length > 0,
    matches,
  };
}

/**
 * Redact PII from text
 */
export function redactPII(text: string, patterns: PIIPattern[] = DEFAULT_PII_PATTERNS): string {
  let result = text;

  for (const pattern of patterns) {
    result = result.replace(pattern.pattern, pattern.replacement);
  }

  return result;
}

/**
 * Detect prompt injection attempts
 */
export function detectPromptInjection(
  text: string,
  patterns: RegExp[] = DEFAULT_INJECTION_PATTERNS
): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitize text by removing control characters
 */
export function sanitizeText(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
  );
}

// ============================================================================
// Object Generation (generateObject and streamObject)
// ============================================================================

/**
 * Minimal Bridge surface needed by generateObject/streamObject.
 *
 * Uses `executeIR`/`executeIRStream` (IR in, IR out) rather than the
 * frontend-native `chat()`/`chatStream()` methods, so the forced tool call
 * this module builds is expressed once in the universal IR shape
 * (`tools`/`toolChoice`/`ToolUseContent`) and each backend adapter's own
 * `fromIR`/`toIR` handles translating it to and from that provider's actual
 * wire format (OpenAI's `tool_choice: { type: 'function', ... }`,
 * Anthropic's `tool_choice: { type: 'tool', ... }`, etc). This keeps
 * generateObject/streamObject correct for any backend, not just Anthropic.
 */
export interface StructuredOutputBridge {
  executeIR(request: IRChatRequest, options?: { signal?: AbortSignal }): Promise<IRChatResponse>;
  executeIRStream?(request: IRChatRequest, options?: { signal?: AbortSignal }): IRChatStream;
  readonly frontend: { readonly metadata: { readonly name: string } };
  readonly config?: { readonly defaultModel?: string };
}

const EXTRACT_TOOL_NAME = 'extract_data';

/**
 * Options for generateObject
 */
export interface GenerateObjectOptions<T = any> {
  schema: T;
  prompt: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

/**
 * Result from generateObject
 */
export interface GenerateObjectResult<T> {
  object: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

/**
 * Options for streamObject
 */
export interface StreamObjectOptions<T = any> {
  schema: T;
  prompt: string;
  model?: string;
  onPartial?: (partial: Partial<T>) => void;
  signal?: AbortSignal;
}

/**
 * Build the IR tool definition + forced toolChoice shared by
 * generateObject/streamObject.
 *
 * Returns the conversion warnings alongside the tool: they travel on the
 * request's `metadata.warnings` (the IR channel for semantic drift) and are
 * appended to a validation failure, so a lossy schema conversion is never
 * silent (#66).
 */
function buildExtractDataTool(schema: any): { tool: IRTool; warnings: IRWarning[] } {
  const toolDef = schemaToToolDefinition(schema, EXTRACT_TOOL_NAME, 'Extract structured data');
  return {
    tool: {
      name: toolDef.function.name,
      description: toolDef.function.description,
      // This module's local JSONSchema type (a hand-rolled subset used for
      // Zod conversion) is structurally compatible with the IR JSONSchema
      // type at runtime, but its `type` field is a plain `string` rather
      // than IR's narrower JSONSchemaType union -- cast through `unknown`.
      parameters: toolDef.function.parameters as unknown as IRTool['parameters'],
    },
    warnings: toolDef.warnings ?? [],
  };
}

/**
 * Create a generateObject function bound to a Bridge instance
 *
 * This is a factory function that creates a generateObject implementation
 * that uses the provided Bridge's `executeIR()` for making LLM calls -- so
 * it works with any backend/frontend combination, not just Anthropic.
 */
export function createGenerateObject(bridge: StructuredOutputBridge) {
  return async function generateObject<T = any>(
    options: GenerateObjectOptions
  ): Promise<GenerateObjectResult<T>> {
    const { schema, prompt, model, temperature = 0.7, maxRetries = 3, signal } = options;

    // Fail fast, outside the retry loop: a bad schema will never succeed
    assertZodSchema(schema, 'options.schema');

    // Convert schema to an IR tool definition (provider-agnostic)
    const { tool: irTool, warnings: conversionWarnings } = buildExtractDataTool(schema);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const request: IRChatRequest = {
          messages: [{ role: 'user', content: prompt }],
          parameters: {
            model: model ?? bridge.config?.defaultModel,
            temperature,
          },
          tools: [irTool],
          toolChoice: { name: EXTRACT_TOOL_NAME },
          metadata: {
            requestId:
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `generate-object-${Date.now()}-${attempt}`,
            timestamp: Date.now(),
            provenance: { frontend: bridge.frontend.metadata.name },
            // Semantic drift from the Zod -> JSON Schema conversion, on the
            // documented IR channel, so middleware and logs can see that the
            // tool contract does not fully describe the caller's schema.
            ...(conversionWarnings.length > 0 ? { warnings: conversionWarnings } : {}),
          },
        };

        // Make the LLM call via IR -- correct for any backend's own
        // forced-tool-call wire format, since executeIR skips frontend
        // conversion and each backend's fromIR/toIR already normalizes
        // toolChoice/ToolUseContent to and from its native shape.
        const response = await bridge.executeIR(request, { signal });

        const toolCalls = extractToolCalls(response);
        const firstToolCall = toolCalls[0];

        if (!firstToolCall) {
          throw new Error('No tool call in response');
        }

        const data = firstToolCall.input;

        // Validate against schema
        const validation = validateWithSchema(data, schema);

        if (!validation.success) {
          const errors = 'errors' in validation ? validation.errors : 'unknown error';
          lastError = new Error(
            `Validation failed: ${JSON.stringify(errors)}` +
              describeConversionWarnings(conversionWarnings)
          );
          continue; // Retry
        }

        // Return validated object
        return {
          object: validation.data,
          usage: response.usage,
          finishReason: response.finishReason || 'stop',
        };
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Failed to generate object');
  };
}

/**
 * Create a streamObject function bound to a Bridge instance
 *
 * This is a factory function that creates a streamObject implementation
 * that uses the provided Bridge's `executeIRStream()` for making streaming
 * LLM calls -- so it works with any backend/frontend combination, not just
 * Anthropic. Partial JSON is accumulated from IR `tool_use` chunks'
 * `inputDelta`, which every backend adapter already normalizes to the same
 * shape regardless of that provider's native streaming event format.
 */
export function createStreamObject(bridge: StructuredOutputBridge) {
  return async function* streamObject<T = any>(
    options: StreamObjectOptions
  ): AsyncGenerator<Partial<T>, T> {
    const { schema, prompt, model, onPartial, signal } = options;

    // Fail fast, before any network call
    assertZodSchema(schema, 'options.schema');

    if (!bridge.executeIRStream) {
      throw new Error('streamObject requires a Bridge with executeIRStream() support');
    }

    // Convert schema to an IR tool definition (provider-agnostic)
    const { tool: irTool, warnings: conversionWarnings } = buildExtractDataTool(schema);

    const request: IRChatRequest = {
      messages: [{ role: 'user', content: prompt }],
      parameters: { model: model ?? bridge.config?.defaultModel },
      tools: [irTool],
      toolChoice: { name: EXTRACT_TOOL_NAME },
      metadata: {
        requestId:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `stream-object-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: bridge.frontend.metadata.name },
        // See generateObject: lossy schema conversion travels with the request.
        ...(conversionWarnings.length > 0 ? { warnings: conversionWarnings } : {}),
      },
    };

    const stream = bridge.executeIRStream(request, { signal });

    let accumulatedRaw = '';
    let accumulatedData: Partial<T> = {};
    let finalData: Partial<T> | undefined;

    for await (const chunk of stream) {
      if (chunk.type === 'tool_use' && chunk.name === EXTRACT_TOOL_NAME) {
        accumulatedRaw += chunk.inputDelta ?? '';

        try {
          accumulatedData = JSON.parse(accumulatedRaw || '{}') as Partial<T>;

          if (onPartial) {
            onPartial(accumulatedData);
          }

          yield accumulatedData;
        } catch {
          // JSON not yet complete, continue
        }
      } else if (chunk.type === 'done' && chunk.message) {
        const toolCalls = extractToolCalls(chunk.message);
        const firstToolCall = toolCalls[0];
        if (firstToolCall) {
          finalData = firstToolCall.input as Partial<T>;
        }
      }
    }

    // Prefer the fully-assembled object from the `done` chunk (already
    // parsed by the backend adapter); fall back to whatever was
    // successfully parsed from accumulated deltas.
    const resolvedData = finalData ?? accumulatedData;

    // Validate final object
    const validation = validateWithSchema(resolvedData, schema);

    if (!validation.success) {
      const errors = 'errors' in validation ? validation.errors : 'unknown error';
      throw new Error(
        `Validation failed: ${JSON.stringify(errors)}` +
          describeConversionWarnings(conversionWarnings)
      );
    }

    return validation.data;
  };
}
