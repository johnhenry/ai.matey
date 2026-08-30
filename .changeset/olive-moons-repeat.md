---
'@johnhenry/aimatey-http-core': patch
'@johnhenry/aimatey-http': patch
'@johnhenry/aimatey-testing': patch
---

Import Node builtins with the `node:` prefix.

Follow-up to #48, where a bare `'crypto'` specifier in the middleware package
was mistaken for a browser-safe import. These packages are server-only, so the
bare form was not a runtime bug, but it is ambiguous with an npm package of the
same name and it hides Node-only code from review. Affected specifiers:
`'crypto'`/`'http'` in `@johnhenry/aimatey-http-core`, `'http'` in
`@johnhenry/aimatey-http`, and `'fs/promises'`/`'path'` in
`@johnhenry/aimatey-testing`. `timingSafeEqual` in `http.core`'s auth validator
stays on Node crypto — it is genuinely security-relevant and that package never
runs in a browser.

No behavioural change: `'x'` and `'node:x'` resolve to the same builtin in every
supported Node version.
