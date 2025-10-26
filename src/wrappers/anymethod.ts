/**
 * Anymethod Wrapper
 *
 * Natural language method interface using Proxy pattern.
 * Inspired by the original ai.matey Anymethod pattern.
 *
 * Provides two namespaces:
 * - `.$` - Async methods that return promises with parsed results
 * - `.$$` - Streaming methods that return async iterables
 *
 * Method names are converted to natural language prompts.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';
import type { IRChatRequest, IRMessage } from '../types/ir.js';
import { trimHistory } from '../utils/conversation-history.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for Anymethod wrapper.
 */
export interface AnymethodConfig {
  /**
   * Default model to use for requests.
   */
  model?: string;

  /**
   * Default temperature (0-1).
   */
  temperature?: number;

  /**
   * Default top-K sampling parameter.
   */
  topK?: number;

  /**
   * Default top-P sampling parameter.
   */
  topP?: number;

  /**
   * Default maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Maximum conversation history size.
   * - 0: No history (stateless, default)
   * - -1: Unlimited history
   * - N > 0: Keep last N user/assistant message pairs
   * @default 0
   */
  maxHistorySize?: number;

  /**
   * Initial prompts (system messages) to set context.
   */
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  /**
   * Whether to automatically parse JSON responses.
   * If true, attempts to JSON.parse() responses. Falls back to raw text on failure.
   * @default true
   */
  autoParseJSON?: boolean;

  /**
   * Custom method prompt formatter.
   * Converts method name and arguments to a prompt string.
   * @default Built-in formatter (converts camelCase to natural language)
   */
  methodPromptFormatter?: (methodName: string, args: unknown[]) => string;
}

/**
 * Anymethod instance with proxy-based method calls.
 */
export interface Anymethod {
  /**
   * Async method namespace.
   * Call any method name as a natural language prompt.
   *
   * @example
   * ```typescript
   * const result = await model.$.translateToSpanish('Hello world');
   * const summary = await model.$.summarize(longText);
   * ```
   */
  readonly $: AnymethodProxy;

  /**
   * Streaming method namespace.
   * Call any method name as a natural language prompt with streaming response.
   *
   * @example
   * ```typescript
   * for await (const chunk of model.$$.generateStory('space adventure')) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  readonly $$: AnymethodStreamProxy;

  /**
   * Direct prompt method (non-streaming).
   * Useful when you want to use a prompt directly without method syntax.
   *
   * @param input Prompt text
   * @returns Assistant response
   */
  prompt(input: string): Promise<string>;

  /**
   * Direct streaming prompt method.
   * Useful when you want to use a prompt directly without method syntax.
   *
   * @param input Prompt text
   * @returns Async iterable of response chunks
   */
  promptStreaming(input: string): AsyncIterable<string>;

  /**
   * Get the current conversation history.
   */
  getHistory(): readonly IRMessage[];

  /**
   * Clear the conversation history.
   */
  clearHistory(): void;

  /**
   * Set the conversation history to a specific state.
   */
  setHistory(history: IRMessage[]): void;

  /**
   * Get estimated token count.
   */
  tokensSoFar: number;

  /**
   * Get maximum tokens allowed.
   */
  maxTokens: number;

  /**
   * Get estimated tokens remaining.
   */
  tokensLeft: number;
}

/**
 * Proxy type for async methods.
 */
export type AnymethodProxy = {
  [key: string]: (...args: unknown[]) => Promise<unknown>;
};

/**
 * Proxy type for streaming methods.
 */
export type AnymethodStreamProxy = {
  [key: string]: (...args: unknown[]) => AsyncIterable<string>;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Default method prompt formatter.
 * Converts camelCase method names to natural language prompts.
 *
 * @example
 * ```typescript
 * formatMethodPrompt('translateToSpanish', ['Hello'])
 * // Returns: "translate to spanish: Hello"
 *
 * formatMethodPrompt('summarize', [longText, 'in 3 sentences'])
 * // Returns: "summarize: {longText} in 3 sentences"
 * ```
 */
export function formatMethodPrompt(methodName: string, args: unknown[]): string {
  // Convert camelCase to space-separated words
  const naturalName = methodName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();

  // Join arguments with spaces
  const argsString = args.map((arg) => String(arg)).join(' ');

  // Combine method name and arguments
  if (argsString) {
    return `${naturalName}: ${argsString}`;
  }

  return naturalName;
}

// ============================================================================
// Anymethod Implementation
// ============================================================================

/**
 * Create an Anymethod wrapper around a backend adapter.
 *
 * Provides a natural language method interface using Proxy pattern.
 * Method names are converted to prompts, enabling intuitive API calls.
 *
 * @param backend Backend adapter to wrap
 * @param config Anymethod configuration
 * @returns Anymethod instance
 *
 * @example Basic Usage
 * ```typescript
 * import { createAnymethod } from 'ai.matey/wrappers/anymethod';
 * import { OpenAIBackendAdapter } from 'ai.matey/adapters/backend/openai';
 *
 * const backend = new OpenAIBackendAdapter({ apiKey: 'sk-...' });
 * const model = createAnymethod(backend);
 *
 * // Async method calls
 * const translation = await model.$.translateToFrench('Hello world');
 * console.log(translation); // "Bonjour le monde"
 *
 * const summary = await model.$.summarize('Long text here...', 'in 2 sentences');
 * console.log(summary);
 *
 * // Streaming method calls
 * for await (const chunk of model.$$.generateStory('space adventure')) {
 *   process.stdout.write(chunk);
 * }
 * ```
 *
 * @example With Configuration
 * ```typescript
 * const model = createAnymethod(backend, {
 *   model: 'gpt-4o',
 *   temperature: 0.8,
 *   maxHistorySize: 10,
 *   initialPrompts: [
 *     { role: 'system', content: 'You are a helpful assistant.' }
 *   ]
 * });
 *
 * // History is automatically managed
 * await model.$.askQuestion('What is 2+2?');
 * await model.$.followUp('And what about 3+3?'); // Has context from previous
 * ```
 *
 * @example Direct Prompts
 * ```typescript
 * // When you don't want method syntax
 * const response = await model.prompt('Tell me a joke');
 *
 * // Streaming
 * for await (const chunk of model.promptStreaming('Tell me a story')) {
 *   process.stdout.write(chunk);
 * }
 * ```
 *
 * @example Custom Method Formatter
 * ```typescript
 * const model = createAnymethod(backend, {
 *   methodPromptFormatter: (name, args) => {
 *     // Custom format: METHOD_NAME(arg1, arg2, ...)
 *     return `${name.toUpperCase()}(${args.join(', ')})`;
 *   }
 * });
 * ```
 */
export function createAnymethod(
  backend: BackendAdapter,
  config: AnymethodConfig = {}
): Anymethod {
  const {
    model,
    temperature,
    topK,
    topP,
    maxTokens = 1024,
    maxHistorySize = 0,
    initialPrompts = [],
    autoParseJSON = true,
    methodPromptFormatter = formatMethodPrompt,
  } = config;

  // Internal state
  let conversationHistory: IRMessage[] = initialPrompts.map((p) => ({
    role: p.role,
    content: p.content,
  }));
  let _tokensSoFar = 0;

  /**
   * Execute a prompt (non-streaming).
   */
  async function executePrompt(input: string): Promise<string> {
    // Add user message to history
    const userMessage: IRMessage = { role: 'user', content: input };
    conversationHistory.push(userMessage);

    // Build IR request
    const request: IRChatRequest = {
      messages: [...conversationHistory],
      parameters: {
        model,
        temperature,
        topK,
        topP,
        maxTokens,
      },
      stream: false,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'anymethod-wrapper',
        },
      },
    };

    // Execute request
    const response = await backend.execute(request);

    // Add assistant response to history
    conversationHistory.push(response.message);

    // Trim history if configured
    if (maxHistorySize !== undefined && maxHistorySize !== -1) {
      conversationHistory = trimHistory(conversationHistory, maxHistorySize, 'smart');
    }

    // Update token count
    if (response.usage) {
      _tokensSoFar = response.usage.totalTokens;
    } else {
      _tokensSoFar += Math.ceil(input.length / 4);
      const responseText =
        typeof response.message.content === 'string'
          ? response.message.content
          : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
      _tokensSoFar += Math.ceil(responseText.length / 4);
    }

    // Return text content
    return typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
  }

  /**
   * Execute a streaming prompt.
   */
  async function* executeStreamingPrompt(input: string): AsyncIterable<string> {
    // Add user message to history
    const userMessage: IRMessage = { role: 'user', content: input };
    conversationHistory.push(userMessage);

    // Build IR request
    const request: IRChatRequest = {
      messages: [...conversationHistory],
      parameters: {
        model,
        temperature,
        topK,
        topP,
        maxTokens,
      },
      stream: true,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        provenance: {
          frontend: 'anymethod-wrapper',
        },
      },
    };

    let fullContent = '';

    try {
      const stream = backend.executeStream(request);

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          fullContent += chunk.delta;
          yield chunk.delta;
        } else if (chunk.type === 'done') {
          // Add final message to history
          if (chunk.message) {
            conversationHistory.push(chunk.message);
          }

          // Trim history if configured
          if (maxHistorySize !== undefined && maxHistorySize !== -1) {
            conversationHistory = trimHistory(conversationHistory, maxHistorySize, 'smart');
          }

          // Update token count
          if (chunk.usage) {
            _tokensSoFar = chunk.usage.totalTokens;
          } else {
            _tokensSoFar += Math.ceil(input.length / 4);
            _tokensSoFar += Math.ceil(fullContent.length / 4);
          }
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error.message);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create async method proxy.
   */
  const asyncProxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return async (...args: unknown[]): Promise<unknown> => {
          // Convert method call to prompt
          const prompt = methodPromptFormatter(prop, args);

          // Execute prompt
          const result = await executePrompt(prompt);

          // Try to parse as JSON if enabled
          if (autoParseJSON) {
            try {
              return JSON.parse(result);
            } catch {
              // Not JSON, return as string
              return result;
            }
          }

          return result;
        };
      },
    }
  ) as AnymethodProxy;

  /**
   * Create streaming method proxy.
   */
  const streamProxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return async function* (...args: unknown[]): AsyncIterable<string> {
          // Convert method call to prompt
          const prompt = methodPromptFormatter(prop, args);

          // Execute streaming prompt
          yield* executeStreamingPrompt(prompt);
        };
      },
    }
  ) as AnymethodStreamProxy;

  // Create Anymethod instance
  const anymethod: Anymethod = {
    $: asyncProxy,
    $$: streamProxy,

    prompt: (input: string) => executePrompt(input),

    promptStreaming: (input: string) => executeStreamingPrompt(input),

    getHistory: () => [...conversationHistory],

    clearHistory: () => {
      conversationHistory = initialPrompts.map((p) => ({
        role: p.role,
        content: p.content,
      }));
      _tokensSoFar = 0;
    },

    setHistory: (history: IRMessage[]) => {
      conversationHistory = [...history];
    },

    get tokensSoFar(): number {
      return _tokensSoFar;
    },

    get maxTokens(): number {
      return maxTokens;
    },

    get tokensLeft(): number {
      return Math.max(0, maxTokens - _tokensSoFar);
    },
  };

  return anymethod;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a stateless Anymethod instance (no conversation history).
 *
 * @param backend Backend adapter
 * @param config Additional configuration (maxHistorySize will be set to 0)
 * @returns Stateless Anymethod instance
 *
 * @example
 * ```typescript
 * const model = createStatelessAnymethod(backend);
 * await model.$.translate('Hello', 'to Spanish');
 * ```
 */
export function createStatelessAnymethod(
  backend: BackendAdapter,
  config: Omit<AnymethodConfig, 'maxHistorySize'> = {}
): Anymethod {
  return createAnymethod(backend, {
    ...config,
    maxHistorySize: 0,
  });
}

/**
 * Create a conversational Anymethod instance with history management.
 *
 * @param backend Backend adapter
 * @param maxHistorySize Maximum number of message pairs to keep
 * @param config Additional configuration
 * @returns Conversational Anymethod instance
 *
 * @example
 * ```typescript
 * const model = createConversationalAnymethod(backend, 10, {
 *   initialPrompts: [
 *     { role: 'system', content: 'You are helpful.' }
 *   ]
 * });
 * ```
 */
export function createConversationalAnymethod(
  backend: BackendAdapter,
  maxHistorySize: number = 10,
  config: Omit<AnymethodConfig, 'maxHistorySize'> = {}
): Anymethod {
  return createAnymethod(backend, {
    ...config,
    maxHistorySize,
  });
}
