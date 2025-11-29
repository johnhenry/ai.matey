#!/usr/bin/env node
/**
 * CLI Tool for Converting IR Responses
 *
 * Convert Universal IR responses to various frontend formats for debugging.
 *
 * Usage:
 *   npx ai-matey convert-response --format openai --input response.json
 *   npx ai-matey convert-response --format all --input response.json
 *   cat response.json | npx ai-matey convert-response --format anthropic
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { stdin } from 'node:process';
import type { IRChatResponse } from 'ai.matey.types';
import {
  toOpenAI,
  toAnthropic,
  toGemini,
  toOllama,
  toMistral,
  toMultipleFormats,
} from './converters/response-converters.js';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIArgs {
  format: string;
  input?: string;
  output?: string;
  pretty?: boolean;
  help?: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  const parsed: CLIArgs = {
    format: 'openai',
    pretty: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--format':
      case '-f':
        parsed.format = args[++i] || 'openai';
        break;
      case '--input':
      case '-i':
        parsed.input = args[++i];
        break;
      case '--output':
      case '-o':
        parsed.output = args[++i];
        break;
      case '--no-pretty':
        parsed.pretty = false;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
    }
  }

  return parsed;
}

// ============================================================================
// Help Text
// ============================================================================

const SUPPORTED_FORMATS = ['openai', 'anthropic', 'gemini', 'ollama', 'mistral'];

function printHelp(): void {
  console.log(`
AI.Matey Response Converter
Convert Universal IR responses to various frontend formats

USAGE:
  npx ai-matey convert-response [OPTIONS]

OPTIONS:
  -f, --format <format>    Target format (${SUPPORTED_FORMATS.join(', ')}, or 'all')
  -i, --input <file>       Input file (JSON). If omitted, reads from stdin
  -o, --output <file>      Output file. If omitted, writes to stdout
  --no-pretty              Disable pretty-printing
  -h, --help               Show this help message

FORMATS:
  ${SUPPORTED_FORMATS.map((f: string) => `  ${f.padEnd(12)} - ${f.charAt(0).toUpperCase() + f.slice(1)} format`).join('\n  ')}
  all          - Convert to all formats (for debugging)

EXAMPLES:
  # Convert from file
  npx ai-matey convert-response --format openai --input response.json

  # Convert from stdin
  cat response.json | npx ai-matey convert-response --format anthropic

  # Save to file
  npx ai-matey convert-response -f gemini -i response.json -o gemini-format.json

  # Convert to all formats for debugging
  npx ai-matey convert-response -f all -i response.json

  # Compact output (no pretty-printing)
  npx ai-matey convert-response -f openai -i response.json --no-pretty
`);
}

// ============================================================================
// Input/Output Functions
// ============================================================================

async function readInput(inputFile?: string): Promise<IRChatResponse> {
  let content: string;

  if (inputFile) {
    // Read from file
    content = await readFile(inputFile, 'utf-8');
  } else {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) {
      chunks.push(chunk);
    }
    content = Buffer.concat(chunks).toString('utf-8');
  }

  try {
    return JSON.parse(content) as IRChatResponse;
  } catch (error) {
    throw new Error(
      `Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function formatOutput(data: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  try {
    // Read input
    const irResponse = await readInput(args.input);

    // Convert to target format(s)
    let result: unknown;

    if (args.format === 'all') {
      // Convert to all formats
      result = await toMultipleFormats(irResponse, SUPPORTED_FORMATS as any);
    } else {
      // Convert to specific format
      switch (args.format) {
        case 'openai':
          result = await toOpenAI(irResponse);
          break;
        case 'anthropic':
          result = await toAnthropic(irResponse);
          break;
        case 'gemini':
          result = await toGemini(irResponse);
          break;
        case 'ollama':
          result = await toOllama(irResponse);
          break;
        case 'mistral':
          result = await toMistral(irResponse);
          break;
        default:
          throw new Error(
            `Unsupported format: ${args.format}. Use --help to see available formats.`
          );
      }
    }

    // Format and output
    const output = formatOutput(result, args.pretty ?? true);

    if (args.output) {
      // Write to file
      const { writeFile } = await import('node:fs/promises');
      await writeFile(args.output, output, 'utf-8');
      console.error(`✓ Converted to ${args.format} format: ${args.output}`);
    } else {
      // Write to stdout
      console.log(output);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('\nRun with --help for usage information');
    process.exit(1);
  }
}

// Export for use as module or subcommand
export { main };
