/**
 * Browser-safety guard (issue #48)
 *
 * A set of packages in this monorepo are explicitly browser-facing: they are
 * consumed from browsers, webviews, Capacitor and Electron renderers, either
 * directly or as the dependency of a package that is. If any of their source
 * modules imports a Node builtin, bundlers externalize it for browser targets
 * and the import resolves to an empty/stub module -- so the failure surfaces
 * only at runtime, as `TypeError: <fn> is not a function`, long after a green
 * CI run.
 *
 * That is exactly what happened in #48: `packages/middleware/src/caching.ts`
 * imported `createHash` from `'crypto'`, the package barrel re-exported the
 * module, and every browser consumer of `createCachingMiddleware` crashed on
 * the first cache lookup.
 *
 * This test scans those packages' `src/` for Node builtin imports and fails
 * with the offending file, line and specifier. It matches both the bare form
 * (`'crypto'`) and the prefixed form (`'node:crypto'`) -- `node:` makes the
 * intent explicit but does nothing to make the module available in a browser.
 *
 * The same file also guards against CommonJS `require()` in package sources
 * (issue #59). Every published package here declares `"type": "module"` and is
 * dual-built to ESM and CJS from one TypeScript source, so a bare `require()`
 * compiles fine, passes CI, and then throws `ReferenceError: require is not
 * defined` in the ESM half -- while browser bundlers either fail outright or
 * externalize it into something equally broken. #59 was exactly that: a
 * `require('zod')` availability probe in `ai.matey.utils/src/structured-output.ts`
 * whose `catch` turned the ReferenceError into a misleading "Zod is not
 * installed" error for every ESM consumer, installed or not.
 *
 * Companion to `layering.test.ts`, which guards package *dependency* layering
 * the same way.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = join(__dirname, '..', '..', 'packages');

/**
 * Packages whose `src/` must stay free of Node builtins.
 *
 * Entries are directory names under `packages/`. Add a package here when it
 * becomes browser-facing; never remove one to make this test pass.
 *
 * Deliberately excluded, because they are Node-only by design:
 * `backend` (server-side provider adapters, incl. AWS SigV4 signing),
 * `http` / `http.core`, `cli`, `native-*`, `ai.matey.testing` (fixture I/O),
 * and `react-nextjs` (its `server.ts` entry point is a Next.js route
 * handler; its browser surface is `client.ts`).
 */
const BROWSER_FACING_PACKAGES = [
  'ai.matey.types',
  'ai.matey.errors',
  'ai.matey.utils',
  'ai.matey.core',
  'backend-browser',
  'frontend',
  'middleware',
  'mcp',
  'patterns',
  'react-core',
  'react-hooks',
  'react-stream',
  'wrapper',
] as const;

/**
 * Node builtin module names, as they may appear in an import specifier.
 * (`fs/promises`, `stream/web`, … are covered by the subpath handling in
 * {@link isNodeBuiltin}.)
 */
const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

function isNodeBuiltin(specifier: string): boolean {
  const withoutPrefix = specifier.startsWith('node:') ? specifier.slice('node:'.length) : specifier;
  // Any `node:` specifier is a builtin by definition; otherwise match the
  // bare name, allowing subpaths such as `fs/promises`.
  return specifier.startsWith('node:') || NODE_BUILTINS.has(withoutPrefix.split('/')[0] ?? '');
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];

  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
        continue;
      }
      if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
        out.push(full);
      }
    }
  };

  walk(dir);
  return out;
}

interface Violation {
  file: string;
  line: number;
  specifier: string;
  source: string;
}

/**
 * Match module specifiers in static imports/exports and in dynamic
 * `import(...)` / `require(...)` calls. This is deliberately a lexical scan
 * rather than a parse: it is cheap, has no dependencies, and errs towards
 * reporting too much rather than too little.
 */
const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function findViolations(packageDir: string): Violation[] {
  const srcDir = join(PACKAGES_DIR, packageDir, 'src');
  const violations: Violation[] = [];

  for (const file of collectSourceFiles(srcDir)) {
    const lines = readFileSync(file, 'utf-8').split('\n');

    lines.forEach((source, index) => {
      const trimmed = source.trim();
      // Skip comment lines so that JSDoc examples do not trip the guard.
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
        return;
      }

      for (const pattern of SPECIFIER_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source)) !== null) {
          const specifier = match[1] ?? '';
          if (isNodeBuiltin(specifier)) {
            violations.push({
              file: file.slice(PACKAGES_DIR.length + 1),
              line: index + 1,
              specifier,
              source: trimmed,
            });
          }
        }
      }
    });
  }

  return violations;
}

function describeViolations(violations: Violation[]): string {
  return violations
    .map((v) => `  packages/${v.file}:${v.line}  imports '${v.specifier}'\n      ${v.source}`)
    .join('\n');
}

describe('browser safety', () => {
  it.each(BROWSER_FACING_PACKAGES)(
    '%s/src does not import any Node builtin',
    (packageDir) => {
      const violations = findViolations(packageDir);

      expect(
        violations,
        violations.length === 0
          ? ''
          : `\n${packageDir} is a browser-facing package but its source imports Node builtins.\n` +
              `Bundlers externalize these for browser targets, so the import is undefined at\n` +
              `runtime (see issue #48). Replace it with a platform-neutral implementation, or\n` +
              `move the code into a Node-only package.\n\n${describeViolations(violations)}\n`
      ).toEqual([]);
    }
  );

  it('scans a non-trivial number of files (the guard is not silently vacuous)', () => {
    const total = BROWSER_FACING_PACKAGES.reduce(
      (sum, pkg) => sum + collectSourceFiles(join(PACKAGES_DIR, pkg, 'src')).length,
      0
    );
    expect(total).toBeGreaterThan(50);
  });

  it('detects a Node builtin import when one is present', () => {
    // Self-check: the scanner must actually flag the shapes it claims to.
    const bare = 'cry' + 'pto';
    const flagged = [
      `import { createHash } from '${bare}';`,
      "import { createHash } from 'node:crypto';",
      `import { readFile } from '${'f' + 's'}/promises';`,
      "import { readFile } from 'node:fs/promises';",
      `export { join } from '${'pa' + 'th'}';`,
      `import '${'o' + 's'}';`,
      `const { createHash } = require('${bare}');`,
      "const mod = await import('node:crypto');",
    ];
    const ignored = [
      "import { Bridge } from '@johnhenry/aimatey-core';",
      "import { stableHash } from './hash.js';",
      "import type { Foo } from '../types/crypto.js';",
      "import { z } from 'zod';",
    ];

    const specifiersIn = (source: string): string[] => {
      const found: string[] = [];
      for (const pattern of SPECIFIER_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source)) !== null) {
          found.push(match[1] ?? '');
        }
      }
      return found;
    };

    for (const source of flagged) {
      expect(specifiersIn(source).some(isNodeBuiltin), source).toBe(true);
    }
    for (const source of ignored) {
      expect(specifiersIn(source).some(isNodeBuiltin), source).toBe(false);
    }
  });
});

describe('node builtin specifiers are prefixed with `node:`', () => {
  // Node-only packages may of course use Node builtins, but they must say so
  // explicitly: the bare form is what made #48 easy to miss in review, and it
  // is ambiguous with an npm package of the same name.
  const ALL_PACKAGES = readdirSync(PACKAGES_DIR).filter((entry) => {
    try {
      return statSync(join(PACKAGES_DIR, entry, 'src')).isDirectory();
    } catch {
      return false;
    }
  });

  it('every package source uses `node:` for builtin imports', () => {
    const bare: Violation[] = [];

    for (const packageDir of ALL_PACKAGES) {
      for (const violation of findViolations(packageDir)) {
        if (!violation.specifier.startsWith('node:')) {
          bare.push(violation);
        }
      }
    }

    expect(
      bare,
      bare.length === 0
        ? ''
        : `\nNode builtins must be imported with the 'node:' prefix:\n\n${describeViolations(bare)}\n`
    ).toEqual([]);
  });
});
// ============================================================================
// CommonJS `require()` guard (issue #59)
// ============================================================================

/**
 * A `require` call to the CommonJS global.
 *
 * The lookbehind rejects member access and longer identifiers, so
 * `createRequire(...)` (the legitimate `node:module` escape hatch, already
 * governed by the Node-builtin rules above) and `foo.require(...)` on an
 * unrelated object are not mistaken for the global.
 */
const REQUIRE_CALL_PATTERN = /(?<![$\w.])require\s*\(/g;

function describeRequireViolations(violations: Violation[]): string {
  return violations
    .map((v) => `  packages/${v.file}:${v.line}  calls require()\n      ${v.source}`)
    .join('\n');
}

/**
 * Blank out comments and string/template literal *contents* so the scan below
 * cannot be fooled by prose or by an error message that mentions `require(`.
 *
 * Only the contents are blanked -- the surrounding quotes stay -- so a real
 * `require('zod')` is untouched by the string pass, since the call itself
 * lives outside the quotes.
 *
 * This is a small lexer, not a parser: it tracks whether it is inside a block
 * comment across lines, which the line-oriented skip used by the Node-builtin
 * scan above does not.
 */
function stripCommentsAndStringContents(lines: string[]): string[] {
  const out: string[] = [];
  let inBlockComment = false;

  for (const line of lines) {
    let result = '';
    let index = 0;
    let quote: string | null = null;

    while (index < line.length) {
      const char = line[index] ?? '';
      const next = line[index + 1] ?? '';

      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          index += 2;
          continue;
        }
        index += 1;
        continue;
      }

      if (quote !== null) {
        if (char === '\\') {
          index += 2;
          continue;
        }
        if (char === quote) {
          result += char;
          quote = null;
        }
        index += 1;
        continue;
      }

      if (char === '/' && next === '/') {
        break; // rest of the line is a comment
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        result += char;
        index += 1;
        continue;
      }

      result += char;
      index += 1;
    }

    out.push(result);
  }

  return out;
}

describe('no CommonJS require() in ESM package sources', () => {
  /**
   * Packages that declare `"type": "module"`. A package that is genuinely
   * CommonJS may of course use `require`; these may not, because their ESM
   * build is the one most consumers load.
   */
  const ESM_PACKAGES = readdirSync(PACKAGES_DIR).filter((entry) => {
    try {
      if (!statSync(join(PACKAGES_DIR, entry, 'src')).isDirectory()) return false;
      const manifest = JSON.parse(
        readFileSync(join(PACKAGES_DIR, entry, 'package.json'), 'utf-8')
      ) as { type?: string };
      return manifest.type === 'module';
    } catch {
      return false;
    }
  });

  function findRequireCalls(packageDir: string): Violation[] {
    const srcDir = join(PACKAGES_DIR, packageDir, 'src');
    const violations: Violation[] = [];

    for (const file of collectSourceFiles(srcDir)) {
      // `.cjs`/`.cts` are CommonJS by extension: `require` is correct there.
      if (/\.(cjs|cts)$/.test(file)) continue;

      const rawLines = readFileSync(file, 'utf-8').split('\n');
      const scannable = stripCommentsAndStringContents(rawLines);

      scannable.forEach((source, index) => {
        REQUIRE_CALL_PATTERN.lastIndex = 0;
        if (!REQUIRE_CALL_PATTERN.test(source)) return;
        violations.push({
          file: file.slice(PACKAGES_DIR.length + 1),
          line: index + 1,
          specifier: 'require()',
          source: (rawLines[index] ?? '').trim(),
        });
      });
    }

    return violations;
  }

  it('finds ESM packages to scan (the guard is not silently vacuous)', () => {
    expect(ESM_PACKAGES.length).toBeGreaterThan(15);
  });

  it('no package source calls require()', () => {
    const violations = ESM_PACKAGES.flatMap(findRequireCalls);

    expect(
      violations,
      violations.length === 0
        ? ''
        : `\n\`require()\` is not defined in an ES module, and every package here ships an\n` +
            `ESM build (see issue #59). Use a static \`import\`, a dynamic \`await import()\`,\n` +
            `or have the caller inject the dependency.\n\n${describeRequireViolations(violations)}\n`
    ).toEqual([]);
  });

  it('flags require() calls and ignores look-alikes', () => {
    // Self-check: the scanner must flag the shapes it claims to, including the
    // exact line from #59, and must not trip on prose or strings.
    const flagged = [
      "const loaded = require('zod').z;",
      'const { createHash } = require("node:crypto");',
      'const mod = require(name);',
      'require ( "side-effect" );',
      'if (x) { require("y"); }',
    ];
    const ignored = [
      "import { z } from 'zod';",
      "const mod = await import('zod');",
      'const require_ = 1; const nodeRequire = 2; const requireAuth = fn;',
      "import { createRequire } from 'node:module'; const req = createRequire(import.meta.url);",
      'const handler = { require: fn }; handler.require("x");',
      "// const loaded = require('zod').z;",
      "/* const loaded = require('zod').z; */",
      "throw new Error('call require(\\'zod\\') instead');",
      '// eslint-disable-next-line @typescript-eslint/require-await',
    ];

    const hasRequireCall = (source: string): boolean => {
      const [scanned = ''] = stripCommentsAndStringContents([source]);
      REQUIRE_CALL_PATTERN.lastIndex = 0;
      return REQUIRE_CALL_PATTERN.test(scanned);
    };

    for (const source of flagged) {
      expect(hasRequireCall(source), source).toBe(true);
    }
    for (const source of ignored) {
      expect(hasRequireCall(source), source).toBe(false);
    }
  });

  it('ignores require() inside a multi-line block comment', () => {
    const lines = [
      '/**',
      " * Issue #59: the previous implementation used require('zod').",
      ' */',
      'export const ok = 1;',
    ];
    const scanned = stripCommentsAndStringContents(lines);
    for (const source of scanned) {
      REQUIRE_CALL_PATTERN.lastIndex = 0;
      expect(REQUIRE_CALL_PATTERN.test(source), source).toBe(false);
    }
  });
});
