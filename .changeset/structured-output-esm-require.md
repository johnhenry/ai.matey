---
'@johnhenry/aimatey-utils': patch
---

Fix `ReferenceError: require is not defined` in the ESM build of the structured-output
utilities, and the misleading "Zod is not installed" error it produced (#59).

`structured-output.ts` checked whether the optional peer dependency `zod` was available
by calling `require('zod')`. `require` is not defined in an ES module, and this package
declares `"type": "module"` — so in the ESM build (what Node picks for `import`, and what
every bundler resolves) that call threw, the surrounding `catch` swallowed the
`ReferenceError`, and the fallback error fired instead. The result: `schemaToToolDefinition`,
`validateWithSchema`, `Bridge#generateObject` and `Bridge#streamObject` all failed with
"Zod is required for structured output features but is not installed" — **including for
consumers who had Zod installed and working**. Only the CJS build ever worked. A Vite
build reproduced it with no warning at all: Rollup passed `require("zod")` straight through
into the browser bundle, so the first structured-output call threw at runtime in the page.

The probe is gone rather than rewritten. This module never used the `z` namespace it was
loading: every entry point is handed a schema the caller built, so the schema *is* the
injected Zod instance — the same injectable pattern `@johnhenry/aimatey-mcp` uses for MCP
clients. What replaces it is a structural check on that argument (Zod v3 and v4 both expose
`_def`/`parse`/`safeParse`), which behaves identically in ESM, CJS, Node, Deno, Bun and
every browser.

Consequences:

- **No public signature changes and nothing becomes async.** A dynamic `await import('zod')`
  would have worked too, but `schemaToToolDefinition` and `validateWithSchema` are
  synchronous exports, so it would have forced a breaking change on the whole structured-output
  surface for a value that was never used. Hence `patch`, not `minor`/`major`.
- `@johnhenry/aimatey-utils` now holds **no runtime reference to `zod` at all** (the remaining
  `import` is type-only). Nothing for a bundler to externalize, and no `zod` code in a bundle
  for consumers who never touch structured output. `zod` stays an optional peer dependency.
- The error message changed. Passing something that is not a Zod schema now says so
  precisely — naming the parameter and what arrived — and still points at `npm install zod`.
  It covers both causes: Zod absent, and Zod present but a plain object/JSON Schema passed by
  mistake. Previously the second case died with `TypeError: Cannot read properties of
  undefined (reading 'typeName')`.
- `generateObject` and `streamObject` now validate the schema **before** the retry loop and
  before any provider call, so a bad schema costs zero requests instead of `maxRetries` of them.
