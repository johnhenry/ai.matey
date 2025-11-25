/**
 * Request Conversion Utilities
 *
 * Convert Universal IR requests to provider-specific formats for debugging.
 * Complements the response converters - provides full request/response symmetry.
 *
 * @example
 * ```typescript
 * import { toOpenAIRequest, toAnthropicRequest } from 'ai.matey';
 *
 * // Convert IR request to see what will be sent to OpenAI
 * const openaiReq = toOpenAIRequest(irRequest);
 * console.log('Will send to OpenAI:', openaiReq);
 *
 * // Convert IR request to Anthropic format
 * const anthropicReq = toAnthropicRequest(irRequest);
 * ```
 *
 * @module
 */

import type { IRChatRequest } from 'ai.matey.types';
import {
  OpenAIBackendAdapter,
  type OpenAIRequest,
} from 'ai.matey.backend.openai';
import {
  AnthropicBackendAdapter,
  type AnthropicRequest,
} from 'ai.matey.backend.anthropic';
import {
  GeminiBackendAdapter,
  type GeminiRequest,
} from 'ai.matey.backend.gemini';
import {
  OllamaBackendAdapter,
  type OllamaRequest,
} from 'ai.matey.backend.ollama';
import {
  MistralBackendAdapter,
  type MistralRequest,
} from 'ai.matey.backend.mistral';

// ============================================================================
// Individual Request Converters
// ============================================================================

/**
 * Convert IR request to OpenAI format.
 *
 * Useful for:
 * - Debugging: See what will be sent to OpenAI
 * - Testing: Create OpenAI requests without a backend
 * - Inspection: Understand format transformations
 *
 * @param request - Universal IR request
 * @returns OpenAI-formatted request
 *
 * @example
 * ```typescript
 * const openaiReq = toOpenAIRequest({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'gpt-4', temperature: 0.7 }
 * });
 * console.log(openaiReq.messages); // OpenAI format
 * ```
 */
export function toOpenAIRequest(request: IRChatRequest): OpenAIRequest {
  const adapter = new OpenAIBackendAdapter({ apiKey: 'dummy' });
  return adapter.fromIR(request);
}

/**
 * Convert IR request to Anthropic format.
 *
 * @param request - Universal IR request
 * @returns Anthropic-formatted request
 *
 * @example
 * ```typescript
 * const anthropicReq = toAnthropicRequest({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'claude-3', maxTokens: 100 }
 * });
 * console.log(anthropicReq.system); // Anthropic uses separate system parameter
 * ```
 */
export function toAnthropicRequest(request: IRChatRequest): AnthropicRequest {
  const adapter = new AnthropicBackendAdapter({ apiKey: 'dummy' });
  return adapter.fromIR(request);
}

/**
 * Convert IR request to Gemini format.
 *
 * @param request - Universal IR request
 * @returns Gemini-formatted request
 *
 * @example
 * ```typescript
 * const geminiReq = toGeminiRequest({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'gemini-pro', temperature: 0.7 }
 * });
 * console.log(geminiReq.contents); // Gemini uses 'contents' array
 * ```
 */
export function toGeminiRequest(request: IRChatRequest): GeminiRequest {
  const adapter = new GeminiBackendAdapter({ apiKey: 'dummy' });
  return adapter.fromIR(request);
}

/**
 * Convert IR request to Ollama format.
 *
 * @param request - Universal IR request
 * @returns Ollama-formatted request
 *
 * @example
 * ```typescript
 * const ollamaReq = toOllamaRequest({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'llama2', temperature: 0.7 }
 * });
 * ```
 */
export function toOllamaRequest(request: IRChatRequest): OllamaRequest {
  const adapter = new OllamaBackendAdapter({ apiKey: 'dummy' });
  return adapter.fromIR(request);
}

/**
 * Convert IR request to Mistral format.
 *
 * @param request - Universal IR request
 * @returns Mistral-formatted request
 *
 * @example
 * ```typescript
 * const mistralReq = toMistralRequest({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'mistral-small', temperature: 0.7 }
 * });
 * ```
 */
export function toMistralRequest(request: IRChatRequest): MistralRequest {
  const adapter = new MistralBackendAdapter({ apiKey: 'dummy' });
  return adapter.fromIR(request);
}

// ============================================================================
// Multi-Format Converter
// ============================================================================

/**
 * Convert IR request to multiple provider formats at once.
 *
 * Useful for comparing how the same request looks across different providers.
 *
 * @param request - Universal IR request
 * @param formats - Array of target formats
 * @returns Object with format names as keys and converted requests as values
 *
 * @example
 * ```typescript
 * const allFormats = toMultipleRequestFormats(irRequest, [
 *   'openai',
 *   'anthropic',
 *   'gemini'
 * ]);
 *
 * console.log('OpenAI:', allFormats.openai);
 * console.log('Anthropic:', allFormats.anthropic);
 * console.log('Gemini:', allFormats.gemini);
 * ```
 */
export function toMultipleRequestFormats(
  request: IRChatRequest,
  formats: Array<'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mistral'>
): {
  openai?: OpenAIRequest;
  anthropic?: AnthropicRequest;
  gemini?: GeminiRequest;
  ollama?: OllamaRequest;
  mistral?: MistralRequest;
} {
  const result: Record<string, unknown> = {};

  for (const format of formats) {
    switch (format) {
      case 'openai':
        result.openai = toOpenAIRequest(request);
        break;
      case 'anthropic':
        result.anthropic = toAnthropicRequest(request);
        break;
      case 'gemini':
        result.gemini = toGeminiRequest(request);
        break;
      case 'ollama':
        result.ollama = toOllamaRequest(request);
        break;
      case 'mistral':
        result.mistral = toMistralRequest(request);
        break;
    }
  }

  return result;
}
