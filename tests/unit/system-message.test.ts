/**
 * System Message Tests
 *
 * Tests for system message normalization utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  extractSystemMessages,
  combineSystemMessages,
  getFirstSystemMessage,
  normalizeSystemMessages,
  addSystemMessage,
  hasSystemMessages,
  countSystemMessages,
} from 'ai.matey.utils';
import type { IRMessage } from 'ai.matey.types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMessage(role: 'system' | 'user' | 'assistant', content: string): IRMessage {
  return { role, content };
}

function createMessageWithBlocks(
  role: 'system' | 'user' | 'assistant',
  texts: string[]
): IRMessage {
  return {
    role,
    content: texts.map((text) => ({ type: 'text' as const, text })),
  };
}

// ============================================================================
// extractSystemMessages Tests
// ============================================================================

describe('extractSystemMessages', () => {
  it('should extract system messages from array', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System prompt'),
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    const { systemMessages, otherMessages } = extractSystemMessages(messages);

    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toBe('System prompt');
    expect(otherMessages).toHaveLength(2);
  });

  it('should handle empty array', () => {
    const { systemMessages, otherMessages } = extractSystemMessages([]);

    expect(systemMessages).toHaveLength(0);
    expect(otherMessages).toHaveLength(0);
  });

  it('should handle array with no system messages', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    const { systemMessages, otherMessages } = extractSystemMessages(messages);

    expect(systemMessages).toHaveLength(0);
    expect(otherMessages).toHaveLength(2);
  });

  it('should handle array with only system messages', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
    ];

    const { systemMessages, otherMessages } = extractSystemMessages(messages);

    expect(systemMessages).toHaveLength(2);
    expect(otherMessages).toHaveLength(0);
  });

  it('should extract multiple system messages', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('user', 'Hello'),
      createMessage('system', 'System 2'),
      createMessage('assistant', 'Hi'),
    ];

    const { systemMessages, otherMessages } = extractSystemMessages(messages);

    expect(systemMessages).toHaveLength(2);
    expect(systemMessages[0].content).toBe('System 1');
    expect(systemMessages[1].content).toBe('System 2');
    expect(otherMessages).toHaveLength(2);
  });

  it('should preserve order of other messages', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'User 1'),
      createMessage('system', 'System'),
      createMessage('assistant', 'Assistant 1'),
      createMessage('user', 'User 2'),
    ];

    const { otherMessages } = extractSystemMessages(messages);

    expect(otherMessages[0].content).toBe('User 1');
    expect(otherMessages[1].content).toBe('Assistant 1');
    expect(otherMessages[2].content).toBe('User 2');
  });
});

// ============================================================================
// combineSystemMessages Tests
// ============================================================================

describe('combineSystemMessages', () => {
  it('should combine multiple system messages with default separator', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'First system'),
      createMessage('system', 'Second system'),
    ];

    const combined = combineSystemMessages(messages);

    expect(combined).toBe('First system\n\nSecond system');
  });

  it('should use custom separator', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'First'),
      createMessage('system', 'Second'),
    ];

    const combined = combineSystemMessages(messages, ' | ');

    expect(combined).toBe('First | Second');
  });

  it('should handle single message', () => {
    const messages = [createMessage('system', 'Only one')];

    const combined = combineSystemMessages(messages);

    expect(combined).toBe('Only one');
  });

  it('should handle empty array', () => {
    const combined = combineSystemMessages([]);

    expect(combined).toBe('');
  });

  it('should handle content blocks', () => {
    const messages: IRMessage[] = [
      createMessageWithBlocks('system', ['Block 1', 'Block 2']),
      createMessage('system', 'String content'),
    ];

    const combined = combineSystemMessages(messages);

    expect(combined).toContain('Block 1');
    expect(combined).toContain('Block 2');
    expect(combined).toContain('String content');
  });

  it('should filter empty content', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'Has content'),
      createMessage('system', ''),
      createMessage('system', 'Also has content'),
    ];

    const combined = combineSystemMessages(messages);

    expect(combined).toBe('Has content\n\nAlso has content');
  });

  it('should join text blocks with space', () => {
    const messages: IRMessage[] = [createMessageWithBlocks('system', ['Part 1', 'Part 2'])];

    const combined = combineSystemMessages(messages);

    expect(combined).toBe('Part 1 Part 2');
  });
});

// ============================================================================
// getFirstSystemMessage Tests
// ============================================================================

describe('getFirstSystemMessage', () => {
  it('should return first system message content', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('system', 'First system'),
      createMessage('system', 'Second system'),
    ];

    const first = getFirstSystemMessage(messages);

    expect(first).toBe('First system');
  });

  it('should return undefined when no system message', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    const first = getFirstSystemMessage(messages);

    expect(first).toBeUndefined();
  });

  it('should return undefined for empty array', () => {
    const first = getFirstSystemMessage([]);

    expect(first).toBeUndefined();
  });

  it('should handle content blocks', () => {
    const messages: IRMessage[] = [
      createMessageWithBlocks('system', ['Block text']),
    ];

    const first = getFirstSystemMessage(messages);

    expect(first).toBe('Block text');
  });

  it('should return undefined for empty content blocks', () => {
    const messages: IRMessage[] = [
      { role: 'system', content: [] },
    ];

    const first = getFirstSystemMessage(messages);

    expect(first).toBeUndefined();
  });

  it('should join multiple text blocks', () => {
    const messages: IRMessage[] = [
      createMessageWithBlocks('system', ['Part 1', 'Part 2']),
    ];

    const first = getFirstSystemMessage(messages);

    expect(first).toBe('Part 1 Part 2');
  });
});

// ============================================================================
// normalizeSystemMessages Tests - separate-parameter strategy
// ============================================================================

describe('normalizeSystemMessages - separate-parameter', () => {
  it('should move system messages to systemParameter', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System prompt'),
      createMessage('user', 'Hello'),
    ];

    const result = normalizeSystemMessages(messages, 'separate-parameter');

    expect(result.systemParameter).toBe('System prompt');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
  });

  it('should combine multiple system messages when supportsMultiple is true', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
      createMessage('user', 'Hello'),
    ];

    const result = normalizeSystemMessages(messages, 'separate-parameter', true);

    expect(result.systemParameter).toBe('System 1\n\nSystem 2');
    expect(result.messages).toHaveLength(1);
  });

  it('should use only first system message when supportsMultiple is false', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
      createMessage('user', 'Hello'),
    ];

    const result = normalizeSystemMessages(messages, 'separate-parameter', false);

    expect(result.systemParameter).toBe('System 1');
  });

  it('should handle no system messages', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    const result = normalizeSystemMessages(messages, 'separate-parameter');

    expect(result.systemParameter).toBeUndefined();
    expect(result.messages).toHaveLength(2);
  });
});

// ============================================================================
// normalizeSystemMessages Tests - in-messages strategy
// ============================================================================

describe('normalizeSystemMessages - in-messages', () => {
  it('should keep system messages in array when supportsMultiple is true', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
      createMessage('user', 'Hello'),
    ];

    const result = normalizeSystemMessages(messages, 'in-messages', true);

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[1].role).toBe('system');
    expect(result.systemParameter).toBeUndefined();
  });

  it('should combine system messages into one when supportsMultiple is false', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('user', 'User 1'),
      createMessage('system', 'System 2'),
      createMessage('assistant', 'Assistant 1'),
    ];

    const result = normalizeSystemMessages(messages, 'in-messages', false);

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toBe('System 1\n\nSystem 2');
    expect(result.messages[1].role).toBe('user');
    expect(result.messages[2].role).toBe('assistant');
  });

  it('should handle single system message', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'Only system'),
      createMessage('user', 'Hello'),
    ];

    const result = normalizeSystemMessages(messages, 'in-messages', false);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe('Only system');
  });
});

// ============================================================================
// normalizeSystemMessages Tests - prepend-user strategy
// ============================================================================

describe('normalizeSystemMessages - prepend-user', () => {
  it('should prepend system content to first user message', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System prompt'),
      createMessage('user', 'User message'),
    ];

    const result = normalizeSystemMessages(messages, 'prepend-user');

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('System prompt\n\nUser message');
    expect(result.systemParameter).toBeUndefined();
  });

  it('should combine multiple system messages before prepending', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
      createMessage('user', 'User message'),
    ];

    const result = normalizeSystemMessages(messages, 'prepend-user');

    expect(result.messages[0].content).toBe('System 1\n\nSystem 2\n\nUser message');
  });

  it('should handle no user message', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System prompt'),
      createMessage('assistant', 'Assistant only'),
    ];

    const result = normalizeSystemMessages(messages, 'prepend-user');

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('assistant');
  });

  it('should find first user message even if not first', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System'),
      createMessage('assistant', 'Previous response'),
      createMessage('user', 'User question'),
    ];

    const result = normalizeSystemMessages(messages, 'prepend-user');

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('assistant');
    expect(result.messages[1].role).toBe('user');
    expect(result.messages[1].content).toContain('System');
    expect(result.messages[1].content).toContain('User question');
  });
});

// ============================================================================
// normalizeSystemMessages Tests - not-supported strategy
// ============================================================================

describe('normalizeSystemMessages - not-supported', () => {
  it('should strip system messages entirely', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System prompt'),
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    const result = normalizeSystemMessages(messages, 'not-supported');

    expect(result.messages).toHaveLength(2);
    expect(result.messages.every((m) => m.role !== 'system')).toBe(true);
    expect(result.systemParameter).toBeUndefined();
  });

  it('should handle all system messages', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
    ];

    const result = normalizeSystemMessages(messages, 'not-supported');

    expect(result.messages).toHaveLength(0);
  });
});

// ============================================================================
// normalizeSystemMessages Tests - edge cases
// ============================================================================

describe('normalizeSystemMessages - edge cases', () => {
  it('should handle empty array', () => {
    const result = normalizeSystemMessages([], 'in-messages');

    expect(result.messages).toHaveLength(0);
    expect(result.systemParameter).toBeUndefined();
  });

  it('should handle no system messages', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    const result = normalizeSystemMessages(messages, 'separate-parameter');

    expect(result.messages).toEqual(messages);
    expect(result.systemParameter).toBeUndefined();
  });

  it('should return copy of messages, not original', () => {
    const messages: IRMessage[] = [createMessage('user', 'Hello')];

    const result = normalizeSystemMessages(messages, 'in-messages');

    expect(result.messages).not.toBe(messages);
  });

  it('should handle unknown strategy by returning as-is', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System'),
      createMessage('user', 'Hello'),
    ];

    const result = normalizeSystemMessages(messages, 'unknown-strategy' as any);

    expect(result.messages).toHaveLength(2);
  });
});

// ============================================================================
// addSystemMessage Tests
// ============================================================================

describe('addSystemMessage', () => {
  describe('with in-messages strategy', () => {
    it('should add system message at beginning when supportsMultiple', () => {
      const messages: IRMessage[] = [
        createMessage('user', 'Hello'),
      ];

      const result = addSystemMessage(messages, 'New system', 'in-messages', true);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('New system');
    });

    it('should replace existing system messages when not supportsMultiple', () => {
      const messages: IRMessage[] = [
        createMessage('system', 'Old system'),
        createMessage('user', 'Hello'),
      ];

      const result = addSystemMessage(messages, 'New system', 'in-messages', false);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('New system');
    });

    it('should replace multiple existing system messages', () => {
      const messages: IRMessage[] = [
        createMessage('system', 'Old 1'),
        createMessage('system', 'Old 2'),
        createMessage('user', 'Hello'),
      ];

      const result = addSystemMessage(messages, 'New system', 'in-messages', false);

      expect(result).toHaveLength(2);
      expect(countSystemMessages(result)).toBe(1);
      expect(result[0].content).toBe('New system');
    });
  });

  describe('with separate-parameter strategy', () => {
    it('should not add to messages (handled separately)', () => {
      const messages: IRMessage[] = [
        createMessage('user', 'Hello'),
      ];

      const result = addSystemMessage(messages, 'System', 'separate-parameter');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });
  });

  describe('with prepend-user strategy', () => {
    it('should add system message for later normalization', () => {
      const messages: IRMessage[] = [
        createMessage('user', 'Hello'),
      ];

      const result = addSystemMessage(messages, 'System', 'prepend-user');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
    });
  });

  describe('with not-supported strategy', () => {
    it('should not add system message', () => {
      const messages: IRMessage[] = [
        createMessage('user', 'Hello'),
      ];

      const result = addSystemMessage(messages, 'System', 'not-supported');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });
  });

  it('should default to in-messages strategy', () => {
    const messages: IRMessage[] = [createMessage('user', 'Hello')];

    const result = addSystemMessage(messages, 'System');

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
  });

  it('should return copy of messages, not original', () => {
    const messages: IRMessage[] = [createMessage('user', 'Hello')];

    const result = addSystemMessage(messages, 'System', 'separate-parameter');

    expect(result).not.toBe(messages);
  });
});

// ============================================================================
// hasSystemMessages Tests
// ============================================================================

describe('hasSystemMessages', () => {
  it('should return true when system messages exist', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System'),
      createMessage('user', 'Hello'),
    ];

    expect(hasSystemMessages(messages)).toBe(true);
  });

  it('should return false when no system messages', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    expect(hasSystemMessages(messages)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(hasSystemMessages([])).toBe(false);
  });

  it('should handle multiple system messages', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
    ];

    expect(hasSystemMessages(messages)).toBe(true);
  });

  it('should find system message anywhere in array', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
      createMessage('system', 'Late system'),
    ];

    expect(hasSystemMessages(messages)).toBe(true);
  });
});

// ============================================================================
// countSystemMessages Tests
// ============================================================================

describe('countSystemMessages', () => {
  it('should count system messages', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('user', 'Hello'),
      createMessage('system', 'System 2'),
    ];

    expect(countSystemMessages(messages)).toBe(2);
  });

  it('should return 0 for no system messages', () => {
    const messages: IRMessage[] = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ];

    expect(countSystemMessages(messages)).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(countSystemMessages([])).toBe(0);
  });

  it('should count all system messages', () => {
    const messages: IRMessage[] = [
      createMessage('system', 'System 1'),
      createMessage('system', 'System 2'),
      createMessage('system', 'System 3'),
    ];

    expect(countSystemMessages(messages)).toBe(3);
  });
});
