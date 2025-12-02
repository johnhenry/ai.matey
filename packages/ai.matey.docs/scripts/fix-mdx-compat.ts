/**
 * Fix MDX compatibility issues in TypeDoc-generated markdown files.
 *
 * This script escapes curly braces and angle brackets that are outside code blocks
 * to prevent MDX from interpreting them as JSX expressions.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GENERATED_DIR = join(process.cwd(), 'docs', 'api', 'generated');

/**
 * Escape curly braces and angle brackets outside code blocks for MDX compatibility.
 */
function fixMdxCompatibility(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let inInlineCode = false;

  for (const line of lines) {
    // Track code block state
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    // If in code block, don't modify
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Process line character by character to handle inline code
    let processedLine = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';

      // Track inline code state (backticks)
      if (char === '`' && prevChar !== '\\') {
        inInlineCode = !inInlineCode;
        processedLine += char;
        continue;
      }

      // If in inline code, don't modify
      if (inInlineCode) {
        processedLine += char;
        continue;
      }

      // Escape problematic characters outside code blocks/inline code
      if (char === '{') {
        processedLine += '\\{';
      } else if (char === '}') {
        processedLine += '\\}';
      } else if (char === '<' && i + 1 < line.length && /[A-Z]/.test(line[i + 1])) {
        // Escape angle brackets that look like JSX tags (e.g., <T>)
        processedLine += '\\<';
      } else if (char === '>' && prevChar !== '\\' && /[A-Z]/.test(prevChar)) {
        processedLine += '\\>';
      } else {
        processedLine += char;
      }
    }

    result.push(processedLine);
  }

  return result.join('\n');
}

/**
 * Recursively process all markdown files in a directory.
 */
async function processDirectory(dirPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      const content = await readFile(fullPath, 'utf-8');
      const fixed = fixMdxCompatibility(content);

      if (content !== fixed) {
        await writeFile(fullPath, fixed, 'utf-8');
        console.log(`✓ Fixed: ${fullPath.replace(GENERATED_DIR, '')}`);
      }
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('Fixing MDX compatibility issues in TypeDoc output...\n');
    await processDirectory(GENERATED_DIR);
    console.log('\n✓ All files processed successfully!');
  } catch (error) {
    console.error('Error processing files:', error);
    process.exit(1);
  }
}

main();
