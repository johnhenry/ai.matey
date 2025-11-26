#!/usr/bin/env node

/**
 * Fix package.json files to add missing homepage and bugs fields,
 * and fix peerDependenciesMeta where needed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.join(__dirname, '..', 'packages');

// Main
async function main() {
  const packages = fs.readdirSync(packagesDir).filter(f =>
    fs.statSync(path.join(packagesDir, f)).isDirectory()
  );

  let fixed = 0;

  for (const pkg of packages) {
    const pkgDir = path.join(packagesDir, pkg);
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
      continue;
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    let changed = false;

    // Add homepage if missing
    if (!pkgJson.homepage) {
      pkgJson.homepage = 'https://github.com/johnhenry/ai.matey#readme';
      changed = true;
    }

    // Add bugs if missing
    if (!pkgJson.bugs) {
      pkgJson.bugs = {
        url: 'https://github.com/johnhenry/ai.matey/issues'
      };
      changed = true;
    }

    // Fix peerDependenciesMeta if peerDependencies exist but meta doesn't
    if (pkgJson.peerDependencies && Object.keys(pkgJson.peerDependencies).length > 0) {
      if (!pkgJson.peerDependenciesMeta || Object.keys(pkgJson.peerDependenciesMeta).length === 0) {
        pkgJson.peerDependenciesMeta = {};
        for (const dep of Object.keys(pkgJson.peerDependencies)) {
          pkgJson.peerDependenciesMeta[dep] = { optional: false };
        }
        changed = true;
        console.log(`Fixed peerDependenciesMeta for ${pkg}`);
      }
    }

    if (changed) {
      // Preserve key order by reordering the object
      const orderedKeys = [
        'name', 'version', 'description', 'type', 'main', 'module', 'types',
        'exports', 'bin', 'files', 'scripts', 'dependencies', 'peerDependencies',
        'peerDependenciesMeta', 'devDependencies', 'keywords', 'author', 'license',
        'homepage', 'bugs', 'repository', 'engines'
      ];

      const ordered = {};
      for (const key of orderedKeys) {
        if (key in pkgJson) {
          ordered[key] = pkgJson[key];
        }
      }
      // Add any remaining keys
      for (const key of Object.keys(pkgJson)) {
        if (!(key in ordered)) {
          ordered[key] = pkgJson[key];
        }
      }

      fs.writeFileSync(pkgJsonPath, JSON.stringify(ordered, null, 2) + '\n');
      fixed++;
      console.log(`Fixed: ${pkg}/package.json`);
    }
  }

  console.log(`\nDone: ${fixed} package.json files fixed`);
}

main().catch(console.error);
