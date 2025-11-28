/**
 * Response Converters
 *
 * Utility functions for converting Universal IR responses to various frontend formats.
 * Useful for debugging, testing, and compatibility checking.
 *
 * @module
 */

import type { IRChatResponse, IRChatStream } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';
import {
  OpenAIFrontendAdapter,
  type OpenAIResponse,
  type OpenAIStreamChunk,
} from 'ai.matey.frontend';
import {
  AnthropicFrontendAdapter,
  type AnthropicResponse,
  type AnthropicStreamEvent,
} from 'ai.matey.frontend';
import { GeminiFrontendAdapter } from 'ai.matey.frontend';
import { OllamaFrontendAdapter } from 'ai.matey.frontend';
import { MistralFrontendAdapter } from 'ai.matey.frontend';

// ============================================================================
// Non-Streaming Converters
// ============================================================================

/**
 * Convert Universal IR response to OpenAI format.
 *
 * @param response Universal IR response
 * @returns OpenAI-formatted response
 *
 * @example
 * ```typescript
 * import { toOpenAI } from 'ai.matey/utils';
 *
 * const irResponse = await backend.execute(request);
 * const openaiFormat = await toOpenAI(irResponse);
 * console.log(JSON.stringify(openaiFormat, null, 2));
 * ```
 */
export async function toOpenAI(response: IRChatResponse): Promise<OpenAIResponse> {
  const adapter = new OpenAIFrontendAdapter();
  return adapter.fromIR(response);
}

/**
 * Convert Universal IR response to Anthropic format.
 *
 * @param response Universal IR response
 * @returns Anthropic-formatted response
 *
 * @example
 * ```typescript
 * import { toAnthropic } from 'ai.matey/utils';
 *
 * const irResponse = await backend.execute(request);
 * const anthropicFormat = await toAnthropic(irResponse);
 * ```
 */
export async function toAnthropic(response: IRChatResponse): Promise<AnthropicResponse> {
  const adapter = new AnthropicFrontendAdapter();
  return adapter.fromIR(response);
}

/**
 * Convert Universal IR response to Gemini format.
 *
 * @param response Universal IR response
 * @returns Gemini-formatted response
 */
export async function toGemini(response: IRChatResponse): Promise<unknown> {
  const adapter = new GeminiFrontendAdapter();
  return adapter.fromIR(response);
}

/**
 * Convert Universal IR response to Ollama format.
 *
 * @param response Universal IR response
 * @returns Ollama-formatted response
 */
export async function toOllama(response: IRChatResponse): Promise<unknown> {
  const adapter = new OllamaFrontendAdapter();
  return adapter.fromIR(response);
}

/**
 * Convert Universal IR response to Mistral format.
 *
 * @param response Universal IR response
 * @returns Mistral-formatted response
 */
export async function toMistral(response: IRChatResponse): Promise<unknown> {
  const adapter = new MistralFrontendAdapter();
  return adapter.fromIR(response);
}

// ============================================================================
// Streaming Converters
// ============================================================================

/**
 * Convert Universal IR stream to OpenAI SSE format.
 *
 * @param stream Universal IR stream
 * @param options Stream conversion options
 * @returns OpenAI-formatted stream chunks
 *
 * @example
 * ```typescript
 * import { toOpenAIStream } from 'ai.matey/utils';
 *
 * const irStream = backend.executeStream(request);
 * for await (const chunk of toOpenAIStream(irStream)) {
 *   console.log('OpenAI chunk:', chunk);
 * }
 * ```
 */
export async function* toOpenAIStream(
  stream: IRChatStream,
  options?: StreamConversionOptions
): AsyncGenerator<OpenAIStreamChunk, void, undefined> {
  const adapter = new OpenAIFrontendAdapter();
  yield* adapter.fromIRStream(stream, options);
}

/**
 * Convert Universal IR stream to Anthropic SSE format.
 *
 * @param stream Universal IR stream
 * @param options Stream conversion options
 * @returns Anthropic-formatted stream chunks
 */
export async function* toAnthropicStream(
  stream: IRChatStream,
  options?: StreamConversionOptions
): AsyncGenerator<AnthropicStreamEvent, void, undefined> {
  const adapter = new AnthropicFrontendAdapter();
  yield* adapter.fromIRStream(stream, options);
}

/**
 * Convert Universal IR stream to Gemini SSE format.
 *
 * @param stream Universal IR stream
 * @param options Stream conversion options
 * @returns Gemini-formatted stream chunks
 */
export async function* toGeminiStream(
  stream: IRChatStream,
  options?: StreamConversionOptions
): AsyncGenerator<unknown, void, undefined> {
  const adapter = new GeminiFrontendAdapter();
  yield* adapter.fromIRStream(stream, options);
}

/**
 * Convert Universal IR stream to Mistral SSE format.
 *
 * @param stream Universal IR stream
 * @param options Stream conversion options
 * @returns Mistral-formatted stream chunks
 */
export async function* toMistralStream(
  stream: IRChatStream,
  options?: StreamConversionOptions
): AsyncGenerator<unknown, void, undefined> {
  const adapter = new MistralFrontendAdapter();
  yield* adapter.fromIRStream(stream, options);
}

// ============================================================================
// Multi-Format Converter (for comparison/debugging)
// ============================================================================

/**
 * Convert Universal IR response to multiple formats at once.
 * Useful for debugging and comparing how different providers handle the same response.
 *
 * @param response Universal IR response
 * @param formats Array of format names to convert to
 * @returns Object with converted responses for each format
 *
 * @example
 * ```typescript
 * import { toMultipleFormats } from 'ai.matey/utils';
 *
 * const irResponse = await backend.execute(request);
 * const allFormats = await toMultipleFormats(irResponse, ['openai', 'anthropic', 'gemini']);
 *
 * console.log('OpenAI:', JSON.stringify(allFormats.openai, null, 2));
 * console.log('Anthropic:', JSON.stringify(allFormats.anthropic, null, 2));
 * console.log('Gemini:', JSON.stringify(allFormats.gemini, null, 2));
 * ```
 */
export async function toMultipleFormats(
  response: IRChatResponse,
  formats: Array<'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mistral'> = [
    'openai',
    'anthropic',
    'gemini',
  ]
): Promise<{
  openai?: OpenAIResponse;
  anthropic?: AnthropicResponse;
  gemini?: unknown;
  ollama?: unknown;
  mistral?: unknown;
}> {
  const result: Record<string, unknown> = {};

  for (const format of formats) {
    switch (format) {
      case 'openai':
        result.openai = await toOpenAI(response);
        break;
      case 'anthropic':
        result.anthropic = await toAnthropic(response);
        break;
      case 'gemini':
        result.gemini = await toGemini(response);
        break;
      case 'ollama':
        result.ollama = await toOllama(response);
        break;
      case 'mistral':
        result.mistral = await toMistral(response);
        break;
    }
  }

  return result;
}
