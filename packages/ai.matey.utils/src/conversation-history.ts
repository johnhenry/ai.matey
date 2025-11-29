/**
 * Conversation History Management Utilities
 *
 * Utilities for managing conversation history with configurable trimming strategies.
 * Used by both middleware and wrappers for consistent history management.
 *
 * @module
 */

import type { IRMessage } from 'ai.matey.types';

/**
 * Strategy for trimming conversation history
 */
export type TrimStrategy = 'fifo' | 'smart';

/**
 * Trim conversation history to keep only the most recent messages.
 *
 * @param history - Current conversation history
 * @param maxHistorySize - Maximum number of message pairs to keep
 *                         - 0: Return empty array (no history)
 *                         - -1: Return full history (no trimming)
 *                         - N > 0: Keep last N user/assistant pairs
 * @param strategy - Trimming strategy
 *                   - 'fifo': First-in-first-out, remove oldest messages
 *                   - 'smart': Preserve system messages, trim user/assistant pairs
 * @returns Trimmed history
 *
 * @example
 * ```typescript
 * const history = [
 *   { role: 'system', content: 'You are helpful' },
 *   { role: 'user', content: 'Hi' },
 *   { role: 'assistant', content: 'Hello!' },
 *   { role: 'user', content: 'How are you?' },
 *   { role: 'assistant', content: 'I am well!' },
 * ];
 *
 * // Keep last 1 pair + system message
 * const trimmed = trimHistory(history, 1, 'smart');
 * // Result: system message + last user/assistant pair
 * ```
 */
export function trimHistory(
  history: readonly IRMessage[],
  maxHistorySize: number,
  strategy: TrimStrategy = 'fifo'
): IRMessage[] {
  // No history
  if (maxHistorySize === 0) {
    return [];
  }

  // Unlimited history
  if (maxHistorySize < 0) {
    return Array.from(history);
  }

  // No trimming needed
  if (history.length === 0) {
    return [];
  }

  if (strategy === 'smart') {
    return trimHistorySmart(history, maxHistorySize);
  }

  // FIFO strategy: keep last N pairs (2N messages)
  return trimHistoryFifo(history, maxHistorySize);
}

/**
 * FIFO trimming: Keep last N message pairs
 */
function trimHistoryFifo(history: readonly IRMessage[], maxPairs: number): IRMessage[] {
  const maxMessages = maxPairs * 2;

  if (history.length <= maxMessages) {
    return Array.from(history);
  }

  // Keep last 2N messages
  return Array.from(history.slice(-maxMessages));
}

/**
 * Smart trimming: Preserve system messages, trim user/assistant pairs
 */
function trimHistorySmart(history: readonly IRMessage[], maxPairs: number): IRMessage[] {
  // Separate system messages from conversation
  const systemMessages: IRMessage[] = [];
  const conversationMessages: IRMessage[] = [];

  for (const message of history) {
    if (message.role === 'system') {
      systemMessages.push(message);
    } else {
      conversationMessages.push(message);
    }
  }

  // Trim conversation to last N pairs
  const maxConversationMessages = maxPairs * 2;
  const trimmedConversation =
    conversationMessages.length <= maxConversationMessages
      ? conversationMessages
      : conversationMessages.slice(-maxConversationMessages);

  // Combine: system messages first, then conversation
  return [...systemMessages, ...trimmedConversation];
}

/**
 * Count message pairs in history (excluding system messages)
 *
 * @param history - Conversation history
 * @returns Number of user/assistant pairs
 *
 * @example
 * ```typescript
 * const history = [
 *   { role: 'system', content: 'You are helpful' },
 *   { role: 'user', content: 'Hi' },
 *   { role: 'assistant', content: 'Hello!' },
 * ];
 *
 * countMessagePairs(history); // 1
 * ```
 */
export function countMessagePairs(history: readonly IRMessage[]): number {
  const nonSystemMessages = history.filter((m) => m.role !== 'system');
  return Math.floor(nonSystemMessages.length / 2);
}

/**
 * Check if history needs trimming
 *
 * @param history - Current history
 * @param maxHistorySize - Maximum pairs to keep
 * @param strategy - Trimming strategy
 * @returns True if history exceeds limit
 */
export function shouldTrimHistory(
  history: readonly IRMessage[],
  maxHistorySize: number,
  strategy: TrimStrategy = 'fifo'
): boolean {
  if (maxHistorySize === 0) {
    return history.length > 0;
  }

  if (maxHistorySize < 0) {
    return false;
  }

  if (strategy === 'smart') {
    const pairs = countMessagePairs(history);
    return pairs > maxHistorySize;
  }

  // FIFO: check total message count
  const maxMessages = maxHistorySize * 2;
  return history.length > maxMessages;
}
