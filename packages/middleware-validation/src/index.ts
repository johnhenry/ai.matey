/**
 * Input Validation & Sanitization Middleware
 *
 * Validates and sanitizes requests to prevent security issues and ensure data quality.
 *
 * @module
 */

import type { Middleware } from 'ai.matey.types';
import type { IRChatRequest, MessageContent } from 'ai.matey.types';

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Warnings (non-blocking)
   */
  warnings: string[];
}

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  /**
   * Whether PII was detected
   */
  detected: boolean;

  /**
   * Types of PII found
   */
  types: string[];

  /**
   * Matched patterns (for debugging)
   */
  matches: Array<{ type: string; value: string }>;
}

/**
 * Content moderation result
 */
export interface ModerationResult {
  /**
   * Whether content is flagged
   */
  flagged: boolean;

  /**
   * Categories flagged
   */
  categories: string[];

  /**
   * Confidence scores
   */
  scores?: Record<string, number>;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /**
   * Maximum number of messages in conversation
   * @default undefined (no limit)
   */
  maxMessages?: number;

  /**
   * Maximum total tokens across all messages
   * @default undefined (no limit)
   */
  maxTotalTokens?: number;

  /**
   * Maximum tokens per message
   * @default undefined (no limit)
   */
  maxTokensPerMessage?: number;

  /**
   * Maximum message content length (characters)
   * @default undefined (no limit)
   */
  maxMessageLength?: number;

  /**
   * Maximum system message length (characters)
   * @default undefined (no limit)
   */
  maxSystemLength?: number;

  /**
   * Allowed message roles
   * @default ['user', 'assistant', 'system']
   */
  allowedRoles?: Array<'user' | 'assistant' | 'system'>;

  /**
   * Block requests with empty messages
   * @default true
   */
  blockEmptyMessages?: boolean;

  /**
   * Detect and handle PII (Personally Identifiable Information)
   * @default false
   */
  detectPII?: boolean;

  /**
   * Action when PII is detected
   * @default 'warn'
   */
  piiAction?: 'block' | 'redact' | 'warn' | 'log';

  /**
   * PII patterns to detect (regex patterns)
   */
  piiPatterns?: Record<string, RegExp>;

  /**
   * Custom PII detector function
   */
  piiDetector?: (text: string) => PIIDetectionResult | Promise<PIIDetectionResult>;

  /**
   * Content moderation callback
   * Return true to block, false to allow
   */
  moderationCallback?: (
    content: string
  ) => ModerationResult | Promise<ModerationResult>;

  /**
   * Block content flagged by moderation
   * @default false
   */
  blockFlaggedContent?: boolean;

  /**
   * Prevent prompt injection attempts
   * @default true
   */
  preventPromptInjection?: boolean;

  /**
   * Prompt injection patterns to detect
   */
  injectionPatterns?: RegExp[];

  /**
   * Sanitize messages before processing
   * @default true
   */
  sanitizeMessages?: boolean;

  /**
   * Custom sanitization function
   */
  sanitizer?: (text: string) => string;

  /**
   * Validate model parameter
   * @default false
   */
  validateModel?: boolean;

  /**
   * Allowed models (if validateModel is true)
   */
  allowedModels?: string[];

  /**
   * Validate temperature parameter
   * @default false
   */
  validateTemperature?: boolean;

  /**
   * Temperature range
   * @default [0, 2]
   */
  temperatureRange?: [number, number];

  /**
   * Custom validation function
   * Return errors to block, empty array to allow
   */
  customValidator?: (
    request: IRChatRequest
  ) => ValidationError[] | Promise<ValidationError[]>;

  /**
   * Throw errors on validation failure
   * @default true
   */
  throwOnError?: boolean;

  /**
   * Log validation warnings
   * @default true
   */
  logWarnings?: boolean;
}

/**
 * Default PII patterns
 */
export const DEFAULT_PII_PATTERNS: Record<string, RegExp> = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // US Social Security Numbers
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // US Phone numbers
  phone: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

  // IP addresses
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

  // API keys (common patterns)
  apiKey: /\b[A-Za-z0-9]{32,}\b/g,
};

/**
 * Default prompt injection patterns
 */
export const DEFAULT_INJECTION_PATTERNS: RegExp[] = [
  // Ignore previous instructions
  /ignore\s+(previous|above|all)\s+(instructions|prompts?|commands?)/i,

  // System prompt manipulation
  /system\s*:\s*new\s+(instruction|prompt|role)/i,

  // Jailbreak attempts
  /\b(jailbreak|DAN|developer\s+mode)\b/i,

  // Role manipulation
  /(you\s+are\s+now|act\s+as\s+if\s+you\s+are)\s+a\s+/i,

  // Instruction override
  /disregard\s+(all|any|previous|above)/i,
];

/**
 * Detect PII in text
 */
export function detectPII(
  text: string,
  patterns: Record<string, RegExp> = DEFAULT_PII_PATTERNS
): PIIDetectionResult {
  const matches: Array<{ type: string; value: string }> = [];
  const types: string[] = [];

  for (const [type, pattern] of Object.entries(patterns)) {
    const found = text.match(pattern);
    if (found && found.length > 0) {
      types.push(type);
      for (const value of found) {
        matches.push({ type, value });
      }
    }
  }

  return {
    detected: matches.length > 0,
    types: Array.from(new Set(types)),
    matches,
  };
}

/**
 * Redact PII from text
 */
export function redactPII(
  text: string,
  patterns: Record<string, RegExp> = DEFAULT_PII_PATTERNS
): string {
  let redacted = text;

  for (const [type, pattern] of Object.entries(patterns)) {
    redacted = redacted.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
  }

  return redacted;
}

/**
 * Detect prompt injection attempts
 */
export function detectPromptInjection(
  text: string,
  patterns: RegExp[] = DEFAULT_INJECTION_PATTERNS
): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitize text content
 */
export function sanitizeText(text: string): string {
  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');

  // Normalize whitespace (but preserve intentional formatting)
  sanitized = sanitized.replace(/\r\n/g, '\n');

  // Remove invisible characters (zero-width, etc.)
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  return sanitized;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Extract text from message content
 */
function extractText(content: string | readonly MessageContent[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { text: string }).text)
    .join('\n');
}

/**
 * Validate request
 */
export async function validateRequest(
  request: IRChatRequest,
  config: ValidationConfig
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate message count
  if (config.maxMessages && request.messages.length > config.maxMessages) {
    errors.push(
      new ValidationError(
        `Too many messages: ${request.messages.length} > ${config.maxMessages}`,
        'messages',
        request.messages.length
      )
    );
  }

  // Validate messages
  let totalTokens = 0;
  const messagesArray = Array.from(request.messages);
  for (let i = 0; i < messagesArray.length; i++) {
    const message = messagesArray[i];
    if (!message) continue;

    // Check allowed roles
    if (config.allowedRoles && !config.allowedRoles.includes(message.role as 'user' | 'assistant' | 'system')) {
      errors.push(
        new ValidationError(
          `Invalid message role: ${message.role}`,
          `messages[${i}].role`,
          message.role
        )
      );
    }

    // Extract text
    const text = extractText(message.content);

    // Check empty messages
    if (config.blockEmptyMessages !== false && text.trim().length === 0) {
      errors.push(
        new ValidationError(
          `Empty message at index ${i}`,
          `messages[${i}].content`,
          text
        )
      );
    }

    // Check message length
    if (config.maxMessageLength && text.length > config.maxMessageLength) {
      errors.push(
        new ValidationError(
          `Message too long: ${text.length} > ${config.maxMessageLength}`,
          `messages[${i}].content`,
          text.length
        )
      );
    }

    // Estimate tokens
    const tokens = estimateTokens(text);
    totalTokens += tokens;

    // Check tokens per message
    if (config.maxTokensPerMessage && tokens > config.maxTokensPerMessage) {
      errors.push(
        new ValidationError(
          `Message tokens exceed limit: ${tokens} > ${config.maxTokensPerMessage}`,
          `messages[${i}].content`,
          tokens
        )
      );
    }

    // Detect PII
    if (config.detectPII) {
      const piiResult = config.piiDetector
        ? await config.piiDetector(text)
        : detectPII(text, config.piiPatterns);

      if (piiResult.detected) {
        const message = `PII detected in message ${i}: ${piiResult.types.join(', ')}`;

        if (config.piiAction === 'block') {
          errors.push(new ValidationError(message, `messages[${i}].content`, piiResult));
        } else if (config.piiAction === 'warn' || config.piiAction === 'log') {
          warnings.push(message);
        }
      }
    }

    // Detect prompt injection
    if (config.preventPromptInjection !== false) {
      const hasInjection = detectPromptInjection(text, config.injectionPatterns);

      if (hasInjection) {
        errors.push(
          new ValidationError(
            `Potential prompt injection detected in message ${i}`,
            `messages[${i}].content`,
            text
          )
        );
      }
    }

    // Content moderation
    if (config.moderationCallback) {
      const modResult = await config.moderationCallback(text);

      if (modResult.flagged) {
        const message = `Content flagged by moderation in message ${i}: ${modResult.categories.join(', ')}`;

        if (config.blockFlaggedContent) {
          errors.push(
            new ValidationError(message, `messages[${i}].content`, modResult)
          );
        } else {
          warnings.push(message);
        }
      }
    }
  }

  // Check total tokens
  if (config.maxTotalTokens && totalTokens > config.maxTotalTokens) {
    errors.push(
      new ValidationError(
        `Total tokens exceed limit: ${totalTokens} > ${config.maxTotalTokens}`,
        'messages',
        totalTokens
      )
    );
  }

  // Validate model
  if (config.validateModel && request.parameters?.model) {
    if (
      config.allowedModels &&
      !config.allowedModels.includes(request.parameters.model)
    ) {
      errors.push(
        new ValidationError(
          `Model not allowed: ${request.parameters.model}`,
          'parameters.model',
          request.parameters.model
        )
      );
    }
  }

  // Validate temperature
  if (config.validateTemperature && request.parameters?.temperature !== undefined) {
    const temp = request.parameters.temperature;
    const [min, max] = config.temperatureRange || [0, 2];

    if (temp < min || temp > max) {
      errors.push(
        new ValidationError(
          `Temperature out of range: ${temp} not in [${min}, ${max}]`,
          'parameters.temperature',
          temp
        )
      );
    }
  }

  // Custom validation
  if (config.customValidator) {
    const customErrors = await config.customValidator(request);
    errors.push(...customErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize request
 */
export function sanitizeRequest(
  request: IRChatRequest,
  config: ValidationConfig
): IRChatRequest {
  if (config.sanitizeMessages === false) {
    return request;
  }

  const sanitizer = config.sanitizer || sanitizeText;

  // Sanitize messages
  const sanitizedMessages = request.messages.map((message) => {
    if (typeof message.content === 'string') {
      return {
        ...message,
        content: sanitizer(message.content),
      };
    }

    return {
      ...message,
      content: message.content.map((content) => {
        if (content.type === 'text') {
          return {
            ...content,
            text: sanitizer(content.text),
          };
        }
        return content;
      }),
    };
  });

  // Redact PII if configured
  if (config.detectPII && config.piiAction === 'redact') {
    const patterns = config.piiPatterns || DEFAULT_PII_PATTERNS;

    return {
      ...request,
      messages: sanitizedMessages.map((message) => {
        if (typeof message.content === 'string') {
          return {
            ...message,
            content: redactPII(message.content, patterns),
          };
        }

        return {
          ...message,
          content: message.content.map((content) => {
            if (content.type === 'text') {
              return {
                ...content,
                text: redactPII(content.text, patterns),
              };
            }
            return content;
          }),
        };
      }),
    };
  }

  return {
    ...request,
    messages: sanitizedMessages,
  };
}

/**
 * Create input validation middleware
 *
 * Validates and sanitizes requests to prevent security issues and ensure data quality.
 *
 * @param config - Validation configuration
 * @returns Middleware function
 *
 * @example Basic Usage
 * ```typescript
 * import { createValidationMiddleware } from 'ai.matey';
 *
 * const validation = createValidationMiddleware({
 *   maxMessages: 100,
 *   maxTotalTokens: 128000,
 *   preventPromptInjection: true,
 * });
 *
 * bridge.use(validation);
 * ```
 *
 * @example PII Detection & Redaction
 * ```typescript
 * const validation = createValidationMiddleware({
 *   detectPII: true,
 *   piiAction: 'redact', // or 'block', 'warn', 'log'
 *   piiPatterns: {
 *     email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
 *     ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
 *   },
 * });
 * ```
 *
 * @example Content Moderation
 * ```typescript
 * const validation = createValidationMiddleware({
 *   moderationCallback: async (content) => {
 *     // Call external moderation API
 *     const result = await moderationAPI.check(content);
 *     return {
 *       flagged: result.flagged,
 *       categories: result.categories,
 *       scores: result.scores,
 *     };
 *   },
 *   blockFlaggedContent: true,
 * });
 * ```
 *
 * @example Custom Validation
 * ```typescript
 * const validation = createValidationMiddleware({
 *   customValidator: async (request) => {
 *     const errors: ValidationError[] = [];
 *
 *     // Custom business logic
 *     if (request.messages.some(m => m.content.includes('forbidden'))) {
 *       errors.push(new ValidationError(
 *         'Forbidden content detected',
 *         'messages',
 *         'forbidden'
 *       ));
 *     }
 *
 *     return errors;
 *   },
 * });
 * ```
 *
 * @example Production Configuration
 * ```typescript
 * const validation = createValidationMiddleware({
 *   maxMessages: 100,
 *   maxTotalTokens: 128000,
 *   maxTokensPerMessage: 32000,
 *   maxMessageLength: 100000,
 *   blockEmptyMessages: true,
 *   detectPII: true,
 *   piiAction: 'redact',
 *   preventPromptInjection: true,
 *   sanitizeMessages: true,
 *   validateModel: true,
 *   allowedModels: ['gpt-4', 'claude-3-sonnet', 'gemini-pro'],
 *   validateTemperature: true,
 *   temperatureRange: [0, 2],
 *   throwOnError: true,
 *   logWarnings: true,
 * });
 * ```
 */
export function createValidationMiddleware(config: ValidationConfig = {}): Middleware {
  return async (context, next) => {
    // Validate request
    const validationResult = await validateRequest(context.request, config);

    // Log warnings
    if (config.logWarnings !== false && validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        console.warn(`[Validation] ${warning}`);
      }
    }

    // Handle validation errors
    if (!validationResult.valid) {
      const errorMessage = validationResult.errors.map((e) => e.message).join('; ');

      if (config.throwOnError !== false) {
        throw new ValidationError(
          `Validation failed: ${errorMessage}`,
          'request',
          validationResult.errors
        );
      }

      // Log errors but continue
      console.error(`[Validation] Errors: ${errorMessage}`);
    }

    // Sanitize request
    context.request = sanitizeRequest(context.request, config);

    // Continue to next middleware
    return await next();
  };
}

/**
 * Create production-ready validation middleware with strict settings
 *
 * @returns Middleware with production validation settings
 *
 * @example
 * ```typescript
 * import { createProductionValidationMiddleware } from 'ai.matey';
 *
 * bridge.use(createProductionValidationMiddleware());
 * ```
 */
export function createProductionValidationMiddleware(): Middleware {
  return createValidationMiddleware({
    maxMessages: 100,
    maxTotalTokens: 128000,
    maxTokensPerMessage: 32000,
    maxMessageLength: 100000,
    blockEmptyMessages: true,
    detectPII: true,
    piiAction: 'redact',
    preventPromptInjection: true,
    sanitizeMessages: true,
    throwOnError: true,
    logWarnings: true,
  });
}

/**
 * Create development-friendly validation middleware with relaxed settings
 *
 * @returns Middleware with development validation settings
 *
 * @example
 * ```typescript
 * import { createDevelopmentValidationMiddleware } from 'ai.matey';
 *
 * bridge.use(createDevelopmentValidationMiddleware());
 * ```
 */
export function createDevelopmentValidationMiddleware(): Middleware {
  return createValidationMiddleware({
    maxMessages: 1000,
    blockEmptyMessages: false,
    detectPII: false,
    preventPromptInjection: false,
    sanitizeMessages: true,
    throwOnError: false,
    logWarnings: true,
  });
}
