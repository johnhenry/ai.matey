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
