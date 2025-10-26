/**
 * Legacy Chrome AI Language Model Wrapper
 *
 * Mimics the ORIGINAL Chrome AI (window.ai.languageModel) API before recent changes.
 * This provides compatibility with the old ai.matey implementation.
 *
 * Key differences from current Chrome AI:
 * - Uses `window.ai.languageModel` instead of `window.ai.LanguageModel`
 * - No `append()` method
 * - Different streaming behavior
 * - Simpler session management
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRChatRequest, IRMessage } from '../types/ir.js';
import { trimHistory } from '../utils/conversation-history.js';

// ============================================================================
// Legacy Chrome AI Compatible Types
// ============================================================================

/**
 * Legacy Chrome AI prompt format.
 */
export interface LegacyChromeAIPrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for creating a legacy language model session.
 */
export interface LegacyChromeAICreateOptions {
  /**
   * Initial prompts (system messages) to set context for the session.
   */
  initialPrompts?: LegacyChromeAIPrompt[];

  /**
   * Temperature (0-1). Higher values make output more random.
   */
  temperature?: number;

  /**
   * Top-K sampling parameter.
   */
  topK?: number;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Model to use (backend-specific).
   */
  model?: string;

  /**
   * Maximum conversation history size.
   * - 0: No history (stateless, default)
   * - -1: Unlimited history
   * - N > 0: Keep last N user/assistant message pairs
   * @default 0
   */
  maxHistorySize?: number;
}

/**
 * Legacy Chrome AI session interface.
 */
export interface LegacyChromeAISession {
  /**
   * Send a prompt and get a complete response.
   */
  prompt(input: string): Promise<string>;

  /**
   * Send a prompt and get a streaming response.
   * Returns an async iterator instead of ReadableStream.
   */
  promptStreaming(input: string): AsyncIterable<string>;

  /**
   * Destroy the session and clean up resources.
   */
  destroy(): void;

  /**
   * Clone the session with the same configuration.
   */
  clone(): LegacyChromeAISession;

  /**
   * Get current token count (estimated).
   */
  tokensSoFar?: number;

  /**
   * Get maximum tokens allowed.
   */
  maxTokens?: number;

  /**
   * Get tokens remaining (estimated).
   */
  tokensLeft?: number;
}

/**
 * Legacy Chrome AI language model interface.
 */
export interface LegacyChromeAILanguageModelAPI {
  /**
   * Create a new text session.
   */
  create(options?: LegacyChromeAICreateOptions): Promise<LegacyChromeAISession>;

  /**
   * Check if the language model is available.
   * Legacy API returns 'yes', 'no', or 'after-download'.
   */
  capabilities(): Promise<{
    available: 'yes' | 'no' | 'after-download';
    defaultTemperature?: number;
    defaultTopK?: number;
    maxTopK?: number;
  }>;
}

// ============================================================================
// Legacy Session Implementation
// ============================================================================

/**
 * Implementation of a legacy Chrome AI-compatible session.
 */
class LegacyChromeAISessionImpl implements LegacyChromeAISession {
  private backend: BackendAdapter;
  private conversationHistory: IRMessage[];
  private options: LegacyChromeAICreateOptions;
  private destroyed = false;
  private _tokensSoFar = 0;

  constructor(backend: BackendAdapter, options: LegacyChromeAICreateOptions) {
    this.backend = backend;
    this.options = options;

    // Initialize conversation history with initial prompts
    this.conversationHistory = options.initialPrompts?.map((prompt) => ({
      role: prompt.role,
      content: prompt.content,
    })) || [];
  }

  get tokensSoFar(): number {
    return this._tokensSoFar;
  }

  get maxTokens(): number {
    return this.options.maxTokens || 1024;
  }

  get tokensLeft(): number {
    return Math.max(0, this.maxTokens - this._tokensSoFar);
  }

  async prompt(input: string): Promise<string> {
    if (this.destroyed) {
      throw new Error('Session has been destroyed');
    }

    // Add user message to history
    const userMessage: IRMessage = { role: 'user', content: input };
    this.conversationHistory.push(userMessage);

    // Build IR request
    const request: IRChatRequest = {
      messages: [...this.conversationHistory],
      parameters: {
        model: this.options.model,
        temperature: this.options.temperature,
        topK: this.options.topK,
        maxTokens: this.options.maxTokens,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'chrome-ai-legacy-wrapper',
        },
      },
    };

    // Execute request
    const response = await this.backend.execute(request);

    // Add assistant response to history
    this.conversationHistory.push(response.message);

    // Trim history if maxHistorySize is configured
    if (this.options.maxHistorySize !== undefined && this.options.maxHistorySize !== -1) {
      this.conversationHistory = trimHistory(
        this.conversationHistory,
        this.options.maxHistorySize,
        'smart'
      );
    }

    // Update token count (estimated)
    if (response.usage) {
      this._tokensSoFar = response.usage.totalTokens;
    } else {
      // Rough estimate if no usage provided
      this._tokensSoFar += Math.ceil(input.length / 4);
      const responseText = typeof response.message.content === 'string'
        ? response.message.content
        : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
      this._tokensSoFar += Math.ceil(responseText.length / 4);
    }

    // Return text content
    return typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  }

  async *promptStreaming(input: string): AsyncIterable<string> {
    if (this.destroyed) {
      throw new Error('Session has been destroyed');
    }

    // Add user message to history
    const userMessage: IRMessage = { role: 'user', content: input };
    this.conversationHistory.push(userMessage);

    // Build IR request
    const request: IRChatRequest = {
      messages: [...this.conversationHistory],
      parameters: {
        model: this.options.model,
        temperature: this.options.temperature,
        topK: this.options.topK,
        maxTokens: this.options.maxTokens,
      },
      stream: true,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'chrome-ai-legacy-wrapper',
        },
      },
    };

    let fullContent = '';

    try {
      const stream = this.backend.executeStream(request);

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          fullContent += chunk.delta;
          // Legacy API streams delta chunks
          yield chunk.delta;
        } else if (chunk.type === 'done') {
          // Add final message to history
          if (chunk.message) {
            this.conversationHistory.push(chunk.message);
          }

          // Trim history if maxHistorySize is configured
          if (this.options.maxHistorySize !== undefined && this.options.maxHistorySize !== -1) {
            this.conversationHistory = trimHistory(
              this.conversationHistory,
              this.options.maxHistorySize,
              'smart'
            );
          }

          // Update token count
          if (chunk.usage) {
            this._tokensSoFar = chunk.usage.totalTokens;
          } else {
            this._tokensSoFar += Math.ceil(input.length / 4);
            this._tokensSoFar += Math.ceil(fullContent.length / 4);
          }
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error.message);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.conversationHistory = [];
    this._tokensSoFar = 0;
  }

  clone(): LegacyChromeAISession {
    // Legacy clone creates a new session with same config but no history
    return new LegacyChromeAISessionImpl(this.backend, {
      ...this.options,
      initialPrompts: this.options.initialPrompts,
    });
  }
}

// ============================================================================
// Legacy Language Model Implementation
// ============================================================================

/**
 * Create a legacy Chrome AI-compatible Language Model API using any backend adapter.
 *
 * This mimics the ORIGINAL window.ai.languageModel API from the old Chrome AI implementation
 * before recent changes.
 *
 * @example Basic Usage
 * ```typescript
 * import { LegacyChromeAILanguageModel } from 'ai.matey/wrappers/chrome-ai-legacy';
 * import { OpenAIBackendAdapter } from 'ai.matey/adapters/backend/openai';
 *
 * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 * const languageModel = LegacyChromeAILanguageModel(backend);
 *
 * // Check capabilities
 * const caps = await languageModel.capabilities();
 * console.log(caps); // { available: 'yes', defaultTemperature: 0.7, ... }
 *
 * // Create session
 * const session = await languageModel.create({
 *   initialPrompts: [{
 *     role: 'system',
 *     content: 'You are a helpful assistant.'
 *   }],
 *   temperature: 0.8,
 * });
 *
 * // Non-streaming prompt
 * const response = await session.prompt('Tell me a joke.');
 * console.log(response);
 *
 * // Streaming prompt
 * for await (const chunk of session.promptStreaming('Tell me a story.')) {
 *   process.stdout.write(chunk);
 * }
 * ```
 *
 * @example With Token Tracking
 * ```typescript
 * const session = await languageModel.create({ maxTokens: 1000 });
 *
 * await session.prompt('Hello!');
 * console.log('Tokens used:', session.tokensSoFar);
 * console.log('Tokens left:', session.tokensLeft);
 * ```
 *
 * @example Session Cloning
 * ```typescript
 * const session1 = await languageModel.create({
 *   initialPrompts: [{ role: 'system', content: 'You are helpful.' }]
 * });
 *
 * await session1.prompt('Remember: my name is Alice.');
 *
 * // Clone creates new session with same config but no conversation history
 * const session2 = session1.clone();
 * await session2.prompt('What is my name?'); // Won't remember Alice
 * ```
 */
export function LegacyChromeAILanguageModel(
  backend: BackendAdapter
): LegacyChromeAILanguageModelAPI {
  return {
    async create(options: LegacyChromeAICreateOptions = {}): Promise<LegacyChromeAISession> {
      return new LegacyChromeAISessionImpl(backend, options);
    },

    async capabilities(): Promise<{
      available: 'yes' | 'no' | 'after-download';
      defaultTemperature?: number;
      defaultTopK?: number;
      maxTopK?: number;
    }> {
      // Check if backend is healthy (healthCheck is optional)
      const isHealthy = backend.healthCheck ? await backend.healthCheck() : true;

      return {
        available: isHealthy ? 'yes' : 'no',
        defaultTemperature: 0.7,
        defaultTopK: 40,
        maxTopK: 100,
      };
    },
  };
}

// ============================================================================
// Convenience Export (window.ai style)
// ============================================================================

/**
 * Create a legacy window.ai-style object with languageModel.
 *
 * This mimics the original window.ai interface structure.
 *
 * @example
 * ```typescript
 * import { createLegacyWindowAI } from 'ai.matey/wrappers/chrome-ai-legacy';
 * import { AnthropicBackendAdapter } from 'ai.matey/adapters/backend/anthropic';
 *
 * const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
 * const ai = createLegacyWindowAI(backend);
 *
 * // Use like original window.ai
 * const session = await ai.languageModel.create();
 * const response = await session.prompt('Hello!');
 * ```
 *
 * @example Make it global (for compatibility)
 * ```typescript
 * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 * globalThis.ai = createLegacyWindowAI(backend);
 *
 * // Now can use window.ai (or global.ai in Node)
 * const session = await ai.languageModel.create();
 * ```
 */
export function createLegacyWindowAI(backend: BackendAdapter) {
  return {
    languageModel: LegacyChromeAILanguageModel(backend),
  };
}

/**
 * Polyfill for legacy window.ai.languageModel.
 *
 * Automatically creates window.ai if it doesn't exist.
 *
 * @example
 * ```typescript
 * import { polyfillLegacyWindowAI } from 'ai.matey/wrappers/chrome-ai-legacy';
 * import { OpenAIBackendAdapter } from 'ai.matey/adapters/backend/openai';
 *
 * const backend = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY });
 * polyfillLegacyWindowAI(backend);
 *
 * // Now window.ai is available globally
 * const session = await window.ai.languageModel.create();
 * const response = await session.prompt('Hello!');
 * ```
 */
export function polyfillLegacyWindowAI(backend: BackendAdapter): void {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).ai = createLegacyWindowAI(backend);
  }
}
