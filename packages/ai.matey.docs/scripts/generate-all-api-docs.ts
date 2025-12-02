#!/usr/bin/env tsx
/**
 * Generate comprehensive API documentation for all ai.matey packages
 * using TypeDoc with the markdown plugin.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const packagesRoot = join(docsRoot, '..');
const apiOutputDir = join(docsRoot, 'docs', 'api', 'generated');

// List of all packages to document
const packages = [
  'ai.matey',
  'ai.matey.core',
  'ai.matey.types',
  'ai.matey.errors',
  'ai.matey.utils',
  'ai.matey.testing',
  'backend',
  'frontend',
  'middleware',
  'http',
  'http.core',
  'wrapper',
  'cli',
  'react-core',
  'react-hooks',
  'react-stream',
  'react-nextjs',
  'native-apple',
  'native-node-llamacpp',
  'native-model-runner',
  'backend-browser',
];

interface PackageInfo {
  name: string;
  path: string;
  hasSource: boolean;
  description?: string;
}

/**
 * Check which packages have source files
 */
function discoverPackages(): PackageInfo[] {
  const discovered: PackageInfo[] = [];

  for (const pkg of packages) {
    const pkgPath = join(packagesRoot, pkg);
    const srcPath = join(pkgPath, 'src');
    const indexPath = join(srcPath, 'index.ts');

    if (existsSync(indexPath)) {
      // Read package.json for description
      let description = '';
      const packageJsonPath = join(pkgPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf-8'));
          description = packageJson.description || '';
        } catch (e) {
          // Ignore
        }
      }

      discovered.push({
        name: pkg,
        path: pkgPath,
        hasSource: true,
        description,
      });
    }
  }

  return discovered;
}

/**
 * Generate TypeDoc documentation
 */
function generateTypeDocs() {
  console.log('🔨 Generating API documentation with TypeDoc...\n');

  try {
    // Run TypeDoc
    execSync('npx typedoc --options typedoc-all.json', {
      cwd: docsRoot,
      stdio: 'inherit',
    });

    console.log('\n✅ TypeDoc generation complete!');
  } catch (error) {
    console.error('❌ TypeDoc generation failed:', error);
    // Don't fail the build, just warn
    console.warn('⚠️  Continuing without generated API docs...');
  }
}

interface ExportInfo {
  values: string[];
  types: string[];
}

/**
 * Extract export names from a TypeScript file recursively
 */
function extractExportsFromFile(filePath: string, visited = new Set<string>()): ExportInfo {
  if (!existsSync(filePath) || visited.has(filePath)) return { values: [], types: [] };
  visited.add(filePath);

  try {
    const content = require('fs').readFileSync(filePath, 'utf-8');
    const values: string[] = [];
    const types: string[] = [];
    const fileDir = dirname(filePath);

    // Match: export * from './file' - need to recursively extract from those files
    const reExportAllMatches = content.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of reExportAllMatches) {
      let importPath = match[1];
      // Handle .js extensions by converting to .ts
      if (importPath.endsWith('.js')) {
        importPath = importPath.replace(/\.js$/, '.ts');
      } else if (!importPath.endsWith('.ts')) {
        importPath += '.ts';
      }
      const fullPath = join(fileDir, importPath);
      const subExports = extractExportsFromFile(fullPath, visited);
      values.push(...subExports.values);
      types.push(...subExports.types);
    }

    // Match: export type { name1, name2 }
    const typeExportMatches = content.matchAll(/export\s+type\s*{\s*([^}]+)\s*}(?:\s+from)?/g);
    for (const match of typeExportMatches) {
      const names = match[1].split(',').map(n => {
        const cleaned = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
        return cleaned;
      });
      types.push(...names);
    }

    // Match: export { name1, type name2 } from './file'
    const namedExportMatches = content.matchAll(/export\s+{\s*([^}]+)\s*}(?:\s+from)?/g);
    for (const match of namedExportMatches) {
      // Skip if this was already matched as a type export
      if (match[0].includes('export type {')) continue;

      const names = match[1].split(',');
      for (const name of names) {
        const trimmed = name.trim();
        if (trimmed.startsWith('type ')) {
          // Individual type export: export { type Foo }
          const cleaned = trimmed.replace(/^type\s+/, '').split(/\s+as\s+/)[0];
          types.push(cleaned);
        } else {
          // Value export
          const cleaned = trimmed.split(/\s+as\s+/)[0];
          values.push(cleaned);
        }
      }
    }

    // Match: export interface/type/enum name
    const typeDefMatches = content.matchAll(/export\s+(?:interface|type|enum)\s+(\w+)/g);
    for (const match of typeDefMatches) {
      types.push(match[1]);
    }

    // Match: export const/function/class name
    const valueDefMatches = content.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g);
    for (const match of valueDefMatches) {
      values.push(match[1]);
    }

    // Match: export default
    if (content.includes('export default')) {
      values.push('default');
    }

    // Remove duplicates and filter out empty strings
    return {
      values: [...new Set(values)].filter(e => e.length > 0),
      types: [...new Set(types)].filter(e => e.length > 0),
    };
  } catch (e) {
    return { values: [], types: [] };
  }
}

/**
 * Extract export names from a package's index.ts file
 */
function extractExports(pkgPath: string): ExportInfo {
  const indexPath = join(pkgPath, 'src', 'index.ts');
  return extractExportsFromFile(indexPath);
}

/**
 * Generate index pages for each package
 */
function generatePackageIndexes(packages: PackageInfo[]) {
  console.log('\n📝 Generating package index pages...\n');

  for (const pkg of packages) {
    const exports = extractExports(pkg.path);

    // Format exports list
    let exportsSection = '';
    const totalExports = exports.values.length + exports.types.length;

    if (totalExports > 0) {
      let exportsList = '';

      if (exports.values.length > 0) {
        exportsList += '### Values\n\n';
        exportsList += exports.values.map(e => `- \`${e}\``).join('\n');
        exportsList += '\n\n';
      }

      if (exports.types.length > 0) {
        exportsList += '### Types\n\n';
        exportsList += exports.types.map(e => `- \`${e}\``).join('\n');
        exportsList += '\n\n';
      }

      const allExports = [...exports.values, ...exports.types];
      exportsSection = `
## Exports

${exportsList}

## Usage

\`\`\`typescript
import {
  ${allExports.join(',\n  ')}
} from '${pkg.name}';
\`\`\`
`;
    }

    const indexContent = `---
sidebar_position: ${packages.indexOf(pkg) + 1}
---

# ${pkg.name}

${pkg.description || `API documentation for ${pkg.name}`}

## Overview

This package is part of the ai.matey ecosystem.
${exportsSection}
## Source Code

View the complete source code and implementation details:

- [Package Source Code](https://github.com/johnhenry/ai.matey/tree/main/packages/${pkg.name})
- [View on GitHub](https://github.com/johnhenry/ai.matey/tree/main/packages/${pkg.name}/src)

## Quick Links

- [Examples](https://github.com/johnhenry/ai.matey/tree/main/packages/ai.matey.docs/examples)
- [Main Documentation](/getting-started/installation)
- [All Packages](/api/all-packages)

See the [package source](https://github.com/johnhenry/ai.matey/tree/main/packages/${pkg.name}) for complete API documentation and examples.
`;

    const outputPath = join(docsRoot, 'docs', 'api', 'packages', `${pkg.name}.md`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, indexContent);
    console.log(`  ✓ ${pkg.name}.md`);
  }

  console.log(`\n✅ Generated ${packages.length} package index pages`);
}

/**
 * Generate main packages overview page
 */
function generatePackagesOverview(packages: PackageInfo[]) {
  console.log('\n📝 Generating packages overview...\n');

  const categories = {
    Core: ['ai.matey', 'ai.matey.core', 'ai.matey.types', 'ai.matey.errors', 'ai.matey.utils', 'ai.matey.testing'],
    Adapters: ['backend', 'frontend', 'backend-browser'],
    Middleware: ['middleware'],
    HTTP: ['http', 'http.core'],
    React: ['react-core', 'react-hooks', 'react-stream', 'react-nextjs'],
    Native: ['native-apple', 'native-node-llamacpp', 'native-model-runner'],
    Utilities: ['wrapper', 'cli'],
  };

  let content = `---
sidebar_position: 1
---

# All Packages

Complete reference for all ${packages.length} ai.matey packages.

`;

  for (const [category, pkgNames] of Object.entries(categories)) {
    const categoryPackages = packages.filter(p => pkgNames.includes(p.name));
    if (categoryPackages.length === 0) continue;

    content += `\n## ${category}\n\n`;

    for (const pkg of categoryPackages) {
      content += `### [${pkg.name}](./packages/${pkg.name})\n\n`;
      if (pkg.description) {
        content += `${pkg.description}\n\n`;
      }
      content += `[View API →](./packages/${pkg.name})\n\n---\n\n`;
    }
  }

  content += `\n## See Also\n\n`;
  content += `- [Bridge API](/api/bridge)\n`;
  content += `- [Router API](/api/router)\n`;
  content += `- [Middleware API](/api/middleware)\n`;
  content += `- [Types API](/api/types)\n`;
  content += `- [Errors API](/api/errors)\n`;

  const outputPath = join(docsRoot, 'docs', 'api', 'all-packages.md');
  writeFileSync(outputPath, content);
  console.log('  ✓ all-packages.md');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 AI Matey API Documentation Generator\n');
  console.log('='.repeat(50));

  // Discover packages
  const discoveredPackages = discoverPackages();
  console.log(`\n📦 Discovered ${discoveredPackages.length} packages with source code:\n`);
  discoveredPackages.forEach(pkg => {
    console.log(`  - ${pkg.name}`);
  });

  // Generate TypeDoc documentation
  console.log('\n' + '='.repeat(50));
  generateTypeDocs();

  // Generate package indexes
  console.log('\n' + '='.repeat(50));
  generatePackageIndexes(discoveredPackages);

  // Generate packages overview
  console.log('\n' + '='.repeat(50));
  generatePackagesOverview(discoveredPackages);

  console.log('\n' + '='.repeat(50));
  console.log('\n✨ API documentation generation complete!\n');
  console.log(`📂 Output directory: ${apiOutputDir}`);
  console.log(`📄 ${discoveredPackages.length} packages documented`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
