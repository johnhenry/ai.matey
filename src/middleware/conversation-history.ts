/**
 * Conversation History Middleware
 *
 * Manages conversation history across requests with configurable trimming strategies.
 * Maintains a global conversation history that can be accessed and modified by requests.
 *
 * @module
 */

import type { Middleware, MiddlewareContext, MiddlewareNext } from '../types/middleware.js';
import type { IRChatRequest, IRChatResponse, IRMessage } from '../types/ir.js';
import { trimHistory, type TrimStrategy, shouldTrimHistory } from '../utils/conversation-history.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for conversation history middleware.
 */
export interface ConversationHistoryConfig {
  /**
   * Maximum number of message pairs to keep.
   * - 0: No history (stateless)
   * - -1: Unlimited history
   * - N > 0: Keep last N user/assistant pairs
   * @default -1 (unlimited)
   */
  maxHistorySize?: number;

  /**
   * Trimming strategy.
   * - 'fifo': First-in-first-out, remove oldest messages
   * - 'smart': Preserve system messages, trim user/assistant pairs
   * @default 'smart'
   */
  strategy?: TrimStrategy;

  /**
   * Whether to prepend history to each request.
   * If false, history is maintained but not automatically added to requests.
   * @default true
   */
  prependHistory?: boolean;

  /**
   * Whether to append responses to history after each request.
   * @default true
   */
  trackResponses?: boolean;

  /**
   * Initial conversation history.
   * Useful for seeding with system messages or previous conversation.
   * @default []
   */
  initialHistory?: IRMessage[];

  /**
   * Custom filter to determine which messages should be added to history.
   * Return true to include message in history, false to exclude.
   * @default (msg) => true (include all messages)
   */
  messageFilter?: (message: IRMessage) => boolean;
}

/**
 * Conversation history manager for accessing and manipulating history.
 */
export interface ConversationHistoryManager {
  /**
   * Get the current conversation history.
   */
  getHistory(): readonly IRMessage[];

  /**
   * Add a message to the history.
   * @param message Message to add
   */
  addMessage(message: IRMessage): void;

  /**
   * Add multiple messages to the history.
   * @param messages Messages to add
   */
  addMessages(messages: IRMessage[]): void;

  /**
   * Clear the conversation history.
   */
  clear(): void;

  /**
   * Set the conversation history to a specific state.
   * @param history New history state
   */
  setHistory(history: IRMessage[]): void;

  /**
   * Get the number of message pairs in history (excluding system messages).
   */
  getPairCount(): number;

  /**
   * Manually trigger history trimming based on config.
   */
  trim(): void;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create conversation history middleware.
 *
 * Maintains a global conversation history across requests. Automatically prepends
 * history to requests and appends responses to history after completion.
 *
 * @param config Conversation history configuration
 * @returns Conversation history middleware and manager
 *
 * @example Basic Usage
 * ```typescript
 * const { middleware, manager } = createConversationHistoryMiddleware({
 *   maxHistorySize: 10,
 *   strategy: 'smart'
 * });
 *
 * bridge.use(middleware);
 *
 * // Access history
 * console.log('Pairs:', manager.getPairCount());
 * console.log('History:', manager.getHistory());
 *
 * // Clear history when needed
 * manager.clear();
 * ```
 *
 * @example With Initial System Message
 * ```typescript
 * const { middleware } = createConversationHistoryMiddleware({
 *   initialHistory: [
 *     { role: 'system', content: 'You are a helpful assistant.' }
 *   ],
 *   maxHistorySize: 5,
 *   strategy: 'smart' // Preserves system message
 * });
 * ```
 *
 * @example Stateless Mode (No History)
 * ```typescript
 * const { middleware } = createConversationHistoryMiddleware({
 *   maxHistorySize: 0 // No history tracking
 * });
 * ```
 *
 * @example Custom Message Filtering
 * ```typescript
 * const { middleware } = createConversationHistoryMiddleware({
 *   maxHistorySize: 10,
 *   // Only track user and assistant messages, ignore system
 *   messageFilter: (msg) => msg.role !== 'system'
 * });
 * ```
 */
export function createConversationHistoryMiddleware(
  config: ConversationHistoryConfig = {}
): { middleware: Middleware; manager: ConversationHistoryManager } {
  const {
    maxHistorySize = -1,
    strategy = 'smart',
    prependHistory = true,
    trackResponses = true,
    initialHistory = [],
    messageFilter = () => true,
  } = config;

  // Internal conversation history state
  let history: IRMessage[] = [...initialHistory];

  // Create manager for external access
  const manager: ConversationHistoryManager = {
    getHistory: () => [...history],

    addMessage: (message: IRMessage) => {
      if (messageFilter(message)) {
        history.push(message);
        manager.trim();
      }
    },

    addMessages: (messages: IRMessage[]) => {
      for (const message of messages) {
        if (messageFilter(message)) {
          history.push(message);
        }
      }
      manager.trim();
    },

    clear: () => {
      history = [];
    },

    setHistory: (newHistory: IRMessage[]) => {
      history = [...newHistory];
      manager.trim();
    },

    getPairCount: () => {
      const nonSystemMessages = history.filter((m) => m.role !== 'system');
      return Math.floor(nonSystemMessages.length / 2);
    },

    trim: () => {
      if (shouldTrimHistory(history, maxHistorySize, strategy)) {
        history = trimHistory(history, maxHistorySize, strategy);
      }
    },
  };

  // Create middleware
  const middleware: Middleware = async (
    context: MiddlewareContext,
    next: MiddlewareNext
  ): Promise<IRChatResponse> => {
    let request = context.request;

    // Prepend history to request if enabled
    if (prependHistory && maxHistorySize !== 0) {
      const currentHistory = manager.getHistory();

      // Merge history with request messages
      // Filter out duplicate system messages from request if history already has them
      const requestMessages = request.messages.filter((msg, idx) => {
        // Keep all non-system messages
        if (msg.role !== 'system') return true;

        // For system messages, only keep if not already in history
        const existingSystemMessage = currentHistory.find(
          (h) => h.role === 'system' && h.content === msg.content
        );
        return !existingSystemMessage;
      });

      request = {
        ...request,
        messages: [...currentHistory, ...requestMessages],
      };

      context.request = request;
    }

    // Call next middleware/handler
    const response = await next();

    // Track response in history if enabled
    if (trackResponses && maxHistorySize !== 0) {
      // Add the new user message(s) from this request to history
      const newUserMessages = context.request.messages.filter(
        (msg) => msg.role === 'user' || msg.role === 'assistant'
      );

      // Find messages that aren't already in history
      for (const msg of newUserMessages) {
        const alreadyInHistory = history.some(
          (h) =>
            h.role === msg.role &&
            h.content === msg.content &&
            h.timestamp === msg.timestamp
        );

        if (!alreadyInHistory) {
          manager.addMessage(msg);
        }
      }

      // Add assistant response to history
      if (response.message) {
        manager.addMessage(response.message);
      }
    }

    return response;
  };

  return { middleware, manager };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple conversation history middleware with minimal config.
 *
 * @param maxHistorySize Maximum number of message pairs to keep
 * @returns Conversation history middleware
 *
 * @example
 * ```typescript
 * // Keep last 5 message pairs
 * bridge.use(simpleConversationHistory(5));
 * ```
 */
export function simpleConversationHistory(maxHistorySize: number = 10): Middleware {
  const { middleware } = createConversationHistoryMiddleware({ maxHistorySize });
  return middleware;
}

/**
 * Create a stateless conversation history middleware.
 * Useful for explicitly disabling history in a pipeline.
 *
 * @returns Stateless middleware
 *
 * @example
 * ```typescript
 * // Explicitly disable history
 * bridge.use(statelessConversation());
 * ```
 */
export function statelessConversation(): Middleware {
  const { middleware } = createConversationHistoryMiddleware({ maxHistorySize: 0 });
  return middleware;
}

/**
 * Create a conversation history middleware that only tracks user/assistant pairs.
 * System messages from requests are passed through but not tracked.
 *
 * @param maxHistorySize Maximum number of message pairs
 * @returns Conversation history middleware
 *
 * @example
 * ```typescript
 * // Track conversation but not system messages
 * bridge.use(conversationOnlyHistory(10));
 * ```
 */
export function conversationOnlyHistory(maxHistorySize: number = 10): Middleware {
  const { middleware } = createConversationHistoryMiddleware({
    maxHistorySize,
    strategy: 'fifo',
    messageFilter: (msg) => msg.role !== 'system',
  });
  return middleware;
}
