#!/usr/bin/env node
/**
 * Validate Examples Import Script
 *
 * Quick syntax and import check for all examples.
 */

import { readdir } from 'fs/promises';
import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const EXAMPLES_DIR = join(ROOT_DIR, 'examples');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Known valid import paths from package.json exports
const VALID_IMPORTS = [
  'ai.matey',
  'ai.matey/types',
  'ai.matey/errors',
  'ai.matey/utils',
  'ai.matey/http',
  'ai.matey/http/node',
  'ai.matey/http/express',
  'ai.matey/http/fastify',
  'ai.matey/http/hono',
  'ai.matey/http/koa',
  'ai.matey/http/deno',
  'ai.matey/middleware',
  'ai.matey/adapters/frontend',
  'ai.matey/adapters/backend',
  'ai.matey/adapters/backend-native',
  'ai.matey/adapters/backend-native/model-runners',
  'ai.matey/wrappers',
  'ai.matey/cli',
  'ai.matey/cli/ollama',
];

async function findExampleFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await findExampleFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      if (!entry.name.includes('README')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function validateFile(filePath) {
  const relativePath = relative(ROOT_DIR, filePath);
  const content = await readFile(filePath, 'utf-8');
  const errors = [];

  // Check for import statements
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Check if it's an ai.matey import
    if (importPath.startsWith('ai.matey')) {
      // Check if it's valid
      const isValid = VALID_IMPORTS.some(valid => importPath === valid || importPath.startsWith(valid + '/'));

      if (!isValid) {
        errors.push({
          type: 'INVALID_IMPORT',
          message: `Invalid import path: '${importPath}'`,
          line: content.substring(0, match.index).split('\n').length
        });
      }
    }
  }

  // Check for basic syntax issues (super simple check)
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check for common typos
    if (line.includes('ai.matey/wrappers/openai-sdk') || line.includes('ai.matey/wrappers/anthropic-sdk')) {
      errors.push({
        type: 'DEPRECATED_IMPORT',
        message: `Use 'ai.matey/wrappers' instead of subpath`,
        line: idx + 1
      });
    }
  });

  return {
    path: relativePath,
    errors,
    success: errors.length === 0
  };
}

async function main() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║           AI.Matey Examples Import Validation                 ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Check if dist exists
  try {
    await readdir(join(ROOT_DIR, 'dist'));
  } catch {
    console.log(`${colors.red}✗ dist/ directory not found${colors.reset}`);
    console.log(`${colors.yellow}⚠ Please run: npm run build${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.gray}Scanning examples directory...${colors.reset}`);
  const exampleFiles = await findExampleFiles(EXAMPLES_DIR);
  console.log(`${colors.gray}Found ${exampleFiles.length} example files\n${colors.reset}`);

  const results = [];

  for (const filePath of exampleFiles) {
    const result = await validateFile(filePath);
    results.push(result);

    if (result.success) {
      console.log(`${colors.green}✓${colors.reset} ${result.path}`);
    } else {
      console.log(`${colors.red}✗${colors.reset} ${result.path}`);
      result.errors.forEach(err => {
        console.log(`  ${colors.red}Line ${err.line}: ${err.type}${colors.reset}`);
        console.log(`  ${colors.gray}${err.message}${colors.reset}`);
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(`  ${colors.green}✓ Passed: ${successful}${colors.reset}`);
  console.log(`  ${colors.red}✗ Failed: ${failed}${colors.reset}`);
  console.log(`  ${colors.gray}Total:   ${results.length}${colors.reset}`);

  if (failed > 0) {
    console.log(`\n${colors.yellow}⚠ Some examples have import issues${colors.reset}`);
    console.log(`${colors.gray}Run with detailed errors above for fixes${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✓ All examples validated successfully!${colors.reset}`);
    console.log(`${colors.gray}Note: This validates import paths only. Run examples with API keys to fully test.${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(error => {
  console.error(`${colors.red}Validation failed:${colors.reset}`, error);
  process.exit(1);
});
