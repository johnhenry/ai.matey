/**
 * Chrome AI Language Model Wrapper
 *
 * Mimics the Chrome AI (window.ai.languageModel) API using any backend adapter.
 * This allows you to:
 * - Use Chrome AI-style API with any provider (OpenAI, Anthropic, etc.)
 * - Test Chrome AI code in environments where Chrome AI isn't available
 * - Create a consistent interface across all backends
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRChatRequest, IRMessage } from '../types/ir.js';
import type { StreamMode } from '../types/streaming.js';

// ============================================================================
// Chrome AI Compatible Types
// ============================================================================

/**
 * Chrome AI-compatible prompt format.
 */
export interface ChromeAIPrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for creating a language model session.
 */
export interface ChromeAICreateOptions {
  /**
   * Initial prompts (system messages) to set context for the session.
   */
  initialPrompts?: ChromeAIPrompt[];

  /**
   * Temperature (0-1). Higher values make output more random.
   */
  temperature?: number;

  /**
   * Top-K sampling parameter.
   */
  topK?: number;

  /**
   * Top-P (nucleus) sampling parameter.
   */
  topP?: number;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Model to use (backend-specific).
   */
  model?: string;

  /**
   * Streaming mode for promptStreaming().
   *
   * - `accumulated`: Stream full content so far (Chrome AI default)
   * - `delta`: Stream only new chunks (more efficient)
   *
   * @default 'accumulated'
   */
  streamMode?: StreamMode;
}

/**
 * Chrome AI-compatible session interface.
 */
export interface ChromeAISession {
  /**
   * Send a prompt and get a complete response.
   */
  prompt(input: string): Promise<string>;

  /**
   * Send a prompt and get a streaming response.
   */
  promptStreaming(input: string): ReadableStream<string>;

  /**
   * Destroy the session and clean up resources.
   */
  destroy(): void;

  /**
   * Clone the session with the same configuration.
   */
  clone(): Promise<ChromeAISession>;
}

/**
 * Chrome AI-compatible language model interface.
 */
export interface ChromeAILanguageModelAPI {
  /**
   * Create a new text session.
   */
  create(options?: ChromeAICreateOptions): Promise<ChromeAISession>;

  /**
   * Check if the language model is available.
   */
  capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
}

// ============================================================================
// Session Implementation
// ============================================================================

/**
 * Implementation of a Chrome AI-compatible session.
 */
class ChromeAISessionImpl implements ChromeAISession {
  private backend: BackendAdapter;
  private conversationHistory: IRMessage[];
  private options: ChromeAICreateOptions;
  private destroyed = false;

  constructor(backend: BackendAdapter, options: ChromeAICreateOptions) {
    this.backend = backend;
    this.options = options;

    // Initialize conversation history with initial prompts
    this.conversationHistory = options.initialPrompts?.map((prompt) => ({
      role: prompt.role,
      content: prompt.content,
    })) || [];
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
        topP: this.options.topP,
        maxTokens: this.options.maxTokens,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'chrome-ai-wrapper',
        },
      },
    };

    // Execute request
    const response = await this.backend.execute(request);

    // Add assistant response to history
    this.conversationHistory.push(response.message);

    // Return text content
    return typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  }

  promptStreaming(input: string): ReadableStream<string> {
    if (this.destroyed) {
      throw new Error('Session has been destroyed');
    }

    // Add user message to history
    const userMessage: IRMessage = { role: 'user', content: input };
    this.conversationHistory.push(userMessage);

    // Get effective stream mode (Chrome AI default is 'accumulated')
    const streamMode = this.options.streamMode || 'accumulated';

    // Build IR request
    const request: IRChatRequest = {
      messages: [...this.conversationHistory],
      parameters: {
        model: this.options.model,
        temperature: this.options.temperature,
        topK: this.options.topK,
        topP: this.options.topP,
        maxTokens: this.options.maxTokens,
      },
      stream: true,
      streamMode,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'chrome-ai-wrapper',
        },
      },
    };

    const backend = this.backend;
    const conversationHistory = this.conversationHistory;
    let contentBuffer = '';

    // Create ReadableStream with configurable streaming mode
    return new ReadableStream<string>({
      async start(controller) {
        try {
          const stream = backend.executeStream(request);

          for await (const chunk of stream) {
            if (chunk.type === 'content') {
              contentBuffer += chunk.delta;

              // Stream according to configured mode
              if (streamMode === 'delta') {
                // Delta mode: stream only new chunks
                controller.enqueue(chunk.delta);
              } else {
                // Accumulated mode: stream full content so far (Chrome AI behavior)
                controller.enqueue(contentBuffer);
              }
            } else if (chunk.type === 'done') {
              // Add final message to history
              if (chunk.message) {
                conversationHistory.push(chunk.message);
              }
              controller.close();
            } else if (chunk.type === 'error') {
              controller.error(new Error(chunk.error.message));
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.conversationHistory = [];
  }

  async clone(): Promise<ChromeAISession> {
    return new ChromeAISessionImpl(this.backend, {
      ...this.options,
      initialPrompts: this.conversationHistory
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({
          role: msg.role as 'system',
          content: typeof msg.content === 'string' ? msg.content : '',
        })),
    });
  }
}

// ============================================================================
// Language Model Implementation
// ============================================================================

/**
 * Create a Chrome AI-compatible Language Model API using any backend adapter.
 *
 * @example
 * ```typescript
 * import { ChromeAILanguageModel } from 'ai.matey/wrappers/chrome-ai';
 * import { OpenAIBackendAdapter } from 'ai.matey/adapters/backend/openai';
 *
 * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 * const LanguageModel = ChromeAILanguageModel(backend);
 *
 * const session = await LanguageModel.create({
 *   initialPrompts: [{
 *     role: 'system',
 *     content: 'You are a helpful assistant and you speak like a pirate.'
 *   }],
 * });
 *
 * console.log(await session.prompt('Tell me a joke.'));
 * // "Ahoy, matey! Why did the pirate go to school? To improve his arrrr-ticulation!"
 * ```
 */
export function ChromeAILanguageModel(
  backend: BackendAdapter,
  defaultOptions: ChromeAICreateOptions = {}
): ChromeAILanguageModelAPI {
  return {
    async create(options: ChromeAICreateOptions = {}): Promise<ChromeAISession> {
      // Merge default options with session-specific options
      const mergedOptions: ChromeAICreateOptions = {
        ...defaultOptions,
        ...options,
        // Merge initialPrompts arrays
        initialPrompts: [
          ...(defaultOptions.initialPrompts || []),
          ...(options.initialPrompts || []),
        ],
      };
      return new ChromeAISessionImpl(backend, mergedOptions);
    },

    async capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }> {
      // Check if backend is healthy (healthCheck is optional)
      const isHealthy = backend.healthCheck ? await backend.healthCheck() : true;
      return {
        available: isHealthy ? 'readily' : 'no',
      };
    },
  };
}

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * Create a Chrome AI-compatible language model with convenient default options.
 *
 * @example
 * ```typescript
 * import { createChromeAILanguageModel } from 'ai.matey/wrappers/chrome-ai';
 * import { AnthropicBackendAdapter } from 'ai.matey/adapters/backend/anthropic';
 *
 * const backend = new AnthropicBackendAdapter({ apiKey: 'sk-ant-...' });
 * const ai = createChromeAILanguageModel(backend);
 *
 * const session = await ai.languageModel.create({
 *   initialPrompts: [{ role: 'system', content: 'You are helpful.' }],
 * });
 *
 * console.log(await session.prompt('What is 2+2?'));
 * ```
 */
export function createChromeAILanguageModel(backend: BackendAdapter) {
  return {
    languageModel: ChromeAILanguageModel(backend),
  };
}
