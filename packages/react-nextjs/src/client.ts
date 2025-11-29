/**
 * Next.js Client Utilities
 *
 * Client-side hooks and utilities for Next.js.
 *
 * @module
 */

import { useChat as useChatCore, useCompletion as useCompletionCore } from 'ai.matey.react.core';
import type {
  UseChatOptions,
  UseChatReturn,
  UseCompletionOptions,
  UseCompletionReturn,
} from 'ai.matey.react.core';

/**
 * Extended options for Next.js useChat.
 */
export interface UseNextChatOptions extends UseChatOptions {
  /** Use server action instead of API route */
  serverAction?: (body: unknown) => Promise<unknown>;
  /** Experimental features */
  experimental?: {
    /** Enable partial hydration */
    partialHydration?: boolean;
    /** Enable React Suspense */
    suspense?: boolean;
  };
}

/**
 * useChat hook optimized for Next.js.
 *
 * Wraps the core useChat hook with Next.js-specific defaults.
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useChat } from 'ai.matey.react.nextjs';
 *
 * export function ChatComponent() {
 *   const { messages, input, handleInputChange, handleSubmit } = useChat();
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {messages.map((m) => <div key={m.id}>{m.content}</div>)}
 *       <input value={input} onChange={handleInputChange} />
 *     </form>
 *   );
 * }
 * ```
 */
export function useChat(options: UseNextChatOptions = {}): UseChatReturn {
  const { serverAction, experimental, ...coreOptions } = options;

  // Default API to Next.js convention
  const api = coreOptions.api ?? '/api/chat';

  return useChatCore({
    ...coreOptions,
    api,
    // Use SSE stream protocol by default for Next.js
    streamProtocol: coreOptions.streamProtocol ?? 'data',
  });
}

/**
 * Extended options for Next.js useCompletion.
 */
export interface UseNextCompletionOptions extends UseCompletionOptions {
  /** Use server action instead of API route */
  serverAction?: (body: unknown) => Promise<unknown>;
}

/**
 * useCompletion hook optimized for Next.js.
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useCompletion } from 'ai.matey.react.nextjs';
 *
 * export function CompletionComponent() {
 *   const { completion, input, handleInputChange, handleSubmit } = useCompletion();
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={input} onChange={handleInputChange} />
 *       <p>{completion}</p>
 *     </form>
 *   );
 * }
 * ```
 */
export function useCompletion(options: UseNextCompletionOptions = {}): UseCompletionReturn {
  const { serverAction, ...coreOptions } = options;

  // Default API to Next.js convention
  const api = coreOptions.api ?? '/api/completion';

  return useCompletionCore({
    ...coreOptions,
    api,
    streamProtocol: coreOptions.streamProtocol ?? 'data',
  });
}

/**
 * Metadata for AI-generated content.
 */
export interface AIMetadata {
  /** Provider used */
  provider?: string;
  /** Model used */
  model?: string;
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Generation time in ms */
  generationTime?: number;
}

/**
 * Options for generating metadata.
 */
export interface GenerateMetadataOptions {
  /** Title template */
  titleTemplate?: string;
  /** Description template */
  descriptionTemplate?: string;
  /** Include AI attribution */
  includeAttribution?: boolean;
}

/**
 * Generate Next.js metadata from AI response.
 *
 * Useful for SEO when AI generates page content.
 *
 * @param content - AI-generated content
 * @param aiMetadata - AI generation metadata
 * @param options - Metadata options
 * @returns Next.js Metadata object
 *
 * @example
 * ```typescript
 * // app/blog/[slug]/page.tsx
 * import { generateMetadata } from 'ai.matey.react.nextjs';
 *
 * export async function generateMetadata({ params }) {
 *   const article = await getAIArticle(params.slug);
 *   return generateAIMetadata(article.content, article.aiMetadata);
 * }
 * ```
 */
export function generateAIMetadata(
  content: string,
  aiMetadata?: AIMetadata,
  options: GenerateMetadataOptions = {}
): Record<string, unknown> {
  const { titleTemplate, descriptionTemplate, includeAttribution = false } = options;

  // Extract title (first line or heading)
  const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.+)$/m);
  const rawTitle = titleMatch?.[1]?.trim() || 'Untitled';
  const title = titleTemplate ? titleTemplate.replace('%s', rawTitle) : rawTitle;

  // Extract description (first paragraph)
  const paragraphs = content.split('\n\n').filter((p) => !p.startsWith('#'));
  const rawDescription = paragraphs[0]?.trim().slice(0, 160) || '';
  const description = descriptionTemplate
    ? descriptionTemplate.replace('%s', rawDescription)
    : rawDescription;

  const metadata: Record<string, unknown> = {
    title,
    description,
  };

  // Add AI attribution if requested
  if (includeAttribution && aiMetadata) {
    const attribution = [];
    if (aiMetadata.provider) attribution.push(`Provider: ${aiMetadata.provider}`);
    if (aiMetadata.model) attribution.push(`Model: ${aiMetadata.model}`);

    metadata.other = {
      'ai-generated': 'true',
      ...(attribution.length > 0 && { 'ai-attribution': attribution.join(', ') }),
    };
  }

  return metadata;
}
