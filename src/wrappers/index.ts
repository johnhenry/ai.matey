/**
 * Wrapper Exports
 *
 * Wrappers that mimic other AI APIs using ai.matey backends.
 *
 * @module
 */

// Chrome AI wrapper (current API)
export * from './chrome-ai.js';

// Legacy Chrome AI wrapper (old API before recent changes)
export * from './chrome-ai-legacy.js';

// OpenAI SDK wrapper
export {
  OpenAI,
  type OpenAISDKConfig,
  type OpenAIMessage,
  type OpenAIChatCompletionParams,
  type OpenAIChatCompletion,
  type OpenAIChatCompletionChunk,
  type OpenAIModel,
  type OpenAIModelsPage,
  Chat as OpenAIChat,
  ChatCompletions as OpenAIChatCompletions,
  Models as OpenAIModels,
  OpenAIClient,
} from './openai-sdk.js';

// Anthropic SDK wrapper
export {
  Anthropic,
  type AnthropicSDKConfig,
  type AnthropicSDKMessage,
  type AnthropicMessageParams,
  type AnthropicContentBlock,
  type AnthropicSDKUsage,
  type AnthropicSDKMessageResponse,
  type AnthropicStreamEvent,
  type AnthropicModel,
  type AnthropicModelsResponse,
  Messages as AnthropicMessages,
  Models as AnthropicModels,
  AnthropicClient,
} from './anthropic-sdk.js';

// Anymethod wrapper (natural language method interface)
export {
  createAnymethod,
  createStatelessAnymethod,
  createConversationalAnymethod,
  formatMethodPrompt,
  type Anymethod,
  type AnymethodConfig,
  type AnymethodProxy,
  type AnymethodStreamProxy,
} from './anymethod.js';
