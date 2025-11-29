/**
 * Conversation History Tests
 *
 * Tests for conversation history management utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  trimHistory,
  countMessagePairs,
  shouldTrimHistory,
} from 'ai.matey.utils';
import type { IRMessage } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMessage(role: 'system' | 'user' | 'assistant', content: string): IRMessage {
  return { role, content };
}

function createConversation(pairs: number, includeSystem = false): IRMessage[] {
  const messages: IRMessage[] = [];
  if (includeSystem) {
    messages.push(createMessage('system', 'You are a helpful assistant'));
  }
  for (let i = 1; i <= pairs; i++) {
    messages.push(createMessage('user', `User message ${i}`));
    messages.push(createMessage('assistant', `Assistant response ${i}`));
  }
  return messages;
}

// ============================================================================
// trimHistory Tests
// ============================================================================

describe('trimHistory', () => {
  describe('with maxHistorySize = 0', () => {
    it('should return empty array for empty history', () => {
      const result = trimHistory([], 0);
      expect(result).toEqual([]);
    });

    it('should return empty array regardless of history content', () => {
      const history = createConversation(5, true);
      const result = trimHistory(history, 0);
      expect(result).toEqual([]);
    });

    it('should return empty array with fifo strategy', () => {
      const history = createConversation(3);
      const result = trimHistory(history, 0, 'fifo');
      expect(result).toEqual([]);
    });

    it('should return empty array with smart strategy', () => {
      const history = createConversation(3, true);
      const result = trimHistory(history, 0, 'smart');
      expect(result).toEqual([]);
    });
  });

  describe('with maxHistorySize = -1 (unlimited)', () => {
    it('should return full history for empty array', () => {
      const result = trimHistory([], -1);
      expect(result).toEqual([]);
    });

    it('should return full history unchanged', () => {
      const history = createConversation(10, true);
      const result = trimHistory(history, -1);
      expect(result).toHaveLength(history.length);
      expect(result).toEqual(history);
    });

    it('should return a copy, not the original array', () => {
      const history = createConversation(3);
      const result = trimHistory(history, -1);
      expect(result).not.toBe(history);
      expect(result).toEqual(history);
    });
  });

  describe('with FIFO strategy (default)', () => {
    it('should return empty array for empty history', () => {
      const result = trimHistory([], 5, 'fifo');
      expect(result).toEqual([]);
    });

    it('should keep all messages when under limit', () => {
      const history = createConversation(2);
      const result = trimHistory(history, 5, 'fifo');
      expect(result).toHaveLength(4);
      expect(result).toEqual(history);
    });

    it('should keep exactly maxHistorySize pairs when at limit', () => {
      const history = createConversation(3);
      const result = trimHistory(history, 3, 'fifo');
      expect(result).toHaveLength(6);
    });

    it('should trim to last N pairs when over limit', () => {
      const history = createConversation(5);
      const result = trimHistory(history, 2, 'fifo');
      expect(result).toHaveLength(4);
      // Should be the last 2 pairs (messages 4 and 5)
      expect(result[0].content).toBe('User message 4');
      expect(result[1].content).toBe('Assistant response 4');
      expect(result[2].content).toBe('User message 5');
      expect(result[3].content).toBe('Assistant response 5');
    });

    it('should trim system messages in FIFO mode', () => {
      const history = createConversation(3, true); // system + 3 pairs = 7 messages
      const result = trimHistory(history, 2, 'fifo');
      expect(result).toHaveLength(4);
      // System message should be trimmed away in FIFO
      expect(result.every(m => m.role !== 'system')).toBe(true);
    });

    it('should handle single pair', () => {
      const history = createConversation(1);
      const result = trimHistory(history, 1, 'fifo');
      expect(result).toHaveLength(2);
    });

    it('should handle odd number of messages', () => {
      const history = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi'),
        createMessage('user', 'How are you?'),
      ];
      const result = trimHistory(history, 1, 'fifo');
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hi');
      expect(result[1].content).toBe('How are you?');
    });
  });

  describe('with smart strategy', () => {
    it('should return empty array for empty history', () => {
      const result = trimHistory([], 5, 'smart');
      expect(result).toEqual([]);
    });

    it('should preserve system messages when trimming', () => {
      const history = createConversation(5, true);
      const result = trimHistory(history, 2, 'smart');

      // Should have system message + 2 pairs = 5 messages
      expect(result).toHaveLength(5);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('You are a helpful assistant');
    });

    it('should keep last N pairs after system messages', () => {
      const history = createConversation(5, true);
      const result = trimHistory(history, 2, 'smart');

      // Last 2 pairs should be messages 4 and 5
      expect(result[1].content).toBe('User message 4');
      expect(result[2].content).toBe('Assistant response 4');
      expect(result[3].content).toBe('User message 5');
      expect(result[4].content).toBe('Assistant response 5');
    });

    it('should preserve multiple system messages', () => {
      const history: IRMessage[] = [
        createMessage('system', 'System 1'),
        createMessage('system', 'System 2'),
        createMessage('user', 'User 1'),
        createMessage('assistant', 'Assistant 1'),
        createMessage('user', 'User 2'),
        createMessage('assistant', 'Assistant 2'),
      ];
      const result = trimHistory(history, 1, 'smart');

      // Should have 2 system + 1 pair = 4 messages
      expect(result).toHaveLength(4);
      expect(result[0].content).toBe('System 1');
      expect(result[1].content).toBe('System 2');
      expect(result[2].content).toBe('User 2');
      expect(result[3].content).toBe('Assistant 2');
    });

    it('should handle history with only system messages', () => {
      const history: IRMessage[] = [
        createMessage('system', 'System 1'),
        createMessage('system', 'System 2'),
      ];
      const result = trimHistory(history, 2, 'smart');

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('System 1');
      expect(result[1].content).toBe('System 2');
    });

    it('should handle history without system messages', () => {
      const history = createConversation(5, false);
      const result = trimHistory(history, 2, 'smart');

      expect(result).toHaveLength(4);
      expect(result[0].content).toBe('User message 4');
    });

    it('should keep all conversation when under limit', () => {
      const history = createConversation(2, true);
      const result = trimHistory(history, 5, 'smart');

      expect(result).toHaveLength(5); // system + 2 pairs
      expect(result).toEqual(history);
    });

    it('should handle system messages interspersed in conversation', () => {
      const history: IRMessage[] = [
        createMessage('system', 'Initial system'),
        createMessage('user', 'User 1'),
        createMessage('assistant', 'Assistant 1'),
        createMessage('system', 'Mid-conversation system'),
        createMessage('user', 'User 2'),
        createMessage('assistant', 'Assistant 2'),
      ];
      const result = trimHistory(history, 1, 'smart');

      // Should preserve both system messages + last pair
      expect(result).toHaveLength(4);
      expect(result[0].content).toBe('Initial system');
      expect(result[1].content).toBe('Mid-conversation system');
      expect(result[2].content).toBe('User 2');
      expect(result[3].content).toBe('Assistant 2');
    });
  });

  describe('default strategy', () => {
    it('should default to fifo strategy', () => {
      const history = createConversation(3, true);
      const fifoResult = trimHistory(history, 1, 'fifo');
      const defaultResult = trimHistory(history, 1);

      expect(defaultResult).toEqual(fifoResult);
    });
  });
});

// ============================================================================
// countMessagePairs Tests
// ============================================================================

describe('countMessagePairs', () => {
  it('should return 0 for empty history', () => {
    expect(countMessagePairs([])).toBe(0);
  });

  it('should return 0 for system-only messages', () => {
    const history: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
    ];
    expect(countMessagePairs(history)).toBe(0);
  });

  it('should count user/assistant pairs', () => {
    const history = createConversation(3);
    expect(countMessagePairs(history)).toBe(3);
  });

  it('should exclude system messages from count', () => {
    const history = createConversation(3, true);
    expect(countMessagePairs(history)).toBe(3);
  });

  it('should handle odd number of non-system messages', () => {
    const history: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
      createMessage('user', 'How are you?'),
    ];
    expect(countMessagePairs(history)).toBe(1);
  });

  it('should handle single user message', () => {
    const history: IRMessage[] = [
      createMessage('user', 'Hello'),
    ];
    expect(countMessagePairs(history)).toBe(0);
  });

  it('should handle large conversation', () => {
    const history = createConversation(100, true);
    expect(countMessagePairs(history)).toBe(100);
  });

  it('should count correctly with multiple system messages interspersed', () => {
    const history: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('user', 'User 1'),
      createMessage('assistant', 'Assistant 1'),
      createMessage('system', 'System 2'),
      createMessage('user', 'User 2'),
      createMessage('assistant', 'Assistant 2'),
      createMessage('system', 'System 3'),
    ];
    expect(countMessagePairs(history)).toBe(2);
  });
});

// ============================================================================
// shouldTrimHistory Tests
// ============================================================================

describe('shouldTrimHistory', () => {
  describe('with maxHistorySize = 0', () => {
    it('should return false for empty history', () => {
      expect(shouldTrimHistory([], 0)).toBe(false);
    });

    it('should return true for any non-empty history', () => {
      const history = [createMessage('user', 'Hello')];
      expect(shouldTrimHistory(history, 0)).toBe(true);
    });

    it('should return true for system-only messages', () => {
      const history = [createMessage('system', 'System')];
      expect(shouldTrimHistory(history, 0)).toBe(true);
    });
  });

  describe('with maxHistorySize = -1 (unlimited)', () => {
    it('should always return false for empty history', () => {
      expect(shouldTrimHistory([], -1)).toBe(false);
    });

    it('should always return false regardless of history size', () => {
      const history = createConversation(100, true);
      expect(shouldTrimHistory(history, -1)).toBe(false);
    });
  });

  describe('with FIFO strategy', () => {
    it('should return false when under limit', () => {
      const history = createConversation(2);
      expect(shouldTrimHistory(history, 5, 'fifo')).toBe(false);
    });

    it('should return false when at exact limit', () => {
      const history = createConversation(3);
      expect(shouldTrimHistory(history, 3, 'fifo')).toBe(false);
    });

    it('should return true when over limit', () => {
      const history = createConversation(5);
      expect(shouldTrimHistory(history, 3, 'fifo')).toBe(true);
    });

    it('should count all messages including system in FIFO', () => {
      const history = createConversation(2, true); // 5 messages
      // 5 messages > 2*2 = 4, so should trim
      expect(shouldTrimHistory(history, 2, 'fifo')).toBe(true);
    });
  });

  describe('with smart strategy', () => {
    it('should return false when pairs under limit', () => {
      const history = createConversation(2, true);
      expect(shouldTrimHistory(history, 5, 'smart')).toBe(false);
    });

    it('should return false when pairs at exact limit', () => {
      const history = createConversation(3, true);
      expect(shouldTrimHistory(history, 3, 'smart')).toBe(false);
    });

    it('should return true when pairs over limit', () => {
      const history = createConversation(5, true);
      expect(shouldTrimHistory(history, 3, 'smart')).toBe(true);
    });

    it('should not count system messages as pairs', () => {
      const history: IRMessage[] = [
        createMessage('system', 'System 1'),
        createMessage('system', 'System 2'),
        createMessage('system', 'System 3'),
        createMessage('user', 'User 1'),
        createMessage('assistant', 'Assistant 1'),
      ];
      // Only 1 pair, so should not need trimming for maxHistorySize=2
      expect(shouldTrimHistory(history, 2, 'smart')).toBe(false);
    });
  });

  describe('default strategy', () => {
    it('should default to fifo strategy', () => {
      const history = createConversation(5);
      const fifoResult = shouldTrimHistory(history, 3, 'fifo');
      const defaultResult = shouldTrimHistory(history, 3);

      expect(defaultResult).toBe(fifoResult);
    });
  });
});
