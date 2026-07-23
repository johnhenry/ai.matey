---
'ai.matey': patch
'ai.matey.backend': patch
'ai.matey.backend.browser': patch
'ai.matey.cli': patch
'ai.matey.core': patch
'ai.matey.errors': patch
'ai.matey.frontend': patch
'ai.matey.http': patch
'ai.matey.http.core': patch
'ai.matey.middleware': patch
'ai.matey.native.apple': patch
'ai.matey.native.model-runner': patch
'ai.matey.native.node-llamacpp': patch
'ai.matey.patterns': patch
'ai.matey.react.core': patch
'ai.matey.react.hooks': patch
'ai.matey.react.nextjs': patch
'ai.matey.react.stream': patch
'ai.matey.testing': patch
'ai.matey.types': patch
'ai.matey.utils': patch
'ai.matey.wrapper': patch
---

Fix broken CJS entry points across the whole package family. Every package declares
`"type": "module"` for ESM subpath resolution, but shipped `dist/cjs/` builds with no nested
override - Node walked up to the package root, saw `"type": "module"`, and misinterpreted the
compiled CommonJS as ESM, so `require("ai.matey.x")` failed with `Cannot find module './y.js'`
on every package in the family (ESM `import` was unaffected). Each package's build now emits a
`dist/cjs/package.json` containing `{"type":"commonjs"}` (via a new
`scripts/fix-cjs-package-json.js` post-build step) to correctly scope the CJS build's module
type. No source or `exports` map changes - verified via `npm pack` + fresh install against the
exact repro in #23, both direct `require()` and the `require` export condition on subpaths (e.g.
`ai.matey.backend.browser/chrome-ai`).

(#23)
