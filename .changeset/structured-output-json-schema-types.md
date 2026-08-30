---
'@johnhenry/aimatey-utils': minor
---

Convert Zod unions, records, dates, literals, nullables and a dozen other types to real JSON
Schema instead of silently degrading them to `{ type: 'string' }` (#66), and attach an
`IRWarning` whenever the conversion is still lossy.

`zodToJsonSchema` handled `ZodObject`, `ZodOptional`, `ZodString`, `ZodNumber`, `ZodBoolean`,
`ZodArray` and `ZodEnum`. **Everything else fell through to `return { type: 'string' }`** — and
that JSON Schema *is* the tool contract sent to the provider. The model was told to return a
string for a field that had to be a union, record, date or literal; it obliged;
`validateWithSchema` then rejected the response. Because the conversion is deterministic, every
`generateObject` retry re-sent the same wrong contract and got the same wrong answer, so a
correct user schema burned all `maxRetries` provider calls (and the tokens) and threw
`Validation failed: …` with nothing pointing at the schema. This reaches users through the
documented `Bridge.generateObject`/`Bridge.streamObject` API.

Worst case was `z.string().nullable()`: reported as a *required string*, so a model correctly
returning `null` failed validation with nothing in the schema to explain why.

Now converted: `union` and `discriminatedUnion` (`anyOf`), `intersection` (`allOf`), `record`
(`object` + `additionalProperties`), `date` (`string`/`date-time`), `literal` (single-member
`enum`), `nullable` (`anyOf` with `{ type: 'null' }`), `optional`/`nullish`/`default`/`catch`
(dropped from `required`, `default` carried through), `tuple` (`prefixItems` +
`minItems`/`maxItems`), `set`, `map`, `null`, `any`/`unknown` (`{}`), numeric and native enums,
`readonly`/`branded`/`lazy`/`pipe`/`transform`/`refine` (unwrapped to the type the model must
actually produce), and nested/recursive objects (cycles terminate instead of overflowing the
stack).

`nullable` deliberately stays in `required`: `z.string().nullable()` rejects `undefined`, so the
key must be present and it is the *value* that may be null. Only `optional`-like modifiers leave
`required` — the same split Zod's own `z.toJSONSchema()` makes. Dropping a nullable field from
`required` would reproduce #66 in the other direction.

**Lossy conversions are now loud.** Anything with no JSON Schema representation (`bigint`,
`symbol`, `never`, `z.custom()`, an unrecognized node) converts to `{}` — "any value", which
claims nothing — plus an `IRWarning` (`category: 'content-type-unsupported'`) naming the type
and the field path. `date`, `set` and `map` convert to their closest JSON form *and* warn,
because Zod will reject what comes back over the wire (`z.date()` does not accept the ISO string
it asks for — use `z.coerce.date()`). The warnings surface in three places: on
`ToolDefinition.warnings` (present only when non-empty, so a faithful conversion returns exactly
the shape it always did), on `IRChatRequest.metadata.warnings` for
`generateObject`/`streamObject` (the IR channel for semantic drift, so middleware and logs see
it), and appended to the `Validation failed: …` error, so the failure says the schema is a lossy
conversion instead of looking like a model error.

The type discriminator no longer depends on class names. It read
`_def.typeName || schema.constructor.name`, and **Zod v4 has no `typeName`** — so on the major
most consumers install, every branch rested on a class *identifier*. A name-mangling minifier
would not have broken one branch, it would have broken all of them at once and converted every
field of every schema to `{ type: 'string' }`, silently, in production only. The tag now comes
from string *data* Zod stores in `_def` (`typeName` on v3, `type` on v4), with `constructor.name`
kept only as a last resort. Verified against real zod@3.25.76 and zod@4.4.3, including through an
esbuild bundle built with `minify` and `keepNames: false`.

`minor` rather than `patch`: the emitted JSON Schema changes for a dozen type families, and the
exported types widen with it — `JSONSchema.type` becomes optional (an empty schema is how "any
value" is spelled), `JSONSchema.enum` widens to `unknown[]`, `anyOf`/`allOf`/`prefixItems`/
`additionalProperties`/`format`/`default` are added, and `ToolDefinition` gains optional
`warnings`. Nothing is removed and no signature changes, but that is more than a defect repair.

Zod v4's native `z.toJSONSchema()` was evaluated and deliberately not used: the declared peer
range is `zod@^3.0.0 || ^4.0.0` and v3 has no equivalent, the namespace form is unreachable from
a package that (since #59) holds no reference to `zod` at all, and the v4 instance method emits a
different contract (`$schema`, `additionalProperties: false`, `$ref`/`$defs`, `oneOf`, and a
throw on `z.date()`/`z.bigint()`) that would change what every existing caller sends to their
provider.
