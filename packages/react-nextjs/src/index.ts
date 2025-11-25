/**
 * AI Matey React Next.js
 *
 * Next.js integration for AI Matey.
 *
 * For server-side utilities, import from 'ai.matey.react.nextjs/server'.
 *
 * @packageDocumentation
 */

// Re-export core hooks for convenience
export { useChat, useCompletion, generateAIMetadata } from './client.js';

// Re-export core types
export type {
  Message,
  ToolCall,
  ToolInvocation,
  Tool,
  ChatRequestOptions,
  CompletionRequestOptions,
} from 'ai.matey.react.core';

// Export Next.js specific types
export type {
  UseNextChatOptions,
  UseNextCompletionOptions,
  AIMetadata,
  GenerateMetadataOptions,
} from './client.js';
