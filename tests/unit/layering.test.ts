/**
 * Package layering tests
 *
 * Guards the monorepo dependency layering:
 *   types → errors/utils → frontend/backend/core → everything else
 *
 * Frontend adapters translate client formats to IR and must be usable
 * without any backend adapter installed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = join(__dirname, '..', '..', 'packages');

function dependenciesOf(packageDir: string): Record<string, string> {
  const pkg = JSON.parse(
    readFileSync(join(PACKAGES_DIR, packageDir, 'package.json'), 'utf-8')
  ) as { dependencies?: Record<string, string> };
  return pkg.dependencies ?? {};
}

describe('package layering', () => {
  it('ai.matey.frontend does not depend on ai.matey.backend', () => {
    expect(dependenciesOf('frontend')).not.toHaveProperty('ai.matey.backend');
  });

  it('ai.matey.utils does not depend on core, frontend, or backend', () => {
    const deps = dependenciesOf('ai.matey.utils');
    expect(deps).not.toHaveProperty('ai.matey.core');
    expect(deps).not.toHaveProperty('ai.matey.frontend');
    expect(deps).not.toHaveProperty('ai.matey.backend');
  });

  it('ai.matey.types has no internal runtime dependencies', () => {
    const deps = dependenciesOf('ai.matey.types');
    expect(Object.keys(deps).filter((d) => d.startsWith('ai.matey'))).toEqual([]);
  });
});
