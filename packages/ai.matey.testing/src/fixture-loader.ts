/**
 * Fixture loader - loads fixtures from files
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Fixture, FixtureQuery, FixtureCollection } from './fixture-types.js';
import { isChatFixture, isStreamingFixture } from './fixture-types.js';

/**
 * Default fixtures directory (relative to project root)
 */
export const FIXTURES_DIR = join(process.cwd(), 'fixtures');

/**
 * In-memory fixture cache
 */
const fixtureCache = new Map<string, Fixture>();

/**
 * Load a single fixture from file
 */
export async function loadFixture(
  provider: string,
  scenario: string,
  options?: { useCache?: boolean }
): Promise<Fixture> {
  const cacheKey = `${provider}/${scenario}`;

  // Check cache
  if (options?.useCache !== false) {
    const cached = fixtureCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Load from file
  const fixturePath = join(FIXTURES_DIR, provider, `${scenario}.json`);

  try {
    const content = await readFile(fixturePath, 'utf-8');
    const fixture = JSON.parse(content) as Fixture;

    // Validate fixture structure
    if (!fixture.metadata || !fixture.request) {
      throw new Error(`Invalid fixture format: ${fixturePath}`);
    }

    // Cache and return
    fixtureCache.set(cacheKey, fixture);
    return fixture;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Fixture not found: ${provider}/${scenario}`);
    }
    throw error;
  }
}

/**
 * Load all fixtures for a provider
 */
export async function loadProviderFixtures(
  provider: string,
  options?: { useCache?: boolean }
): Promise<Fixture[]> {
  try {
    const { readdir } = await import('fs/promises');
    const providerDir = join(FIXTURES_DIR, provider);
    const files = await readdir(providerDir);

    const fixtures = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const scenario = file.replace('.json', '');
          return loadFixture(provider, scenario, options);
        })
    );

    return fixtures;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // Provider directory doesn't exist
    }
    throw error;
  }
}

/**
 * Search fixtures by query
 */
export async function findFixtures(query: FixtureQuery): Promise<Fixture[]> {
  const { readdir, stat } = await import('fs/promises');

  // Get list of providers
  let providers: string[];
  if (query.provider) {
    providers = [query.provider];
  } else {
    try {
      const entries = await readdir(FIXTURES_DIR);
      // Filter out non-directories (like README.md)
      const providerChecks = await Promise.all(
        entries.map(async (entry) => {
          try {
            const stats = await stat(join(FIXTURES_DIR, entry));
            return stats.isDirectory() ? entry : null;
          } catch {
            return null;
          }
        })
      );
      providers = providerChecks.filter((p): p is string => p !== null);
    } catch {
      return [];
    }
  }

  // Load all fixtures from matching providers
  const allFixtures = await Promise.all(
    providers.map((provider) => loadProviderFixtures(provider))
  );

  const fixtures = allFixtures.flat();

  // Filter by query
  return fixtures.filter((fixture) => {
    if (query.scenario && fixture.metadata.scenario !== query.scenario) {
      return false;
    }

    if (query.model && fixture.metadata.model !== query.model) {
      return false;
    }

    if (query.tags && query.tags.length > 0) {
      const fixtureTags = fixture.metadata.tags || [];
      if (!query.tags.some((tag) => fixtureTags.includes(tag))) {
        return false;
      }
    }

    if (query.streaming !== undefined) {
      if (query.streaming && !isStreamingFixture(fixture)) {
        return false;
      }
      if (!query.streaming && !isChatFixture(fixture)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Clear fixture cache
 */
export function clearFixtureCache(): void {
  fixtureCache.clear();
}

/**
 * Get cache statistics
 */
export function getFixtureCacheStats(): { size: number; keys: string[] } {
  return {
    size: fixtureCache.size,
    keys: Array.from(fixtureCache.keys()),
  };
}

/**
 * Load a fixture collection (multiple fixtures in one file)
 */
export async function loadFixtureCollection(
  provider: string,
  collectionName: string
): Promise<FixtureCollection> {
  const collectionPath = join(FIXTURES_DIR, provider, 'collections', `${collectionName}.json`);

  const content = await readFile(collectionPath, 'utf-8');
  const collection = JSON.parse(content) as FixtureCollection;

  if (!collection.fixtures || !Array.isArray(collection.fixtures)) {
    throw new Error(`Invalid fixture collection format: ${collectionPath}`);
  }

  return collection;
}
