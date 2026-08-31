/**
 * `apiKey` optionality on `BackendAdapterConfig` (#104).
 *
 * `apiKey` was `readonly apiKey: string` -- required -- on
 * `BackendAdapterConfig`, but several adapters never read it. Constructing them
 * meant inventing a dummy string for a field with no consumer, and the type
 * gave no hint that it was inert. Worse, a required credential field invites a
 * caller to put a *real* secret in it, on the reasonable assumption that it is
 * required for a reason.
 *
 * The survey that decided this (option 1 over option 2 in the issue) found
 * Bedrock is not a special case:
 *
 *   ADAPTERS THAT NEVER READ config.apiKey, yet required one:
 *     - AWSBedrockBackendAdapter   (AWSBedrockConfig extends BackendAdapterConfig)
 *     - OllamaBackendAdapter       (takes BackendAdapterConfig directly)
 *     - the model-runner backend   (ModelRunnerBackendConfig extends BackendAdapterConfig)
 *
 *   ADAPTERS THAT ONLY READ IT TO PAPER OVER ITS INERTNESS:
 *     - lmstudio.ts:68   `apiKey: config.apiKey || 'not-needed'`
 *     - omniroute.ts:48  `apiKey: config.apiKey || 'not-needed'`
 *
 *   AND A PRE-EXISTING WORKAROUND ALREADY IN THE TREE:
 *     - NodeLlamaCppConfig extends Partial<BackendAdapterConfig>, weakening
 *       EVERY field just to escape this one.
 *
 * So `apiKey` is now optional on the base config, and adapters that genuinely
 * authenticate with one require it via `ApiKeyBackendAdapterConfig`.
 *
 * These are TYPE-level assertions, so they are checked by running the real
 * TypeScript compiler over fixture sources rather than by executing anything.
 * A runtime test cannot see this change at all -- types are erased -- and a
 * grep over the source would only be a detector for the text of the fix, not
 * for its effect.
 *
 * WHAT THIS DOES NOT PROVE: it checks the representative adapters named below,
 * not all 30. `npm run typecheck` over the whole monorepo is the check that
 * covers the rest, and it passes.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Mirrors tsconfig.json, which is what `npm run typecheck` uses.
 *
 * `paths` is load-bearing and must not be dropped. `node_modules/@johnhenry/*`
 * are symlinks to `packages/*`, whose `types` entries point at built `dist`.
 * Without these mappings a fixture that imports a package by name type-checks
 * against the last BUILD rather than the current SOURCE -- and since
 * `npm run typecheck` rebuilds via turbo, the fixture would silently pass by
 * reading a dist that already contains the change under test.
 *
 * That is not hypothetical: it is exactly how an earlier version of this file
 * reported a green result while the source was deliberately broken. These
 * mappings mirror the aliases in vitest.config.ts so every fixture reads
 * from each package's `src` directory.
 */
const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noUncheckedIndexedAccess: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  skipLibCheck: true,
  noEmit: true,
  types: [],
  baseUrl: REPO_ROOT,
  paths: {
    '@johnhenry/aimatey-types': ['packages/ai.matey.types/src/index.ts'],
    '@johnhenry/aimatey-errors': ['packages/ai.matey.errors/src/index.ts'],
    '@johnhenry/aimatey-utils': ['packages/ai.matey.utils/src/index.ts'],
    '@johnhenry/aimatey-core': ['packages/ai.matey.core/src/index.ts'],
    '@johnhenry/aimatey-backend': ['packages/backend/src/index.ts'],
  },
};

interface Fixture {
  readonly name: string;
  readonly source: string;
}

/**
 * Type-check every fixture in ONE program (creating a program per fixture is
 * far too slow), then bucket the semantic diagnostics by fixture file.
 */
function checkFixtures(fixtures: readonly Fixture[]): Map<string, ts.Diagnostic[]> {
  const virtual = new Map<string, string>();
  for (const fixture of fixtures) {
    virtual.set(path.join(REPO_ROOT, fixture.name), fixture.source);
  }

  const host = ts.createCompilerHost(COMPILER_OPTIONS, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const resolved = path.resolve(fileName);
    const source = virtual.get(resolved);
    if (source !== undefined) {
      return ts.createSourceFile(fileName, source, languageVersion, true);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  };
  host.fileExists = (fileName) =>
    virtual.has(path.resolve(fileName)) || originalFileExists(fileName);
  host.readFile = (fileName) => virtual.get(path.resolve(fileName)) ?? originalReadFile(fileName);

  const program = ts.createProgram([...virtual.keys()], COMPILER_OPTIONS, host);

  const byFixture = new Map<string, ts.Diagnostic[]>();
  for (const fixture of fixtures) {
    byFixture.set(fixture.name, []);
  }
  for (const diagnostic of program.getSemanticDiagnostics()) {
    const fileName = diagnostic.file?.fileName;
    if (!fileName) continue;
    const relative = path.relative(REPO_ROOT, path.resolve(fileName));
    const bucket = byFixture.get(relative);
    if (bucket) bucket.push(diagnostic);
  }
  return byFixture;
}

function describeDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
    .join('\n');
}

const TYPES = './packages/ai.matey.types/src/adapters';
const BEDROCK = './packages/backend/src/providers/aws-bedrock';

const FIXTURES: readonly Fixture[] = [
  {
    // THE POINT OF #104. Fails before the fix: apiKey is required.
    name: '__fixture_bedrock_without_apikey.ts',
    source: `
      import type { AWSBedrockConfig } from '${BEDROCK}';
      export const config: AWSBedrockConfig = {
        region: 'us-east-1',
        awsAccessKeyId: 'fixture-access-key-id',
        awsSecretAccessKey: 'fixture-secret-access-key',
      };
    `,
  },
  {
    // The base config no longer demands a credential it cannot know is needed.
    name: '__fixture_base_config_without_apikey.ts',
    source: `
      import type { BackendAdapterConfig } from '${TYPES}';
      export const config: BackendAdapterConfig = { timeout: 1000 };
    `,
  },
  {
    // ...but an adapter that genuinely authenticates with a key still requires
    // one. Without this, "make it optional" would silently weaken every
    // adapter, which is the objection to option 1 in the issue.
    name: '__fixture_apikey_config_requires_apikey.ts',
    source: `
      import type { ApiKeyBackendAdapterConfig } from '${TYPES}';
      // @ts-expect-error apiKey is required on ApiKeyBackendAdapterConfig
      export const config: ApiKeyBackendAdapterConfig = { timeout: 1000 };
    `,
  },
  {
    // And it still accepts one.
    name: '__fixture_apikey_config_accepts_apikey.ts',
    source: `
      import type { ApiKeyBackendAdapterConfig } from '${TYPES}';
      export const config: ApiKeyBackendAdapterConfig = { apiKey: 'fixture-key' };
    `,
  },
  {
    // Passing apiKey to Bedrock is not newly an error -- making it optional
    // must not break callers who already pass the dummy string. It is simply
    // no longer required.
    name: '__fixture_bedrock_still_accepts_apikey.ts',
    source: `
      import type { AWSBedrockConfig } from '${BEDROCK}';
      export const config: AWSBedrockConfig = { apiKey: '', region: 'us-east-1' };
    `,
  },
];

describe('the type-check harness reads source, not built dist', () => {
  // Without this the whole file can report green while measuring a stale
  // build. An earlier version of it did exactly that: `npm run typecheck`
  // rebuilds via turbo, so `dist` already contained the change under test and
  // a deliberately re-broken SOURCE still "passed".
  it('resolves @johnhenry/aimatey-types to packages/*/src', () => {
    const resolved = ts.resolveModuleName(
      '@johnhenry/aimatey-types',
      path.join(REPO_ROOT, 'fixture.ts'),
      COMPILER_OPTIONS,
      ts.sys
    ).resolvedModule?.resolvedFileName;

    expect(resolved).toBeDefined();
    expect(path.relative(REPO_ROOT, path.resolve(resolved!))).toBe(
      path.join('packages', 'ai.matey.types', 'src', 'index.ts')
    );
    expect(resolved).not.toContain('dist');
  });

  it('resolves the Bedrock provider to packages/*/src', () => {
    const resolved = ts.resolveModuleName(
      BEDROCK,
      path.join(REPO_ROOT, 'fixture.ts'),
      COMPILER_OPTIONS,
      ts.sys
    ).resolvedModule?.resolvedFileName;

    expect(resolved).toBeDefined();
    expect(resolved).not.toContain('dist');
    expect(resolved).toContain(path.join('packages', 'backend', 'src'));
  });
});

describe('BackendAdapterConfig.apiKey optionality (#104)', () => {
  let results: Map<string, ts.Diagnostic[]>;

  beforeAll(() => {
    results = checkFixtures(FIXTURES);
  }, 120_000);

  it('lets an AWS Bedrock config omit apiKey, which Bedrock never reads', () => {
    const diagnostics = results.get('__fixture_bedrock_without_apikey.ts') ?? [];
    expect(describeDiagnostics(diagnostics)).toBe('');
  });

  it('lets the base BackendAdapterConfig omit apiKey', () => {
    const diagnostics = results.get('__fixture_base_config_without_apikey.ts') ?? [];
    expect(describeDiagnostics(diagnostics)).toBe('');
  });

  it('still requires apiKey on ApiKeyBackendAdapterConfig', () => {
    // The fixture carries a @ts-expect-error, so a CLEAN result means the
    // error it expects was raised. An unused-directive diagnostic here would
    // mean apiKey had become optional there too.
    const diagnostics = results.get('__fixture_apikey_config_requires_apikey.ts') ?? [];
    expect(describeDiagnostics(diagnostics)).toBe('');
  });

  it('accepts apiKey on ApiKeyBackendAdapterConfig', () => {
    const diagnostics = results.get('__fixture_apikey_config_accepts_apikey.ts') ?? [];
    expect(describeDiagnostics(diagnostics)).toBe('');
  });

  it('does not newly reject a Bedrock config that still passes apiKey', () => {
    const diagnostics = results.get('__fixture_bedrock_still_accepts_apikey.ts') ?? [];
    expect(describeDiagnostics(diagnostics)).toBe('');
  });
});

describe('the adapters that ignore apiKey really do ignore it (#104)', () => {
  it('AWS Bedrock reads config.apiKey zero times', async () => {
    // The premise of the whole change. Read from disk rather than asserted
    // from memory: if someone later makes Bedrock authenticate with an API
    // key, this fails and the type should be revisited.
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      path.join(REPO_ROOT, 'packages/backend/src/providers/aws-bedrock.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/\bapiKey\b/);
  });

  it('Ollama reads config.apiKey zero times', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      path.join(REPO_ROOT, 'packages/backend/src/providers/ollama.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/\bapiKey\b/);
  });
});
