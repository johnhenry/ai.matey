/**
 * Validation Utilities
 *
 * Core validation functions for IR requests, messages, and parameters.
 *
 * @module
 */

import type {
  IRChatRequest,
  IRMessage,
  IRParameters,
  MessageContent,
  MessageRole,
} from 'ai.matey.types';
import { ValidationError, ErrorCode as ErrorCodeEnum } from 'ai.matey.errors';
import type { ErrorProvenance } from 'ai.matey.types';

// ============================================================================
// Message Validation
// ============================================================================

/**
 * Validate message role.
 */
export function isValidMessageRole(role: string): role is MessageRole {
  return ['system', 'user', 'assistant', 'tool'].includes(role);
}

/**
 * Validate message content.
 */
export function validateMessageContent(content: unknown, provenance?: ErrorProvenance): void {
  if (typeof content === 'string') {
    if (content.length === 0) {
      throw new ValidationError({
        code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
        message: 'Message content cannot be empty string',
        validationDetails: [
          {
            field: 'content',
            value: content,
            reason: 'Content must be non-empty string or content blocks',
            expected: 'Non-empty string or array of content blocks',
          },
        ],
        provenance,
      });
    }
    return;
  }

  if (!Array.isArray(content)) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Message content must be string or array of content blocks',
      validationDetails: [
        {
          field: 'content',
          value: content,
          reason: 'Invalid content type',
          expected: 'string or ContentBlock[]',
        },
      ],
      provenance,
    });
  }

  if (content.length === 0) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Message content array cannot be empty',
      validationDetails: [
        {
          field: 'content',
          value: content,
          reason: 'Content array must contain at least one block',
          expected: 'Non-empty array',
        },
      ],
      provenance,
    });
  }

  // Validate each content block
  content.forEach((block, index) => {
    if (!block || typeof block !== 'object') {
      throw new ValidationError({
        code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
        message: `Invalid content block at index ${index}`,
        validationDetails: [
          {
            field: `content[${index}]`,
            value: block,
            reason: 'Content block must be an object',
            expected: 'ContentBlock object',
          },
        ],
        provenance,
      });
    }

    const blockType = (block as MessageContent).type;
    if (!['text', 'image', 'tool_use', 'tool_result'].includes(blockType)) {
      throw new ValidationError({
        code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
        message: `Invalid content block type: ${blockType}`,
        validationDetails: [
          {
            field: `content[${index}].type`,
            value: blockType,
            reason: 'Unknown content block type',
            expected: 'text, image, tool_use, or tool_result',
          },
        ],
        provenance,
      });
    }
  });
}

/**
 * Validate a single message.
 */
export function validateMessage(
  message: unknown,
  provenance?: ErrorProvenance
): asserts message is IRMessage {
  if (!message || typeof message !== 'object') {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Message must be an object',
      validationDetails: [
        {
          field: 'message',
          value: message,
          reason: 'Invalid message type',
          expected: 'IRMessage object',
        },
      ],
      provenance,
    });
  }

  const msg = message as Partial<IRMessage>;

  // Validate role
  if (!msg.role) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Message missing required field: role',
      validationDetails: [
        {
          field: 'role',
          value: undefined,
          reason: 'Role is required',
          expected: 'system, user, assistant, or tool',
        },
      ],
      provenance,
    });
  }

  if (!isValidMessageRole(msg.role)) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: `Invalid message role: ${String(msg.role)}`,
      validationDetails: [
        {
          field: 'role',
          value: msg.role,
          reason: 'Invalid role value',
          expected: 'system, user, assistant, or tool',
        },
      ],
      provenance,
    });
  }

  // Validate content
  if (msg.content === undefined) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Message missing required field: content',
      validationDetails: [
        {
          field: 'content',
          value: undefined,
          reason: 'Content is required',
          expected: 'string or ContentBlock[]',
        },
      ],
      provenance,
    });
  }

  validateMessageContent(msg.content, provenance);
}

/**
 * Validate messages array.
 */
export function validateMessages(
  messages: unknown,
  provenance?: ErrorProvenance
): asserts messages is IRMessage[] {
  if (!Array.isArray(messages)) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Messages must be an array',
      validationDetails: [
        {
          field: 'messages',
          value: messages,
          reason: 'Invalid messages type',
          expected: 'Array of IRMessage',
        },
      ],
      provenance,
    });
  }

  if (messages.length === 0) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
      message: 'Messages array cannot be empty',
      validationDetails: [
        {
          field: 'messages',
          value: messages,
          reason: 'At least one message is required',
          expected: 'Non-empty array',
        },
      ],
      provenance,
    });
  }

  messages.forEach((message, index) => {
    try {
      validateMessage(message, provenance);
    } catch (error) {
      if (error instanceof ValidationError) {
        // Add index to field names
        const details = error.validationDetails.map((detail) => ({
          ...detail,
          field: `messages[${index}].${detail.field}`,
        }));
        throw new ValidationError({
          code: ErrorCodeEnum.INVALID_MESSAGE_FORMAT,
          message: `Invalid message at index ${index}: ${error.message}`,
          validationDetails: details,
          provenance,
        });
      }
      throw error;
    }
  });
}

// ============================================================================
// Parameter Validation
// ============================================================================

/**
 * Validate temperature parameter.
 */
export function validateTemperature(temperature: unknown, provenance?: ErrorProvenance): void {
  if (temperature === undefined || temperature === null) {
    return;
  }

  if (typeof temperature !== 'number') {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'Temperature must be a number',
      validationDetails: [
        {
          field: 'temperature',
          value: temperature,
          reason: 'Invalid type',
          expected: 'number',
        },
      ],
      provenance,
    });
  }

  if (temperature < 0 || temperature > 2) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'Temperature must be between 0 and 2',
      validationDetails: [
        {
          field: 'temperature',
          value: temperature,
          reason: 'Out of range',
          expected: '0 <= temperature <= 2',
        },
      ],
      provenance,
    });
  }
}

/**
 * Validate maxTokens parameter.
 */
export function validateMaxTokens(maxTokens: unknown, provenance?: ErrorProvenance): void {
  if (maxTokens === undefined || maxTokens === null) {
    return;
  }

  if (typeof maxTokens !== 'number') {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'maxTokens must be a number',
      validationDetails: [
        {
          field: 'maxTokens',
          value: maxTokens,
          reason: 'Invalid type',
          expected: 'number',
        },
      ],
      provenance,
    });
  }

  if (!Number.isInteger(maxTokens) || maxTokens < 1) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'maxTokens must be a positive integer',
      validationDetails: [
        {
          field: 'maxTokens',
          value: maxTokens,
          reason: 'Invalid value',
          expected: 'Positive integer',
        },
      ],
      provenance,
    });
  }
}

/**
 * Validate topP parameter.
 */
export function validateTopP(topP: unknown, provenance?: ErrorProvenance): void {
  if (topP === undefined || topP === null) {
    return;
  }

  if (typeof topP !== 'number') {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'topP must be a number',
      validationDetails: [
        {
          field: 'topP',
          value: topP,
          reason: 'Invalid type',
          expected: 'number',
        },
      ],
      provenance,
    });
  }

  if (topP < 0 || topP > 1) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'topP must be between 0 and 1',
      validationDetails: [
        {
          field: 'topP',
          value: topP,
          reason: 'Out of range',
          expected: '0 <= topP <= 1',
        },
      ],
      provenance,
    });
  }
}

/**
 * Validate parameters object.
 */
export function validateParameters(
  parameters: unknown,
  provenance?: ErrorProvenance
): asserts parameters is IRParameters {
  if (parameters === undefined || parameters === null) {
    return;
  }

  if (typeof parameters !== 'object') {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_PARAMETERS,
      message: 'Parameters must be an object',
      validationDetails: [
        {
          field: 'parameters',
          value: parameters,
          reason: 'Invalid type',
          expected: 'IRParameters object',
        },
      ],
      provenance,
    });
  }

  const params = parameters as Partial<IRParameters>;

  // Validate individual parameters
  validateTemperature(params.temperature, provenance);
  validateMaxTokens(params.maxTokens, provenance);
  validateTopP(params.topP, provenance);

  // Validate topK
  if (params.topK !== undefined && params.topK !== null) {
    if (typeof params.topK !== 'number' || !Number.isInteger(params.topK) || params.topK < 1) {
      throw new ValidationError({
        code: ErrorCodeEnum.INVALID_PARAMETERS,
        message: 'topK must be a positive integer',
        validationDetails: [
          {
            field: 'topK',
            value: params.topK,
            reason: 'Invalid value',
            expected: 'Positive integer',
          },
        ],
        provenance,
      });
    }
  }

  // Validate penalties
  if (params.frequencyPenalty !== undefined && params.frequencyPenalty !== null) {
    if (
      typeof params.frequencyPenalty !== 'number' ||
      params.frequencyPenalty < -2 ||
      params.frequencyPenalty > 2
    ) {
      throw new ValidationError({
        code: ErrorCodeEnum.INVALID_PARAMETERS,
        message: 'frequencyPenalty must be between -2 and 2',
        validationDetails: [
          {
            field: 'frequencyPenalty',
            value: params.frequencyPenalty,
            reason: 'Out of range',
            expected: '-2 <= frequencyPenalty <= 2',
          },
        ],
        provenance,
      });
    }
  }

  if (params.presencePenalty !== undefined && params.presencePenalty !== null) {
    if (
      typeof params.presencePenalty !== 'number' ||
      params.presencePenalty < -2 ||
      params.presencePenalty > 2
    ) {
      throw new ValidationError({
        code: ErrorCodeEnum.INVALID_PARAMETERS,
        message: 'presencePenalty must be between -2 and 2',
        validationDetails: [
          {
            field: 'presencePenalty',
            value: params.presencePenalty,
            reason: 'Out of range',
            expected: '-2 <= presencePenalty <= 2',
          },
        ],
        provenance,
      });
    }
  }
}

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Validate IR chat request.
 */
export function validateIRChatRequest(
  request: unknown,
  provenance?: ErrorProvenance
): asserts request is IRChatRequest {
  if (!request || typeof request !== 'object') {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_REQUEST,
      message: 'Request must be an object',
      validationDetails: [
        {
          field: 'request',
          value: request,
          reason: 'Invalid request type',
          expected: 'IRChatRequest object',
        },
      ],
      provenance,
    });
  }

  const req = request as Partial<IRChatRequest>;

  // Validate messages
  if (!req.messages) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_REQUEST,
      message: 'Request missing required field: messages',
      validationDetails: [
        {
          field: 'messages',
          value: undefined,
          reason: 'Messages array is required',
          expected: 'Non-empty array of IRMessage',
        },
      ],
      provenance,
    });
  }

  validateMessages(req.messages, provenance);

  // Validate parameters if present
  if (req.parameters !== undefined) {
    validateParameters(req.parameters, provenance);
  }

  // Validate metadata
  if (!req.metadata) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_REQUEST,
      message: 'Request missing required field: metadata',
      validationDetails: [
        {
          field: 'metadata',
          value: undefined,
          reason: 'Metadata is required',
          expected: 'IRMetadata object',
        },
      ],
      provenance,
    });
  }

  if (!req.metadata.requestId) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_REQUEST,
      message: 'Request metadata missing requestId',
      validationDetails: [
        {
          field: 'metadata.requestId',
          value: undefined,
          reason: 'Request ID is required',
          expected: 'string',
        },
      ],
      provenance,
    });
  }

  if (!req.metadata.timestamp) {
    throw new ValidationError({
      code: ErrorCodeEnum.INVALID_REQUEST,
      message: 'Request metadata missing timestamp',
      validationDetails: [
        {
          field: 'metadata.timestamp',
          value: undefined,
          reason: 'Timestamp is required',
          expected: 'number',
        },
      ],
      provenance,
    });
  }
}
