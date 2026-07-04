/**
 * Tool-Calling Utilities
 *
 * Helpers for working with tool calls in IR responses: extraction, result
 * construction, zero-dependency argument validation against the IR
 * JSONSchema subset, and streamed tool-call assembly.
 *
 * @module
 */

import type {
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRTool,
  JSONSchema,
  ToolUseContent,
} from 'ai.matey.types';

// ============================================================================
// Extraction
// ============================================================================

/**
 * Extract tool calls from an IR message or response.
 */
export function extractToolCalls(source: IRMessage | IRChatResponse): ToolUseContent[] {
  const message = 'message' in source ? source.message : source;
  if (typeof message.content === 'string') {
    return [];
  }
  return message.content.filter((block): block is ToolUseContent => block.type === 'tool_use');
}

/**
 * Whether a response requests tool execution.
 */
export function hasToolCalls(response: IRChatResponse): boolean {
  return response.finishReason === 'tool_calls' || extractToolCalls(response).length > 0;
}

// ============================================================================
// Result Construction
// ============================================================================

/**
 * A tool execution result to feed back to the model.
 */
export interface ToolCallResult {
  readonly toolCallId: string;
  readonly result: unknown;
  readonly isError?: boolean;
}

/**
 * Build the `role: 'tool'` message carrying tool results back to the model.
 *
 * Non-string results are JSON-stringified.
 */
export function createToolResultMessage(
  results: ToolCallResult | readonly ToolCallResult[]
): IRMessage {
  const list = Array.isArray(results) ? results : [results as ToolCallResult];
  return {
    role: 'tool',
    content: list.map((result) => ({
      type: 'tool_result' as const,
      toolUseId: result.toolCallId,
      content:
        typeof result.result === 'string' ? result.result : JSON.stringify(result.result ?? null),
      isError: result.isError,
    })),
  };
}

// ============================================================================
// Argument Validation
// ============================================================================

/**
 * A single validation failure.
 */
export interface ToolArgValidationError {
  readonly path: string;
  readonly message: string;
}

/**
 * Validation outcome for tool arguments.
 */
export type ToolArgValidationResult =
  | { readonly valid: true; readonly value: Record<string, unknown> }
  | { readonly valid: false; readonly errors: readonly ToolArgValidationError[] };

/**
 * Validate tool-call arguments against the tool's JSON Schema.
 *
 * Zero-dependency validator for the IR `JSONSchema` subset (type, enum,
 * const, properties, required, items, min/max, pattern, length bounds) —
 * deliberately not a full draft-2020 implementation. Use Zod via
 * `generateObject` when full-fidelity validation matters.
 */
export function validateToolArgs(tool: IRTool, input: unknown): ToolArgValidationResult {
  const errors: ToolArgValidationError[] = [];
  validateAgainstSchema(input, tool.parameters, '$', errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    value:
      input !== null && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {},
  };
}

function validateAgainstSchema(
  value: unknown,
  schema: JSONSchema,
  path: string,
  errors: ToolArgValidationError[]
): void {
  const s = schema as Record<string, unknown>;

  // const / enum
  if ('const' in s && value !== s.const) {
    errors.push({ path, message: `expected constant ${JSON.stringify(s.const)}` });
    return;
  }
  if (Array.isArray(s.enum) && !s.enum.some((candidate) => deepEqual(candidate, value))) {
    errors.push({ path, message: `expected one of ${JSON.stringify(s.enum)}` });
    return;
  }

  const type = s.type as string | undefined;
  switch (type) {
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ path, message: 'expected object' });
        return;
      }
      const record = value as Record<string, unknown>;
      const properties = (s.properties ?? {}) as Record<string, JSONSchema>;
      const required = (s.required ?? []) as string[];

      for (const key of required) {
        if (!(key in record)) {
          errors.push({ path: `${path}.${key}`, message: 'required property missing' });
        }
      }
      for (const [key, propertySchema] of Object.entries(properties)) {
        if (key in record) {
          validateAgainstSchema(record[key], propertySchema, `${path}.${key}`, errors);
        }
      }
      if (s.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in properties)) {
            errors.push({ path: `${path}.${key}`, message: 'unexpected property' });
          }
        }
      }
      break;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        errors.push({ path, message: 'expected array' });
        return;
      }
      if (typeof s.minItems === 'number' && value.length < s.minItems) {
        errors.push({ path, message: `expected at least ${s.minItems} items` });
      }
      if (typeof s.maxItems === 'number' && value.length > s.maxItems) {
        errors.push({ path, message: `expected at most ${s.maxItems} items` });
      }
      if (s.items) {
        value.forEach((item, index) =>
          validateAgainstSchema(item, s.items as JSONSchema, `${path}[${index}]`, errors)
        );
      }
      break;
    }

    case 'string': {
      if (typeof value !== 'string') {
        errors.push({ path, message: 'expected string' });
        return;
      }
      if (typeof s.minLength === 'number' && value.length < s.minLength) {
        errors.push({ path, message: `expected length >= ${s.minLength}` });
      }
      if (typeof s.maxLength === 'number' && value.length > s.maxLength) {
        errors.push({ path, message: `expected length <= ${s.maxLength}` });
      }
      if (typeof s.pattern === 'string' && !new RegExp(s.pattern).test(value)) {
        errors.push({ path, message: `expected match for /${s.pattern}/` });
      }
      break;
    }

    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push({ path, message: `expected ${type}` });
        return;
      }
      if (type === 'integer' && !Number.isInteger(value)) {
        errors.push({ path, message: 'expected integer' });
      }
      if (typeof s.minimum === 'number' && value < s.minimum) {
        errors.push({ path, message: `expected >= ${s.minimum}` });
      }
      if (typeof s.maximum === 'number' && value > s.maximum) {
        errors.push({ path, message: `expected <= ${s.maximum}` });
      }
      break;
    }

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({ path, message: 'expected boolean' });
      }
      break;

    case 'null':
      if (value !== null) {
        errors.push({ path, message: 'expected null' });
      }
      break;

    default:
      // No/unknown type constraint: accept
      break;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// Stream Assembly
// ============================================================================

/**
 * Consume an IR stream and assemble its tool calls and final response.
 *
 * Convenience for callers that stream for latency but want complete tool
 * calls at the end: collects `tool_use` deltas and returns the `done`
 * chunk's assembled message/finish reason.
 */
export async function collectToolCallsFromStream(stream: IRChatStream): Promise<{
  toolCalls: ToolUseContent[];
  response: IRChatResponse | null;
}> {
  let response: IRChatResponse | null = null;

  for await (const chunk of stream) {
    if (chunk.type === 'done') {
      response = {
        message: chunk.message ?? { role: 'assistant', content: '' },
        finishReason: chunk.finishReason,
        usage: chunk.usage,
        metadata: {
          requestId: 'stream',
          timestamp: Date.now(),
          provenance: {},
        },
      };
    }
  }

  return {
    toolCalls: response ? extractToolCalls(response) : [],
    response,
  };
}
