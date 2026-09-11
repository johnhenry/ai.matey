#!/usr/bin/env node
/**
 * Validate example code for correctness
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

console.log('🔍 Validating example code...\n');

let errorCount = 0;
let fileCount = 0;

function validateExamples(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      validateExamples(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileCount++;
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for JSDoc header
      if (!content.includes('/**')) {
        console.warn(`⚠️  Missing JSDoc header: ${filePath}`);
        errorCount++;
      }

      // Check for imports
      if (!content.includes('import')) {
        console.warn(`⚠️  No imports found: ${filePath}`);
      }

      // Check for main/run function
      if (!content.includes('function main') && !content.includes('async function run')) {
        console.warn(`⚠️  No main/run function: ${filePath}`);
      }
    }
  }
}

try {
  validateExamples(EXAMPLES_DIR);

  if (errorCount === 0) {
    console.log(`✅ All ${fileCount} examples validated successfully!\n`);
  } else {
    console.log(`\n⚠️  Found ${errorCount} issues in ${fileCount} examples\n`);
    // Don't fail build for warnings
  }
} catch (error: unknown) {
  console.error('❌ Error validating examples:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
