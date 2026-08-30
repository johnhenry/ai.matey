/**
 * Documentation / repository link guard.
 *
 * Sibling to `docs-api-accuracy.test.ts`. That guard checks that documented
 * *APIs* exist; this one checks that documented *files* exist.
 *
 * This exists because the examples tree was renamed and the docs were not
 * updated with it, leaving 26 links to `packages/ai.matey.docs/examples/...`
 * returning 404 on the published site (see issue #32). Nothing failed: a
 * renamed example file breaks no build, no type-check and no test, so the
 * drift was only found by crawling the deployed HTML months later.
 *
 * Three kinds of reference are resolved against the working tree:
 *
 * 1. **GitHub URLs into this repository** - `https://github.com/johnhenry/
 *    ai.matey/{tree,blob}/<ref>/<path>`. This is how the docs link to runnable
 *    examples, and the exact form that broke in #32. Links to *other*
 *    repositories (`ai.matey.examples`, ...) are left alone; they are not ours
 *    to verify.
 *
 * 2. **Relative markdown links to files** - `[text](../foo/bar.md)`. Only
 *    targets that look like a file (they have an extension) are checked;
 *    extensionless targets are Starlight routes, not paths.
 *
 * 3. **Run instructions** - `npx tsx examples/routing/x.ts` and friends inside
 *    fenced blocks. A "Run:" line naming a file that was never committed is the
 *    same broken promise as a dead link, and six of them shipped in EXAMPLES.md.
 *
 * Existence is checked **case-sensitively**, by walking directory listings
 * rather than trusting `fs.existsSync`. macOS and Windows checkouts are
 * case-insensitive, so `docs/API.md` resolves happily on a developer's laptop
 * and 404s on GitHub and on the Linux box that builds the site. Seven such
 * links were live when this guard was written; `fs.existsSync` reported every
 * one of them as fine.
 *
 * Deliberately NOT done: fetching anything over the network. External URLs rot
 * for reasons outside this repository, and a test that fails when someone
 * else's blog goes down is a test people learn to ignore.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

/** Documentation roots that are checked - kept in step with docs-api-accuracy. */
const DOC_ROOTS = [
  { dir: path.join(REPO_ROOT, 'docs'), exclude: [path.join(REPO_ROOT, 'docs', 'archive')] },
  {
    dir: path.join(REPO_ROOT, 'packages', 'ai.matey.docs', 'src', 'content', 'docs'),
    // `reference/` is starlight-typedoc output, regenerated at build time and
    // gitignored.
    exclude: [
      path.join(REPO_ROOT, 'packages', 'ai.matey.docs', 'src', 'content', 'docs', 'reference'),
    ],
  },
  // The readmes that index the examples tree. The API guard does not read these
  // - they are almost entirely links, which is precisely what this guard is for.
  { dir: path.join(REPO_ROOT, 'examples'), exclude: [] },
  { dir: path.join(REPO_ROOT, 'packages', 'ai.matey.docs', 'examples'), exclude: [] },
];

/** Single markdown files at the repo root that are also checked. */
const DOC_FILES = [path.join(REPO_ROOT, 'readme.md'), path.join(REPO_ROOT, 'EXAMPLES.md')];

// ============================================================================
// Case-sensitive path resolution
// ============================================================================

const listing = new Map<string, Set<string> | null>();

function entriesOf(dir: string): Set<string> | null {
  if (!listing.has(dir)) {
    try {
      listing.set(dir, new Set(fs.readdirSync(dir)));
    } catch {
      listing.set(dir, null);
    }
  }
  return listing.get(dir) ?? null;
}

/**
 * `fs.existsSync` with the case-insensitivity of macOS/Windows removed: every
 * segment must match a real directory entry byte for byte, the way GitHub and
 * the Linux CI box resolve it.
 */
function existsCaseSensitive(absolute: string): boolean {
  const relative = path.relative(REPO_ROOT, absolute);
  // Outside the repository - nothing to be authoritative about.
  if (relative === '' || relative.startsWith('..')) return fs.existsSync(absolute);

  let current = REPO_ROOT;
  for (const segment of relative.split(path.sep)) {
    if (segment === '.') continue;
    const entries = entriesOf(current);
    if (!entries?.has(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
}

// ============================================================================
// Documentation discovery
// ============================================================================

function listDocFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string, exclude: readonly string[]): void => {
    if (exclude.some((e) => dir === e || dir.startsWith(`${e}${path.sep}`))) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full, exclude);
      } else if (/\.mdx?$/i.test(entry.name)) {
        files.push(full);
      }
    }
  };
  for (const root of DOC_ROOTS) {
    if (fs.existsSync(root.dir)) walk(root.dir, root.exclude);
  }
  for (const file of DOC_FILES) if (fs.existsSync(file)) files.push(file);
  // Each published package ships its own readme, so those links reach npm too.
  for (const entry of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = path.join(PACKAGES_DIR, entry.name, 'readme.md');
    if (fs.existsSync(readme)) files.push(readme);
  }
  return [...new Set(files)].sort();
}

const DOC_FILES_TO_CHECK = listDocFiles();

function rel(file: string): string {
  return path.relative(REPO_ROOT, file);
}

// ============================================================================
// Reference extraction
// ============================================================================

interface Reference {
  readonly file: string;
  readonly line: number;
  /** The text as written, for the failure message. */
  readonly target: string;
  /** Absolute path it must resolve to. */
  readonly absolute: string;
  readonly kind: 'github' | 'relative' | 'run';
}

/** `https://github.com/johnhenry/ai.matey/{tree,blob}/<ref>/<path>` - this repo only. */
const GITHUB_LINK = /https?:\/\/github\.com\/johnhenry\/ai\.matey\/(?:tree|blob)\/[^/\s]+\/([^)\s"'>\]`]+)/g;
/** `[text](target)`, optionally followed by a title. */
const MARKDOWN_LINK = /\[[^\]]*\]\(\s*([^)\s]+?)\s*(?:"[^"]*")?\)/g;
/** `npx tsx path/to/file.ts`, `node scripts/x.js`, `bun run examples/y.ts`, ... */
const RUN_COMMAND =
  /(?:^|\s)(?:npx\s+tsx|npx\s+ts-node|tsx|node|bun\s+run|deno\s+run(?:\s+--?[\w-]+)*)\s+((?:\.\/)?(?:packages|examples|scripts|demo|fixtures|tests|bin)\/[\w./-]+\.[a-z]+)/g;

function extractReferences(file: string): Reference[] {
  const refs: Reference[] = [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  let inFence = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

    for (const match of line.matchAll(GITHUB_LINK)) {
      // Trailing sentence punctuation is not part of the path.
      const target = match[1]!.replace(/[.,;:]+$/, '');
      refs.push({
        file,
        line: lineNumber,
        target,
        absolute: path.join(REPO_ROOT, target),
        kind: 'github',
      });
    }

    // A `[x](y)` inside a fenced block is sample text, not a link.
    if (!inFence) {
      for (const match of line.matchAll(MARKDOWN_LINK)) {
        const target = match[1]!;
        // Absolute `/...` targets are Starlight site routes, not file paths.
        if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) continue;
        const clean = target.split('#')[0]!.split('?')[0]!;
        if (!clean) continue;
        // Extensionless targets are routes; only file-shaped links are ours.
        if (!/\.[A-Za-z0-9]+$/.test(clean)) continue;
        refs.push({
          file,
          line: lineNumber,
          target,
          absolute: path.resolve(path.dirname(file), clean),
          kind: 'relative',
        });
      }
    }

    for (const match of line.matchAll(RUN_COMMAND)) {
      const target = match[1]!;
      refs.push({
        file,
        line: lineNumber,
        target,
        absolute: path.join(REPO_ROOT, target.replace(/^\.\//, '')),
        kind: 'run',
      });
    }
  });

  return refs;
}

const ALL_REFERENCES = DOC_FILES_TO_CHECK.flatMap(extractReferences);

function brokenOfKind(kind: Reference['kind']): string[] {
  return ALL_REFERENCES.filter((r) => r.kind === kind && !existsCaseSensitive(r.absolute))
    .map((r) => `${rel(r.file)}:${r.line} links to '${r.target}', which does not exist`)
    .sort();
}

// ============================================================================
// Known-issue baseline
// ============================================================================

/**
 * Broken links that are known and still outstanding.
 *
 * Checked in both directions: an entry that stops failing must be deleted, so
 * the list can only shrink and cannot rot into a blanket suppression.
 * Regenerate with:
 *
 *   UPDATE_DOCS_LINK_BASELINE=1 npx vitest run tests/unit/docs-links.test.ts
 *
 * and never grow it to make a new failure go away - fix the link, or delete the
 * reference along with the prose that depends on it.
 */
const BASELINE_FILE = path.join(__dirname, 'docs-links.known-issues.json');

function loadBaseline(): string[] {
  if (!fs.existsSync(BASELINE_FILE)) return [];
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as string[];
}

const updatingBaseline = process.env.UPDATE_DOCS_LINK_BASELINE === '1';

function assertAgainstBaseline(failures: string[]): void {
  if (updatingBaseline) return;
  const baseline = new Set(loadBaseline());
  const regressions = failures.filter((f) => !baseline.has(f));
  expect(['Documentation links to files that do not exist:', ...regressions].join('\n  ')).toBe(
    'Documentation links to files that do not exist:'
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('documentation links resolve to real files', () => {
  it('finds documentation and references to check', () => {
    // Sanity: if either of these comes back empty the checks below pass silently.
    expect(DOC_FILES_TO_CHECK.length).toBeGreaterThan(10);
    expect(ALL_REFERENCES.length).toBeGreaterThan(100);
  });

  it('still watches the examples tree that issue #32 was about', () => {
    // The renamed example links are the regression this guard exists to catch;
    // if the docs stop linking to them this assertion should be revisited, not
    // deleted.
    const exampleLinks = ALL_REFERENCES.filter((r) =>
      r.target.includes('packages/ai.matey.docs/examples/')
    );
    expect(exampleLinks.length).toBeGreaterThan(20);
  });

  it('resolves paths case-sensitively', () => {
    // `docs/api.md` exists; `docs/API.md` must not be accepted for it, or the
    // whole check silently passes on macOS. This is not hypothetical - seven
    // links were broken this way when the guard was written.
    expect(existsCaseSensitive(path.join(REPO_ROOT, 'docs', 'api.md'))).toBe(true);
    expect(existsCaseSensitive(path.join(REPO_ROOT, 'docs', 'API.md'))).toBe(false);
  });

  it('only links to files in this repository that exist', () => {
    assertAgainstBaseline(brokenOfKind('github'));
  });

  it('only uses relative links to files that exist', () => {
    assertAgainstBaseline(brokenOfKind('relative'));
  });

  it('only tells readers to run files that exist', () => {
    assertAgainstBaseline(brokenOfKind('run'));
  });

  it('has no stale entries in the known-issues baseline', () => {
    const all = [...brokenOfKind('github'), ...brokenOfKind('relative'), ...brokenOfKind('run')];
    if (updatingBaseline) {
      fs.writeFileSync(BASELINE_FILE, `${JSON.stringify([...new Set(all)].sort(), null, 2)}\n`);
      return;
    }
    const current = new Set(all);
    const stale = loadBaseline().filter((entry) => !current.has(entry));
    expect(
      [
        'Baseline entries that no longer fail - delete them from ' +
          'tests/unit/docs-links.known-issues.json:',
        ...stale,
      ].join('\n  ')
    ).toBe(
      'Baseline entries that no longer fail - delete them from ' +
        'tests/unit/docs-links.known-issues.json:'
    );
  });
});
