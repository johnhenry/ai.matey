#!/usr/bin/env node
/**
 * CLI Tool for Converting Requests
 *
 * Convert between Universal IR requests and various provider formats.
 *
 * Usage:
 *   ai-matey convert-request --from openai --to ir --input request.json
 *   ai-matey convert-request --from ir --to anthropic --input request.json
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { stdin } from 'node:process';
import type { IRChatRequest } from 'ai.matey.types';
import {
  toOpenAIRequest,
  toAnthropicRequest,
  toGeminiRequest,
  toOllamaRequest,
  toMistralRequest,
  toMultipleRequestFormats,
} from './converters/request-converters.js';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIArgs {
  from: string;
  to: string;
  input?: string;
  output?: string;
  pretty?: boolean;
  help?: boolean;
}

function parseArgs(args: string[]): CLIArgs {
  const parsed: CLIArgs = {
    from: 'ir',
    to: 'openai',
    pretty: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--from':
      case '-f':
        parsed.from = args[++i] || 'ir';
        break;
      case '--to':
      case '-t':
        parsed.to = args[++i] || 'openai';
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

const SUPPORTED_FORMATS = ['ir', 'openai', 'anthropic', 'gemini', 'ollama', 'mistral'];

function printHelp(): void {
  console.log(`
AI.Matey Request Converter
Convert between Universal IR requests and provider formats

USAGE:
  ai-matey convert-request [OPTIONS]

OPTIONS:
  -f, --from <format>      Source format (${SUPPORTED_FORMATS.join(', ')}, or 'all')
  -t, --to <format>        Target format (${SUPPORTED_FORMATS.join(', ')}, or 'all')
  -i, --input <file>       Input file (JSON). If omitted, reads from stdin
  -o, --output <file>      Output file. If omitted, writes to stdout
  --no-pretty              Disable pretty-printing
  -h, --help               Show this help message

FORMATS:
  ir           - Universal Intermediate Representation
  ${SUPPORTED_FORMATS.filter((f) => f !== 'ir')
    .map((f: string) => `  ${f.padEnd(12)} - ${f.charAt(0).toUpperCase() + f.slice(1)} format`)
    .join('\n  ')}
  all          - Convert to all formats (for debugging)

EXAMPLES:
  # Convert IR to OpenAI format
  ai-matey convert-request --from ir --to openai --input ir-request.json

  # Convert OpenAI to IR (useful for migration)
  ai-matey convert-request --from openai --to ir --input openai-request.json

  # Convert from stdin
  cat request.json | ai-matey convert-request --from ir --to anthropic

  # Save to file
  ai-matey convert-request -f ir -t gemini -i request.json -o gemini-request.json

  # Convert IR to all formats for comparison
  ai-matey convert-request -f ir -t all -i request.json
`);
}

// ============================================================================
// Input/Output Functions
// ============================================================================

async function readInput(inputFile?: string): Promise<unknown> {
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
    return JSON.parse(content);
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
// Conversion Functions
// ============================================================================

/**
 * Convert from provider format to IR.
 * This is a basic implementation that handles common cases.
 */
function toIRRequest(data: any, sourceFormat: string): IRChatRequest {
  // For now, we'll do basic conversion
  // This can be enhanced with proper type-safe converters later

  switch (sourceFormat) {
    case 'openai':
      return {
        messages: data.messages || [],
        parameters: {
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.max_tokens,
          topP: data.top_p,
          frequencyPenalty: data.frequency_penalty,
          presencePenalty: data.presence_penalty,
          stopSequences: Array.isArray(data.stop) ? data.stop : data.stop ? [data.stop] : undefined,
        },
        stream: data.stream,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: 'openai' },
        },
      };

    case 'anthropic':
      return {
        messages: data.messages || [],
        parameters: {
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.max_tokens,
          topP: data.top_p,
          topK: data.top_k,
          stopSequences: data.stop_sequences,
        },
        stream: data.stream,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: 'anthropic' },
        },
      };

    case 'gemini':
      // Gemini has different structure - contents instead of messages
      const messages = (data.contents || []).map((content: any) => ({
        role: content.role === 'model' ? 'assistant' : content.role,
        content: content.parts?.map((p: any) => p.text).join('') || '',
      }));

      return {
        messages,
        parameters: {
          model: data.model,
          temperature: data.generationConfig?.temperature,
          maxTokens: data.generationConfig?.maxOutputTokens,
          topP: data.generationConfig?.topP,
          topK: data.generationConfig?.topK,
          stopSequences: data.generationConfig?.stopSequences,
        },
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: 'gemini' },
        },
      };

    case 'ollama':
      return {
        messages: data.messages || [],
        parameters: {
          model: data.model,
          temperature: data.options?.temperature,
          topP: data.options?.top_p,
          topK: data.options?.top_k,
        },
        stream: data.stream,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: 'ollama' },
        },
      };

    case 'mistral':
      return {
        messages: data.messages || [],
        parameters: {
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.max_tokens,
          topP: data.top_p,
        },
        stream: data.stream,
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: 'mistral' },
        },
      };

    default:
      throw new Error(`Unsupported source format: ${sourceFormat}`);
  }
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
    const input = await readInput(args.input);

    // Convert
    let result: unknown;

    if (args.from === 'ir') {
      // Convert FROM IR TO provider format
      const irRequest = input as IRChatRequest;

      if (args.to === 'all') {
        // Convert to all formats
        result = toMultipleRequestFormats(irRequest, [
          'openai',
          'anthropic',
          'gemini',
          'ollama',
          'mistral',
        ]);
      } else {
        // Convert to specific format
        switch (args.to) {
          case 'ir':
            result = irRequest; // No conversion needed
            break;
          case 'openai':
            result = toOpenAIRequest(irRequest);
            break;
          case 'anthropic':
            result = toAnthropicRequest(irRequest);
            break;
          case 'gemini':
            result = toGeminiRequest(irRequest);
            break;
          case 'ollama':
            result = toOllamaRequest(irRequest);
            break;
          case 'mistral':
            result = toMistralRequest(irRequest);
            break;
          default:
            throw new Error(
              `Unsupported target format: ${args.to}. Use --help to see available formats.`
            );
        }
      }
    } else if (args.to === 'ir') {
      // Convert FROM provider format TO IR
      result = toIRRequest(input, args.from);
    } else {
      // Convert FROM provider TO provider (via IR)
      const irRequest = toIRRequest(input, args.from);

      switch (args.to) {
        case 'openai':
          result = toOpenAIRequest(irRequest);
          break;
        case 'anthropic':
          result = toAnthropicRequest(irRequest);
          break;
        case 'gemini':
          result = toGeminiRequest(irRequest);
          break;
        case 'ollama':
          result = toOllamaRequest(irRequest);
          break;
        case 'mistral':
          result = toMistralRequest(irRequest);
          break;
        default:
          throw new Error(`Unsupported target format: ${args.to}`);
      }
    }

    // Format and output
    const output = formatOutput(result, args.pretty ?? true);

    if (args.output) {
      // Write to file
      const { writeFile } = await import('node:fs/promises');
      await writeFile(args.output, output, 'utf-8');
      console.error(`✓ Converted from ${args.from} to ${args.to}: ${args.output}`);
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
