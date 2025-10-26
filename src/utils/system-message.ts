/**
 * System Message Normalization Utilities
 *
 * Handles different provider strategies for system messages:
 * - separate-parameter: System as separate parameter (Anthropic)
 * - in-messages: System messages in message array (OpenAI, Gemini)
 * - prepend-user: Prepend system to first user message (some providers)
 * - not-supported: Strip system messages (rare)
 *
 * @module
 */

import type { IRMessage, SystemMessageStrategy } from '../types/ir.js';

// ============================================================================
// System Message Extraction
// ============================================================================

/**
 * Extract system messages from message array.
 *
 * Returns both the system messages and the remaining non-system messages.
 *
 * @param messages Message array
 * @returns Object with system messages and remaining messages
 */
export function extractSystemMessages(messages: readonly IRMessage[]): {
  systemMessages: IRMessage[];
  otherMessages: IRMessage[];
} {
  const systemMessages: IRMessage[] = [];
  const otherMessages: IRMessage[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemMessages.push(message);
    } else {
      otherMessages.push(message);
    }
  }

  return { systemMessages, otherMessages };
}

/**
 * Combine multiple system messages into a single string.
 *
 * @param systemMessages Array of system messages
 * @param separator Separator between messages (default: double newline)
 * @returns Combined system message content
 */
export function combineSystemMessages(systemMessages: readonly IRMessage[], separator = '\n\n'): string {
  return systemMessages
    .map((msg) => {
      if (typeof msg.content === 'string') {
        return msg.content;
      }
      // Extract text from content blocks
      return msg.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join(' ');
    })
    .filter((content) => content.length > 0)
    .join(separator);
}

/**
 * Get first system message as string (for providers that only support one).
 *
 * @param messages Message array
 * @returns First system message content or undefined
 */
export function getFirstSystemMessage(messages: readonly IRMessage[]): string | undefined {
  const systemMessage = messages.find((msg) => msg.role === 'system');
  if (!systemMessage) {
    return undefined;
  }

  if (typeof systemMessage.content === 'string') {
    return systemMessage.content;
  }

  // Extract text from content blocks
  const text = systemMessage.content
    .filter((block) => block.type === 'text')
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join(' ');

  return text.length > 0 ? text : undefined;
}

// ============================================================================
// System Message Normalization
// ============================================================================

/**
 * Normalize system messages according to provider strategy.
 *
 * @param messages Original message array
 * @param strategy System message strategy
 * @param supportsMultiple Whether provider supports multiple system messages
 * @returns Normalized messages and optional system parameter
 */
export function normalizeSystemMessages(
  messages: readonly IRMessage[],
  strategy: SystemMessageStrategy,
  supportsMultiple: boolean = false
): {
  messages: IRMessage[];
  systemParameter?: string;
} {
  const { systemMessages, otherMessages } = extractSystemMessages(messages);

  // No system messages - return as-is
  if (systemMessages.length === 0) {
    return { messages: [...messages] };
  }

  switch (strategy) {
    case 'separate-parameter': {
      // System messages go in separate parameter
      const systemContent = supportsMultiple
        ? combineSystemMessages(systemMessages)
        : getFirstSystemMessage(messages) ?? '';

      return {
        messages: otherMessages,
        systemParameter: systemContent,
      };
    }

    case 'in-messages': {
      // System messages stay in message array
      if (supportsMultiple) {
        // Can keep all system messages
        return { messages: [...messages] };
      } else {
        // Combine multiple system messages into one
        const combinedContent = combineSystemMessages(systemMessages);
        const singleSystemMessage: IRMessage = {
          role: 'system',
          content: combinedContent,
        };
        return {
          messages: [singleSystemMessage, ...otherMessages],
        };
      }
    }

    case 'prepend-user': {
      // Prepend system message to first user message
      const systemContent = combineSystemMessages(systemMessages);

      // Find first user message
      const firstUserIndex = otherMessages.findIndex((msg) => msg.role === 'user');

      if (firstUserIndex === -1) {
        // No user message - just remove system messages
        return { messages: otherMessages };
      }

      const firstUserMessage = otherMessages[firstUserIndex];
      const userContent =
        typeof firstUserMessage?.content === 'string' ? firstUserMessage.content : '';

      // Combine system and user content
      const combinedMessage: IRMessage = {
        role: 'user',
        content: `${systemContent}\n\n${userContent}`,
      };

      // Replace first user message with combined message
      const newMessages = [...otherMessages];
      newMessages[firstUserIndex] = combinedMessage;

      return { messages: newMessages };
    }

    case 'not-supported': {
      // Strip system messages entirely
      return { messages: otherMessages };
    }

    default: {
      // Unknown strategy - return as-is
      return { messages: [...messages] };
    }
  }
}

/**
 * Add system message to message array.
 *
 * Handles prepending or replacing existing system messages based on strategy.
 *
 * @param messages Existing message array
 * @param systemContent System message content to add
 * @param strategy System message strategy
 * @param supportsMultiple Whether provider supports multiple system messages
 * @returns New message array with system message added
 */
export function addSystemMessage(
  messages: readonly IRMessage[],
  systemContent: string,
  strategy: SystemMessageStrategy = 'in-messages',
  supportsMultiple: boolean = false
): IRMessage[] {
  const systemMessage: IRMessage = {
    role: 'system',
    content: systemContent,
  };

  if (strategy === 'separate-parameter') {
    // System handled separately, don't add to messages
    return [...messages];
  }

  if (strategy === 'prepend-user') {
    // Will be prepended to first user message in normalization
    return [systemMessage, ...messages];
  }

  if (strategy === 'not-supported') {
    // System not supported, don't add
    return [...messages];
  }

  // 'in-messages' strategy
  if (supportsMultiple) {
    // Add at beginning
    return [systemMessage, ...messages];
  } else {
    // Replace existing system messages with new one
    const { otherMessages } = extractSystemMessages(messages);
    return [systemMessage, ...otherMessages];
  }
}

/**
 * Check if messages contain any system messages.
 *
 * @param messages Message array
 * @returns true if any message has role 'system'
 */
export function hasSystemMessages(messages: readonly IRMessage[]): boolean {
  return messages.some((msg) => msg.role === 'system');
}

/**
 * Count system messages in array.
 *
 * @param messages Message array
 * @returns Number of system messages
 */
export function countSystemMessages(messages: readonly IRMessage[]): number {
  return messages.filter((msg) => msg.role === 'system').length;
}
