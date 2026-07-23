#!/usr/bin/env node

/**
 * Write a `dist/cjs/package.json` marker ({"type":"commonjs"}) into every
 * workspace package's CJS build output.
 *
 * Every package's own package.json declares "type": "module" (so ESM
 * subpath imports resolve correctly), but each also ships a dist/cjs/ build
 * compiled to CommonJS for the `require` export condition. Without a nested
 * dist/cjs/package.json overriding the type, Node walks up to the nearest
 * package.json, finds "type": "module", and treats the compiled CJS files
 * as ES modules - so `require("ai.matey.x")` fails with
 * "Cannot find module './y.js'" (the compiled `require("./y.js")` call is
 * interpreted as an ESM import, which resolves differently). See #23.
 *
 * Safe to run repeatedly; run after `turbo run build`/`build:cjs`.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.join(__dirname, '..', 'packages');

function main() {
  const packages = fs
    .readdirSync(packagesDir)
    .filter((entry) => fs.statSync(path.join(packagesDir, entry)).isDirectory());

  let written = 0;

  for (const pkg of packages) {
    const cjsDir = path.join(packagesDir, pkg, 'dist', 'cjs');
    if (!fs.existsSync(cjsDir)) {
      continue;
    }

    const markerPath = path.join(cjsDir, 'package.json');
    fs.writeFileSync(markerPath, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
    written++;
  }

  console.log(`Wrote dist/cjs/package.json marker to ${written} package(s).`);
}

main();
