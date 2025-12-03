#!/usr/bin/env node
/**
 * Generate API documentation using TypeDoc
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DOCS_DIR = path.join(__dirname, '..');
const API_OUTPUT_DIR = path.join(DOCS_DIR, 'docs', 'api', 'generated');

console.log('📚 Generating API documentation with TypeDoc...\n');

try {
  // Clean previous generated docs
  if (fs.existsSync(API_OUTPUT_DIR)) {
    console.log('🧹 Cleaning previous API docs...');
    fs.rmSync(API_OUTPUT_DIR, { recursive: true, force: true });
  }

  // Run TypeDoc
  console.log('🔨 Running TypeDoc...');
  execSync('npx typedoc', {
    cwd: DOCS_DIR,
    stdio: 'inherit'
  });

  console.log('\n✨ API documentation generation complete!\n');
} catch (error: unknown) {
  console.error('\n❌ Error generating API documentation:');
  console.error(error instanceof Error ? error.message : String(error));
  // Don't exit with error - docs can still build without API docs
  console.log('\n⚠️  Continuing without API docs...\n');
}
