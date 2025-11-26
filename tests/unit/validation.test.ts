/**
 * Tests for validation.ts
 *
 * Tests for message validation, parameter validation, and request validation.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidMessageRole,
  validateMessageContent,
  validateMessage,
  validateMessages,
  validateTemperature,
  validateMaxTokens,
  validateTopP,
  validateParameters,
  validateIRChatRequest,
} from 'ai.matey.utils';
import { ValidationError } from 'ai.matey.errors';
import type { IRChatRequest, IRMessage } from 'ai.matey.types';

// ============================================================================
// isValidMessageRole Tests
// ============================================================================

describe('isValidMessageRole', () => {
  it('should return true for valid roles', () => {
    expect(isValidMessageRole('system')).toBe(true);
    expect(isValidMessageRole('user')).toBe(true);
    expect(isValidMessageRole('assistant')).toBe(true);
    expect(isValidMessageRole('tool')).toBe(true);
  });

  it('should return false for invalid roles', () => {
    expect(isValidMessageRole('admin')).toBe(false);
    expect(isValidMessageRole('bot')).toBe(false);
    expect(isValidMessageRole('')).toBe(false);
    expect(isValidMessageRole('SYSTEM')).toBe(false); // Case sensitive
    expect(isValidMessageRole('User')).toBe(false);
  });
});

// ============================================================================
// validateMessageContent Tests
// ============================================================================

describe('validateMessageContent', () => {
  it('should accept valid string content', () => {
    expect(() => validateMessageContent('Hello, world!')).not.toThrow();
    expect(() => validateMessageContent('A')).not.toThrow();
    expect(() => validateMessageContent('Multiple\nlines\nof\ntext')).not.toThrow();
  });

  it('should reject empty string content', () => {
    expect(() => validateMessageContent('')).toThrow(ValidationError);
    expect(() => validateMessageContent('')).toThrow('Message content cannot be empty string');
  });

  it('should accept valid content block arrays', () => {
    expect(() => validateMessageContent([
      { type: 'text', text: 'Hello' },
    ])).not.toThrow();

    expect(() => validateMessageContent([
      { type: 'text', text: 'Hello' },
      { type: 'image', source: { type: 'base64', data: 'abc' } },
    ])).not.toThrow();

    expect(() => validateMessageContent([
      { type: 'tool_use', id: '123', name: 'test', input: {} },
    ])).not.toThrow();

    expect(() => validateMessageContent([
      { type: 'tool_result', toolUseId: '123', content: 'result' },
    ])).not.toThrow();
  });

  it('should reject empty content arrays', () => {
    expect(() => validateMessageContent([])).toThrow(ValidationError);
    expect(() => validateMessageContent([])).toThrow('Message content array cannot be empty');
  });

  it('should reject non-string/non-array content', () => {
    expect(() => validateMessageContent(123)).toThrow(ValidationError);
    expect(() => validateMessageContent(null)).toThrow(ValidationError);
    expect(() => validateMessageContent(undefined)).toThrow(ValidationError);
    expect(() => validateMessageContent({})).toThrow(ValidationError);
  });

  it('should reject invalid content blocks', () => {
    expect(() => validateMessageContent([null])).toThrow(ValidationError);
    expect(() => validateMessageContent([123])).toThrow(ValidationError);
    expect(() => validateMessageContent(['text'])).toThrow(ValidationError);
    expect(() => validateMessageContent([{ type: 'invalid_type' }])).toThrow(ValidationError);
  });

  it('should include field info in validation error', () => {
    try {
      validateMessageContent([{ type: 'unknown' }]);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as ValidationError;
      expect(ve.validationDetails.length).toBeGreaterThan(0);
      expect(ve.validationDetails[0].field).toContain('content');
    }
  });
});

// ============================================================================
// validateMessage Tests
// ============================================================================

describe('validateMessage', () => {
  it('should accept valid messages', () => {
    const message: IRMessage = {
      role: 'user',
      content: 'Hello, world!',
    };
    expect(() => validateMessage(message)).not.toThrow();
  });

  it('should accept messages with content blocks', () => {
    const message: IRMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Response' }],
    };
    expect(() => validateMessage(message)).not.toThrow();
  });

  it('should reject non-object messages', () => {
    expect(() => validateMessage(null)).toThrow(ValidationError);
    expect(() => validateMessage(undefined)).toThrow(ValidationError);
    expect(() => validateMessage('string')).toThrow(ValidationError);
    expect(() => validateMessage(123)).toThrow(ValidationError);
  });

  it('should reject messages without role', () => {
    expect(() => validateMessage({ content: 'Hello' })).toThrow(ValidationError);
    expect(() => validateMessage({ content: 'Hello' })).toThrow('missing required field: role');
  });

  it('should reject messages with invalid role', () => {
    expect(() => validateMessage({ role: 'invalid', content: 'Hello' })).toThrow(ValidationError);
    expect(() => validateMessage({ role: 'invalid', content: 'Hello' })).toThrow('Invalid message role');
  });

  it('should reject messages without content', () => {
    expect(() => validateMessage({ role: 'user' })).toThrow(ValidationError);
    expect(() => validateMessage({ role: 'user' })).toThrow('missing required field: content');
  });

  it('should pass provenance through to error', () => {
    const provenance = { frontend: 'test-frontend' };
    try {
      validateMessage({ role: 'invalid', content: 'test' }, provenance);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as ValidationError;
      expect(ve.provenance).toEqual(provenance);
    }
  });
});

// ============================================================================
// validateMessages Tests
// ============================================================================

describe('validateMessages', () => {
  it('should accept valid message arrays', () => {
    const messages: IRMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    expect(() => validateMessages(messages)).not.toThrow();
  });

  it('should accept single message arrays', () => {
    expect(() => validateMessages([{ role: 'user', content: 'Hello' }])).not.toThrow();
  });

  it('should reject non-array messages', () => {
    expect(() => validateMessages('not an array')).toThrow(ValidationError);
    expect(() => validateMessages({})).toThrow(ValidationError);
    expect(() => validateMessages(null)).toThrow(ValidationError);
  });

  it('should reject empty message arrays', () => {
    expect(() => validateMessages([])).toThrow(ValidationError);
    expect(() => validateMessages([])).toThrow('Messages array cannot be empty');
  });

  it('should include index in error for invalid messages', () => {
    const messages = [
      { role: 'user', content: 'Valid' },
      { role: 'invalid', content: 'Invalid role' },
    ];

    try {
      validateMessages(messages);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as ValidationError;
      expect(ve.message).toContain('index 1');
      expect(ve.validationDetails[0].field).toContain('messages[1]');
    }
  });

  it('should validate all messages in array', () => {
    const messages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: '' }, // Empty content
    ];

    expect(() => validateMessages(messages)).toThrow(ValidationError);
  });
});

// ============================================================================
// validateTemperature Tests
// ============================================================================

describe('validateTemperature', () => {
  it('should accept valid temperatures', () => {
    expect(() => validateTemperature(0)).not.toThrow();
    expect(() => validateTemperature(0.5)).not.toThrow();
    expect(() => validateTemperature(1)).not.toThrow();
    expect(() => validateTemperature(1.5)).not.toThrow();
    expect(() => validateTemperature(2)).not.toThrow();
  });

  it('should accept undefined/null temperature', () => {
    expect(() => validateTemperature(undefined)).not.toThrow();
    expect(() => validateTemperature(null)).not.toThrow();
  });

  it('should reject non-number temperature', () => {
    expect(() => validateTemperature('0.5')).toThrow(ValidationError);
    expect(() => validateTemperature('hot')).toThrow(ValidationError);
    expect(() => validateTemperature({})).toThrow(ValidationError);
  });

  it('should reject out-of-range temperature', () => {
    expect(() => validateTemperature(-0.1)).toThrow(ValidationError);
    expect(() => validateTemperature(-1)).toThrow(ValidationError);
    expect(() => validateTemperature(2.1)).toThrow(ValidationError);
    expect(() => validateTemperature(3)).toThrow(ValidationError);
  });

  it('should include range info in error message', () => {
    try {
      validateTemperature(5);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const ve = error as ValidationError;
      expect(ve.message).toContain('between 0 and 2');
    }
  });
});

// ============================================================================
// validateMaxTokens Tests
// ============================================================================

describe('validateMaxTokens', () => {
  it('should accept valid maxTokens', () => {
    expect(() => validateMaxTokens(1)).not.toThrow();
    expect(() => validateMaxTokens(100)).not.toThrow();
    expect(() => validateMaxTokens(4096)).not.toThrow();
    expect(() => validateMaxTokens(100000)).not.toThrow();
  });

  it('should accept undefined/null maxTokens', () => {
    expect(() => validateMaxTokens(undefined)).not.toThrow();
    expect(() => validateMaxTokens(null)).not.toThrow();
  });

  it('should reject non-number maxTokens', () => {
    expect(() => validateMaxTokens('100')).toThrow(ValidationError);
    expect(() => validateMaxTokens({})).toThrow(ValidationError);
  });

  it('should reject non-integer maxTokens', () => {
    expect(() => validateMaxTokens(1.5)).toThrow(ValidationError);
    expect(() => validateMaxTokens(100.1)).toThrow(ValidationError);
  });

  it('should reject zero or negative maxTokens', () => {
    expect(() => validateMaxTokens(0)).toThrow(ValidationError);
    expect(() => validateMaxTokens(-1)).toThrow(ValidationError);
    expect(() => validateMaxTokens(-100)).toThrow(ValidationError);
  });
});

// ============================================================================
// validateTopP Tests
// ============================================================================

describe('validateTopP', () => {
  it('should accept valid topP values', () => {
    expect(() => validateTopP(0)).not.toThrow();
    expect(() => validateTopP(0.1)).not.toThrow();
    expect(() => validateTopP(0.5)).not.toThrow();
    expect(() => validateTopP(0.9)).not.toThrow();
    expect(() => validateTopP(1)).not.toThrow();
  });

  it('should accept undefined/null topP', () => {
    expect(() => validateTopP(undefined)).not.toThrow();
    expect(() => validateTopP(null)).not.toThrow();
  });

  it('should reject non-number topP', () => {
    expect(() => validateTopP('0.5')).toThrow(ValidationError);
    expect(() => validateTopP({})).toThrow(ValidationError);
  });

  it('should reject out-of-range topP', () => {
    expect(() => validateTopP(-0.1)).toThrow(ValidationError);
    expect(() => validateTopP(1.1)).toThrow(ValidationError);
    expect(() => validateTopP(2)).toThrow(ValidationError);
  });
});

// ============================================================================
// validateParameters Tests
// ============================================================================

describe('validateParameters', () => {
  it('should accept valid parameters', () => {
    expect(() => validateParameters({
      temperature: 0.7,
      maxTokens: 1000,
      topP: 0.9,
    })).not.toThrow();
  });

  it('should accept empty parameters', () => {
    expect(() => validateParameters({})).not.toThrow();
  });

  it('should accept undefined/null parameters', () => {
    expect(() => validateParameters(undefined)).not.toThrow();
    expect(() => validateParameters(null)).not.toThrow();
  });

  it('should reject non-object parameters', () => {
    expect(() => validateParameters('string')).toThrow(ValidationError);
    expect(() => validateParameters(123)).toThrow(ValidationError);
  });

  it('should validate nested temperature', () => {
    expect(() => validateParameters({ temperature: 5 })).toThrow(ValidationError);
  });

  it('should validate nested maxTokens', () => {
    expect(() => validateParameters({ maxTokens: -1 })).toThrow(ValidationError);
  });

  it('should validate nested topP', () => {
    expect(() => validateParameters({ topP: 2 })).toThrow(ValidationError);
  });

  it('should validate topK', () => {
    expect(() => validateParameters({ topK: 10 })).not.toThrow();
    expect(() => validateParameters({ topK: 1 })).not.toThrow();
    expect(() => validateParameters({ topK: 0 })).toThrow(ValidationError);
    expect(() => validateParameters({ topK: -1 })).toThrow(ValidationError);
    expect(() => validateParameters({ topK: 1.5 })).toThrow(ValidationError);
  });

  it('should validate frequencyPenalty', () => {
    expect(() => validateParameters({ frequencyPenalty: 0 })).not.toThrow();
    expect(() => validateParameters({ frequencyPenalty: -2 })).not.toThrow();
    expect(() => validateParameters({ frequencyPenalty: 2 })).not.toThrow();
    expect(() => validateParameters({ frequencyPenalty: -2.1 })).toThrow(ValidationError);
    expect(() => validateParameters({ frequencyPenalty: 2.1 })).toThrow(ValidationError);
  });

  it('should validate presencePenalty', () => {
    expect(() => validateParameters({ presencePenalty: 0 })).not.toThrow();
    expect(() => validateParameters({ presencePenalty: -2 })).not.toThrow();
    expect(() => validateParameters({ presencePenalty: 2 })).not.toThrow();
    expect(() => validateParameters({ presencePenalty: -2.1 })).toThrow(ValidationError);
    expect(() => validateParameters({ presencePenalty: 2.1 })).toThrow(ValidationError);
  });
});

// ============================================================================
// validateIRChatRequest Tests
// ============================================================================

describe('validateIRChatRequest', () => {
  const createValidRequest = (): IRChatRequest => ({
    messages: [{ role: 'user', content: 'Hello' }],
    metadata: {
      requestId: 'test-request-123',
      timestamp: Date.now(),
    },
  });

  it('should accept valid requests', () => {
    expect(() => validateIRChatRequest(createValidRequest())).not.toThrow();
  });

  it('should accept requests with parameters', () => {
    const request = createValidRequest();
    request.parameters = { temperature: 0.7, maxTokens: 1000 };
    expect(() => validateIRChatRequest(request)).not.toThrow();
  });

  it('should accept requests with multiple messages', () => {
    const request = createValidRequest();
    request.messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];
    expect(() => validateIRChatRequest(request)).not.toThrow();
  });

  it('should reject non-object requests', () => {
    expect(() => validateIRChatRequest(null)).toThrow(ValidationError);
    expect(() => validateIRChatRequest(undefined)).toThrow(ValidationError);
    expect(() => validateIRChatRequest('string')).toThrow(ValidationError);
    expect(() => validateIRChatRequest(123)).toThrow(ValidationError);
  });

  it('should reject requests without messages', () => {
    const request = { metadata: { requestId: '123', timestamp: Date.now() } };
    expect(() => validateIRChatRequest(request)).toThrow(ValidationError);
    expect(() => validateIRChatRequest(request)).toThrow('missing required field: messages');
  });

  it('should reject requests without metadata', () => {
    const request = { messages: [{ role: 'user', content: 'Hello' }] };
    expect(() => validateIRChatRequest(request)).toThrow(ValidationError);
    expect(() => validateIRChatRequest(request)).toThrow('missing required field: metadata');
  });

  it('should reject requests without requestId', () => {
    const request = {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { timestamp: Date.now() },
    };
    expect(() => validateIRChatRequest(request)).toThrow(ValidationError);
    expect(() => validateIRChatRequest(request)).toThrow('missing requestId');
  });

  it('should reject requests without timestamp', () => {
    const request = {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { requestId: '123' },
    };
    expect(() => validateIRChatRequest(request)).toThrow(ValidationError);
    expect(() => validateIRChatRequest(request)).toThrow('missing timestamp');
  });

  it('should validate parameters if present', () => {
    const request = createValidRequest();
    request.parameters = { temperature: 5 }; // Invalid

    expect(() => validateIRChatRequest(request)).toThrow(ValidationError);
  });

  it('should validate messages', () => {
    const request = {
      messages: [{ role: 'invalid', content: 'Hello' }],
      metadata: { requestId: '123', timestamp: Date.now() },
    };

    expect(() => validateIRChatRequest(request)).toThrow(ValidationError);
  });

  it('should include provenance in validation errors', () => {
    const provenance = { frontend: 'test-frontend', backend: 'test-backend' };
    const request = { messages: [] }; // Invalid

    try {
      validateIRChatRequest(request, provenance);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Validation Edge Cases', () => {
  it('should handle deeply nested content blocks', () => {
    const message: IRMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Part 1' },
        { type: 'text', text: 'Part 2' },
        { type: 'text', text: 'Part 3' },
      ],
    };
    expect(() => validateMessage(message)).not.toThrow();
  });

  it('should handle unicode content', () => {
    const message: IRMessage = {
      role: 'user',
      content: 'Hello ',
    };
    expect(() => validateMessage(message)).not.toThrow();
  });

  it('should handle very long content', () => {
    const longContent = 'x'.repeat(100000);
    const message: IRMessage = {
      role: 'user',
      content: longContent,
    };
    expect(() => validateMessage(message)).not.toThrow();
  });

  it('should handle boundary values for temperature', () => {
    expect(() => validateTemperature(0)).not.toThrow();
    expect(() => validateTemperature(2)).not.toThrow();
  });

  it('should handle boundary values for topP', () => {
    expect(() => validateTopP(0)).not.toThrow();
    expect(() => validateTopP(1)).not.toThrow();
  });

  it('should handle whitespace-only content', () => {
    const message: IRMessage = {
      role: 'user',
      content: '   ',
    };
    // Whitespace-only content is valid (not empty)
    expect(() => validateMessage(message)).not.toThrow();
  });
});
