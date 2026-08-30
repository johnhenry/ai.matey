/**
 * Documentation / API drift guard.
 *
 * Every fenced `ts` / `typescript` block in the documentation is checked against
 * the real exported API. This exists because the docs repeatedly drifted into
 * describing APIs that do not exist - `BridgeConfig.middleware`,
 * `new Router(frontend, { backends })`, `Router.chat()`, `'priority'` routing -
 * each of which costs a reader the time to write it, run it, and work out that
 * the library, not their code, is wrong (see issue #61).
 *
 * Three checks run over the extracted snippets:
 *
 * 1. **Import specifiers** - every `import ... from '@johnhenry/aimatey-*'` must
 *    name a package (and subpath) that exists, and every named binding must
 *    actually be exported from it. Unscoped `ai.matey.*` specifiers are rejected
 *    outright: the packages were renamed into the `@johnhenry` scope (#33/#34).
 *
 * 2. **Documented interfaces** - when a snippet writes `interface X { ... }` and
 *    `X` is a real exported interface, every member it lists must exist on the
 *    real one. This is the check that would have caught `BridgeConfig.middleware`.
 *    Documenting a subset is fine; inventing a field is not.
 *
 * 3. **Documented string-union types** - when a snippet writes
 *    `type X = 'a' | 'b'` and `X` is a real exported union backed by an
 *    `as const` object (RoutingStrategy, FallbackStrategy, ErrorCode, ...),
 *    every literal must be a real member. This catches invented enum values.
 *
 * Deliberately NOT done: full `tsc` compilation of every snippet. Most doc
 * snippets are fragments - they reference `backend1`, elide bodies with `...`,
 * and assume surrounding context - so compiling them would need every block
 * annotated or rewritten first. The three checks above need no annotation, have
 * no false positives to suppress, and cover the class of drift that actually
 * happened.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

/** Documentation roots that are checked. */
const DOC_ROOTS = [
  { dir: path.join(REPO_ROOT, 'docs'), exclude: [path.join(REPO_ROOT, 'docs', 'archive')] },
  {
    dir: path.join(REPO_ROOT, 'packages', 'ai.matey.docs', 'src', 'content', 'docs'),
    // `reference/` is starlight-typedoc output, regenerated at build time and
    // gitignored - it mirrors JSDoc `@example` blocks in the sources, which are
    // not what this check is for.
    exclude: [
      path.join(REPO_ROOT, 'packages', 'ai.matey.docs', 'src', 'content', 'docs', 'reference'),
    ],
  },
];

/** Single markdown files at the repo root that are also checked. */
const DOC_FILES = [path.join(REPO_ROOT, 'readme.md'), path.join(REPO_ROOT, 'EXAMPLES.md')];

const SCOPE_PREFIX = '@johnhenry/aimatey';
/** Old unscoped names, retired when the packages moved into the @johnhenry scope. */
const LEGACY_SPECIFIER = /^ai\.matey(\.|$)/;

/**
 * Specifiers that are deliberately fictional - stand-ins in "how to add a new
 * package" instructions, where the whole point is that the package does not
 * exist yet. Keep this list tiny; it is not a suppression mechanism.
 */
const PLACEHOLDER_SPECIFIERS = new Set(['@johnhenry/aimatey-my-new-package']);

// ============================================================================
// Workspace package index
// ============================================================================

interface PackageInfo {
  readonly name: string;
  readonly dir: string;
  /** Subpath (".", "./openai", ...) -> absolute source entry file. */
  readonly entries: Map<string, string>;
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
}

/**
 * Turn a package.json `exports` target such as `./dist/esm/providers/openai.js`
 * into the source file that produced it (`src/providers/openai.ts`).
 */
function distTargetToSource(pkgDir: string, target: string): string | undefined {
  const stripped = target
    .replace(/^\.\//, '')
    .replace(/^dist\/(esm|cjs|types)\//, '')
    .replace(/\.(d\.ts|js|mjs|cjs)$/, '');
  for (const candidate of [
    path.join(pkgDir, 'src', `${stripped}.ts`),
    path.join(pkgDir, 'src', `${stripped}.tsx`),
    path.join(pkgDir, 'src', stripped, 'index.ts'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function loadPackages(): Map<string, PackageInfo> {
  const packages = new Map<string, PackageInfo>();

  for (const entry of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgDir = path.join(PACKAGES_DIR, entry.name);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkgJson = readJson(pkgJsonPath);
    const name = pkgJson.name;
    if (typeof name !== 'string') continue;

    const entries = new Map<string, string>();
    const exportsField = pkgJson.exports;
    if (exportsField && typeof exportsField === 'object') {
      for (const [subpath, target] of Object.entries(exportsField as Record<string, unknown>)) {
        // Target is either a string or a conditional map ({ import, require, types }).
        let file: string | undefined;
        if (typeof target === 'string') {
          file = target;
        } else if (target && typeof target === 'object') {
          const conditions = target as Record<string, unknown>;
          const picked = conditions.types ?? conditions.import ?? conditions.default;
          if (typeof picked === 'string') file = picked;
          else if (picked && typeof picked === 'object') {
            const nested = picked as Record<string, unknown>;
            const nestedPick = nested.types ?? nested.import ?? nested.default;
            if (typeof nestedPick === 'string') file = nestedPick;
          }
        }
        if (!file) continue;
        const source = distTargetToSource(pkgDir, file);
        if (source) entries.set(subpath, source);
      }
    }
    if (!entries.has('.')) {
      const fallback = path.join(pkgDir, 'src', 'index.ts');
      if (fs.existsSync(fallback)) entries.set('.', fallback);
    }

    packages.set(name, { name, dir: pkgDir, entries });
  }

  return packages;
}

const PACKAGES = loadPackages();

// ============================================================================
// Source parsing
// ============================================================================

const sourceFileCache = new Map<string, ts.SourceFile>();

function parse(file: string, text?: string): ts.SourceFile {
  const cached = sourceFileCache.get(file);
  if (cached && text === undefined) return cached;
  const sf = ts.createSourceFile(
    file,
    text ?? fs.readFileSync(file, 'utf-8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  if (text === undefined) sourceFileCache.set(file, sf);
  return sf;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/** Resolve a relative module specifier (`./x.js`) to a source file on disk. */
function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = path.resolve(path.dirname(fromFile), specifier.replace(/\.js$/, ''));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Collect every name exported from an entry file, following `export *` and
 * `export { ... } from` both within the package and across workspace packages.
 */
function collectExports(entryFile: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(entryFile)) return names;
  seen.add(entryFile);

  const sf = parse(entryFile);

  for (const statement of sf.statements) {
    if (ts.isExportDeclaration(statement)) {
      const spec = statement.moduleSpecifier;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) names.add(element.name.text);
        continue;
      }
      // `export * from '...'`
      if (spec && ts.isStringLiteral(spec)) {
        const target = spec.text.startsWith('.')
          ? resolveRelative(entryFile, spec.text)
          : resolveWorkspaceSpecifier(spec.text);
        if (target) for (const n of collectExports(target, seen)) names.add(n);
      }
      continue;
    }

    if (!hasExportModifier(statement)) continue;

    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      if (statement.name && ts.isIdentifier(statement.name)) names.add(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    }
  }

  return names;
}

/** Resolve a bare `@johnhenry/aimatey-*` specifier to its source entry file. */
function resolveWorkspaceSpecifier(specifier: string): string | undefined {
  const { packageName, subpath } = splitSpecifier(specifier);
  return PACKAGES.get(packageName)?.entries.get(subpath);
}

function splitSpecifier(specifier: string): { packageName: string; subpath: string } {
  const parts = specifier.split('/');
  const packageName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
  const rest = specifier.slice(packageName.length);
  return { packageName, subpath: rest === '' ? '.' : `.${rest}` };
}

const exportsCache = new Map<string, Set<string>>();

function exportsFor(specifier: string): Set<string> | undefined {
  const cached = exportsCache.get(specifier);
  if (cached) return cached;
  const entry = resolveWorkspaceSpecifier(specifier);
  if (!entry) return undefined;
  const names = collectExports(entry);
  exportsCache.set(specifier, names);
  return names;
}

// ============================================================================
// Real type shapes
// ============================================================================

function allSourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  };
  for (const pkg of PACKAGES.values()) {
    const src = path.join(pkg.dir, 'src');
    if (fs.existsSync(src)) walk(src);
  }
  return files;
}

/** Exported interface name -> the member-name sets of every declaration seen. */
const realInterfaces = new Map<string, Set<string>[]>();
/** Exported `as const` object / string-union name -> the string values it allows. */
const realStringUnions = new Map<string, Set<string>>();

function memberNamesOf(decl: ts.InterfaceDeclaration): Set<string> {
  const names = new Set<string>();
  for (const member of decl.members) {
    const name = member.name;
    if (!name) continue;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) names.add(name.text);
  }
  // Members inherited via `extends` are legitimate too; record the base names so
  // the check can widen with them.
  for (const clause of decl.heritageClauses ?? []) {
    for (const type of clause.types) {
      if (ts.isIdentifier(type.expression)) names.add(` extends:${type.expression.text}`);
    }
  }
  return names;
}

function indexRealTypes(): void {
  for (const file of allSourceFiles()) {
    const sf = parse(file);
    for (const statement of sf.statements) {
      if (!hasExportModifier(statement)) continue;

      if (ts.isInterfaceDeclaration(statement)) {
        const list = realInterfaces.get(statement.name.text) ?? [];
        list.push(memberNamesOf(statement));
        realInterfaces.set(statement.name.text, list);
        continue;
      }

      // `export const X = { A: 'a', ... } as const;` - the union-of-values idiom
      // used for RoutingStrategy, FallbackStrategy, ErrorCode, BridgeEventType.
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
          let init: ts.Expression = decl.initializer;
          if (ts.isAsExpression(init)) init = init.expression;
          if (!ts.isObjectLiteralExpression(init)) continue;
          const values = new Set<string>();
          let allStrings = true;
          for (const prop of init.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer)) {
              values.add(prop.initializer.text);
            } else {
              allStrings = false;
            }
          }
          if (allStrings && values.size > 0) realStringUnions.set(decl.name.text, values);
        }
        continue;
      }

      // `export type X = 'a' | 'b';`
      if (ts.isTypeAliasDeclaration(statement) && ts.isUnionTypeNode(statement.type)) {
        const values = new Set<string>();
        let allStrings = true;
        for (const member of statement.type.types) {
          if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
            values.add(member.literal.text);
          } else {
            allStrings = false;
          }
        }
        if (allStrings && values.size > 0) realStringUnions.set(statement.name.text, values);
      }
    }
  }

  // Flatten `extends` markers into concrete member names.
  for (const [name, declarations] of realInterfaces) {
    void name;
    for (const members of declarations) {
      for (const marker of [...members]) {
        if (!marker.startsWith(' extends:')) continue;
        members.delete(marker);
        const base = marker.slice(' extends:'.length);
        for (const baseMembers of realInterfaces.get(base) ?? []) {
          for (const m of baseMembers) if (!m.startsWith(' extends:')) members.add(m);
        }
      }
    }
  }
}

indexRealTypes();

// ============================================================================
// Documentation snippets
// ============================================================================

interface Snippet {
  readonly file: string;
  /** 1-based line number of the opening fence. */
  readonly line: number;
  readonly code: string;
}

const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\n]*)$/;

function extractSnippets(file: string): Snippet[] {
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const snippets: Snippet[] = [];

  let open: { indent: string; marker: string; lang: string; line: number; body: string[] } | null =
    null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const match = FENCE.exec(raw);

    if (open) {
      if (
        match &&
        match[2]!.startsWith(open.marker[0]!) &&
        match[2]!.length >= open.marker.length &&
        match[3]!.trim() === ''
      ) {
        if (/^(ts|typescript|tsx)\b/i.test(open.lang)) {
          snippets.push({ file, line: open.line, code: open.body.join('\n') });
        }
        open = null;
      } else {
        open.body.push(raw);
      }
      continue;
    }

    if (match) {
      open = {
        indent: match[1]!,
        marker: match[2]!,
        // Expressive Code meta strings ("ts title=..." / "ts {1,3}") - take the word.
        lang: match[3]!.trim(),
        line: i + 1,
        body: [],
      };
    }
  }

  return snippets;
}

function listDocFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string, exclude: readonly string[]): void => {
    if (exclude.some((e) => dir === e || dir.startsWith(`${e}${path.sep}`))) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, exclude);
      else if (/\.mdx?$/.test(entry.name)) files.push(full);
    }
  };
  for (const root of DOC_ROOTS) {
    if (fs.existsSync(root.dir)) walk(root.dir, root.exclude);
  }
  for (const file of DOC_FILES) if (fs.existsSync(file)) files.push(file);
  // Each published package ships its own readme (see the `files` field in its
  // package.json), so those are the snippets that actually reach npm.
  for (const pkg of PACKAGES.values()) {
    const readme = path.join(pkg.dir, 'readme.md');
    if (fs.existsSync(readme)) files.push(readme);
  }
  return files.sort();
}

const DOC_FILES_TO_CHECK = listDocFiles();

function rel(file: string): string {
  return path.relative(REPO_ROOT, file);
}

// ============================================================================
// Checks
// ============================================================================

function checkImports(snippet: Snippet): string[] {
  const problems: string[] = [];
  const sf = parse(`${snippet.file}#${snippet.line}.ts`, snippet.code);

  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;

    if (LEGACY_SPECIFIER.test(specifier)) {
      problems.push(
        `imports from retired unscoped package '${specifier}' - packages moved to the ` +
          `'${SCOPE_PREFIX}' scope (#33/#34)`
      );
      continue;
    }
    if (!specifier.startsWith(SCOPE_PREFIX)) continue;
    if (PLACEHOLDER_SPECIFIERS.has(specifier)) continue;

    const exported = exportsFor(specifier);
    if (!exported) {
      problems.push(`imports from '${specifier}', which is not a package/subpath in this workspace`);
      continue;
    }

    const clause = statement.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (!exported.has(imported)) {
        problems.push(`imports '${imported}' from '${specifier}', which does not export it`);
      }
    }
  }

  return problems;
}

function checkDocumentedInterfaces(snippet: Snippet): string[] {
  const problems: string[] = [];
  const sf = parse(`${snippet.file}#${snippet.line}.ts`, snippet.code);

  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node)) {
      const declarations = realInterfaces.get(node.name.text);
      if (declarations) {
        const documented = [...memberNamesOf(node)].filter((n) => !n.startsWith(' '));
        // A doc may describe a subset; it may not invent members. Accept the
        // snippet if any real declaration of that name covers all of them.
        const covered = declarations.some((real) => documented.every((m) => real.has(m)));
        if (!covered) {
          const best = declarations[0]!;
          const invented = documented.filter((m) => !declarations.some((real) => real.has(m)));
          problems.push(
            `documents 'interface ${node.name.text}' with field(s) that do not exist: ` +
              `${invented.map((m) => `'${m}'`).join(', ')}. Real fields: ` +
              `${[...best].sort().join(', ')}`
          );
        }
      }
    }
    if (ts.isTypeAliasDeclaration(node) && ts.isUnionTypeNode(node.type)) {
      const real = realStringUnions.get(node.name.text);
      if (real) {
        const invented: string[] = [];
        for (const member of node.type.types) {
          if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
            if (!real.has(member.literal.text)) invented.push(member.literal.text);
          }
        }
        if (invented.length > 0) {
          problems.push(
            `documents 'type ${node.name.text}' with value(s) that do not exist: ` +
              `${invented.map((v) => `'${v}'`).join(', ')}. Real values: ` +
              `${[...real].sort().join(', ')}`
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return problems;
}

/**
 * Config object literals passed straight to a constructor or factory.
 *
 * This is the check that catches the `#46`-shaped failure directly: a reader
 * writes `new Bridge(frontend, backend, { middleware: [...] })`, TypeScript's
 * excess-property check is the only thing that would have complained, and in a
 * doc snippet nothing complains at all - they get a bridge with no middleware.
 */
const CONFIG_ARGUMENTS: Record<string, string> = {
  Bridge: 'BridgeConfig',
  Router: 'RouterConfig',
  createBridge: 'BridgeConfig',
  createRouter: 'RouterConfig',
};

function checkConfigArguments(snippet: Snippet): string[] {
  const problems: string[] = [];
  const sf = parse(`${snippet.file}#${snippet.line}.ts`, snippet.code);

  const visit = (node: ts.Node): void => {
    let calleeName: string | undefined;
    let args: readonly ts.Expression[] | undefined;

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      calleeName = node.expression.text;
      args = node.arguments;
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      calleeName = node.expression.text;
      args = node.arguments;
    }

    const configTypeName = calleeName ? CONFIG_ARGUMENTS[calleeName] : undefined;
    const declarations = configTypeName ? realInterfaces.get(configTypeName) : undefined;

    if (declarations && args) {
      for (const arg of args) {
        if (!ts.isObjectLiteralExpression(arg)) continue;
        const keys: string[] = [];
        for (const prop of arg.properties) {
          const name = prop.name;
          if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) keys.push(name.text);
          else if (ts.isShorthandPropertyAssignment(prop)) keys.push(prop.name.text);
        }
        const invented = keys.filter((k) => !declarations.some((real) => real.has(k)));
        if (invented.length > 0) {
          problems.push(
            `passes ${invented.map((k) => `'${k}'`).join(', ')} to ${calleeName}, which is not on ` +
              `${configTypeName}. Real fields: ${[...declarations[0]!].sort().join(', ')}`
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return problems;
}

// ============================================================================
// Known-issue baseline
// ============================================================================

/**
 * Documentation drift that is known and still outstanding, tracked in #61.
 *
 * The baseline is checked in both directions: an entry that stops failing must
 * be deleted, so the list can only shrink and cannot rot into a blanket
 * suppression. Regenerate with:
 *
 *   UPDATE_DOCS_BASELINE=1 npx vitest run tests/unit/docs-api-accuracy.test.ts
 *
 * and never grow it to make a new failure go away - fix the documentation.
 */
const BASELINE_FILE = path.join(__dirname, 'docs-api-accuracy.known-issues.json');

function loadBaseline(): string[] {
  if (!fs.existsSync(BASELINE_FILE)) return [];
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as string[];
}

const updatingBaseline = process.env.UPDATE_DOCS_BASELINE === '1';

function collect(check: (snippet: Snippet) => string[]): string[] {
  const failures: string[] = [];
  for (const file of DOC_FILES_TO_CHECK) {
    for (const snippet of extractSnippets(file)) {
      for (const problem of check(snippet)) {
        failures.push(`${rel(file)}:${snippet.line} ${problem}`);
      }
    }
  }
  return failures.sort();
}

function assertAgainstBaseline(failures: string[]): void {
  if (updatingBaseline) return;
  const baseline = new Set(loadBaseline());
  const regressions = failures.filter((f) => !baseline.has(f));
  expect(
    ['New documentation/API mismatches introduced:', ...regressions].join('\n  ')
  ).toBe('New documentation/API mismatches introduced:');
}

// ============================================================================
// Tests
// ============================================================================

describe('documentation matches the real API', () => {
  it('finds documentation to check', () => {
    expect(DOC_FILES_TO_CHECK.length).toBeGreaterThan(10);
    expect(PACKAGES.size).toBeGreaterThan(10);
  });

  it('indexes the real exported types', () => {
    // Sanity: if this ever comes back empty the checks below silently pass.
    expect(realInterfaces.has('BridgeConfig')).toBe(true);
    expect(realInterfaces.has('RouterConfig')).toBe(true);
    expect(realStringUnions.has('RoutingStrategy')).toBe(true);
    expect(exportsFor('@johnhenry/aimatey-core')?.has('Bridge')).toBe(true);
    expect(exportsFor('@johnhenry/aimatey-backend/openai')?.has('OpenAIBackendAdapter')).toBe(true);
  });

  it('only imports symbols the packages actually export', () => {
    assertAgainstBaseline(collect(checkImports));
  });

  it('only documents fields and values that exist on the real types', () => {
    assertAgainstBaseline(collect(checkDocumentedInterfaces));
  });

  it('only passes real config fields to Bridge and Router', () => {
    assertAgainstBaseline(collect(checkConfigArguments));
  });

  it('has no stale entries in the known-issues baseline', () => {
    const all = [
      ...collect(checkImports),
      ...collect(checkDocumentedInterfaces),
      ...collect(checkConfigArguments),
    ];
    if (updatingBaseline) {
      fs.writeFileSync(BASELINE_FILE, `${JSON.stringify([...new Set(all)].sort(), null, 2)}\n`);
      return;
    }
    const current = new Set(all);
    const stale = loadBaseline().filter((entry) => !current.has(entry));
    expect(
      [
        'Baseline entries that no longer fail - delete them from ' +
          'tests/unit/docs-api-accuracy.known-issues.json:',
        ...stale,
      ].join('\n  ')
    ).toBe(
      'Baseline entries that no longer fail - delete them from ' +
        'tests/unit/docs-api-accuracy.known-issues.json:'
    );
  });
});
