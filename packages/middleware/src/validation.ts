/**
 * Input Validation & Sanitization Middleware
 *
 * Validates and sanitizes requests to prevent security issues and ensure data quality.
 *
 * ## Separation of Concerns
 *
 * This middleware focuses on **SECURITY validation**:
 * - PII detection and redaction
 * - Prompt injection prevention
 * - Content moderation
 * - Message length/token limits
 * - Sanitization
 *
 * For **IR format validation** (structural correctness), use ai.matey.utils/validation.ts:
 * - Message structure and content validation
 * - Parameter type and range validation
 * - Request format validation
 *
 * @module
 */

import type { Middleware } from '@johnhenry/aimatey-types';
import type { IRChatRequest, MessageContent } from '@johnhenry/aimatey-types';
import { ValidationError, ErrorCode } from '@johnhenry/aimatey-errors';
import type { ErrorProvenance } from '@johnhenry/aimatey-types';
import { validateIRChatRequest, validateTemperature } from '@johnhenry/aimatey-utils';

/**
 * Helper to create a structured validation error from simple field/value/message
 * @internal
 */
function createValidationError(
  message: string,
  field: string,
  value?: unknown,
  provenance?: ErrorProvenance
): ValidationError {
  return new ValidationError({
    code: ErrorCode.INVALID_REQUEST,
    message,
    validationDetails: [
      {
        field,
        value,
        reason: message,
        expected: 'Valid value',
      },
    ],
    provenance,
  });
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
  moderationCallback?: (content: string) => ModerationResult | Promise<ModerationResult>;

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
   * Action when a prompt injection attempt is detected.
   *
   * Mirrors {@link ValidationConfig.piiAction}:
   * - `'block'` - record a validation error (throws when `throwOnError` is not `false`)
   * - `'warn'` / `'log'` - record a non-blocking warning and let the request through
   * - `'ignore'` - detect nothing (equivalent to `preventPromptInjection: false`)
   *
   * `'warn'` is useful because {@link DEFAULT_INJECTION_PATTERNS} is
   * deliberately broad and can match innocent text.
   *
   * @default 'block'
   */
  injectionAction?: 'block' | 'warn' | 'log' | 'ignore';

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
   * Perform IR format validation before security validation
   * Uses ai.matey.utils/validation.ts for structural correctness
   * @default false
   */
  validateIRFormat?: boolean;

  /**
   * Validate temperature parameter using ai.matey.utils
   * @default false
   * @deprecated Use validateIRFormat instead for comprehensive parameter validation
   */
  validateTemperature?: boolean;

  /**
   * Temperature range (only used if validateTemperature is true)
   * @default [0, 2]
   * @deprecated Temperature validation now uses ai.matey.utils range (0-2)
   */
  temperatureRange?: [number, number];

  /**
   * Custom validation function
   * Return errors to block, empty array to allow
   */
  customValidator?: (request: IRChatRequest) => ValidationError[] | Promise<ValidationError[]>;

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

  /**
   * Prefix for console output, so a message can be traced back to the
   * middleware that produced it. `createSecurityMiddleware` passes `'Security'`.
   * @default 'Validation'
   */
  logPrefix?: string;
}

/**
 * Vendor-issued credential shapes, as alternation sources for
 * {@link DEFAULT_PII_PATTERNS}`.apiKey`.
 *
 * Every entry is anchored on a literal prefix the issuing vendor puts there
 * precisely so that a leaked credential can be recognised. Length alone is not
 * a signal and is not used: a 40-character run of hex is a git SHA far more
 * often than it is a secret, and no entropy test can separate the two - they
 * have the same entropy. See {@link DEFAULT_PII_PATTERNS}.
 *
 * Ordering matters. More specific prefixes come before the generic ones that
 * would otherwise shadow them (`sk-ant-api03-` before `sk-`), because
 * alternation takes the first branch that matches at a given position.
 *
 * @internal
 */
const API_KEY_SOURCES: readonly string[] = [
  // AWS access key ids: a four-character type prefix + 16 uppercase alphanumerics.
  'A(?:KIA|SIA|BIA|CCA|ROA|IDA|IPA|NPA|NVA|GPA)[A-Z0-9]{16,}',

  // Google / Firebase / Gemini API keys.
  'AIza[A-Za-z0-9_-]{35,}',

  // GitHub: classic PATs and OAuth/app tokens, plus fine-grained PATs.
  'gh[pousr]_[A-Za-z0-9]{36,}',
  'github_pat_[A-Za-z0-9_]{50,}',

  // GitLab: personal access, deploy, feed, runner, trigger and CI job tokens.
  'gl(?:pat|dt|ft|rt|ptt|cbt)-[A-Za-z0-9_-]{20,}',

  // Slack bot/user/legacy tokens and app-level tokens.
  'xox[abeoprs]-[A-Za-z0-9-]{10,}',
  'xapp-\\d-[A-Za-z0-9-]{10,}',

  // OpenAI (project, service-account, admin), Anthropic, OpenRouter.
  'sk-(?:proj|svcacct|admin|None|ant-api\\d{2}|ant-admin\\d{2}|or-v1)-[A-Za-z0-9_-]{20,}',
  // OpenAI classic keys and other `sk-` vendors. 32 rather than 20 so that a
  // hyphenated identifier that happens to start with `sk-` cannot match.
  'sk-[A-Za-z0-9]{32,}',

  // Other AI vendors with fixed prefixes.
  'gsk_[A-Za-z0-9]{20,}', // Groq
  'xai-[A-Za-z0-9]{20,}', // xAI
  'pplx-[A-Za-z0-9]{20,}', // Perplexity
  'r8_[A-Za-z0-9]{20,}', // Replicate
  'hf_[A-Za-z0-9]{20,}', // Hugging Face

  // Payments and commerce.
  '[sr]k_(?:live|test|prod)_[A-Za-z0-9]{16,}', // Stripe secret / restricted
  'shp(?:at|ca|pa|ss)_[A-Fa-f0-9]{32,}', // Shopify

  // Registries, PaaS and mail.
  'npm_[A-Za-z0-9]{36,}',
  'dop_v1_[a-f0-9]{64,}', // DigitalOcean
  'sbp_[a-f0-9]{40,}', // Supabase
  'SG\\.[A-Za-z0-9_-]{22,}\\.[A-Za-z0-9_-]{43,}', // SendGrid
];

/**
 * A single dotted-quad octet: 0-255, no leading zeros beyond a bare `0`.
 * @internal
 */
const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

/**
 * Words that mark a following dotted quad as a version, not an address.
 * @internal
 */
const VERSION_MARKER = '(?:v|ver|rev|version|release|build)';

/**
 * Default PII patterns.
 *
 * These run **by default** wherever `detectPII` is enabled -
 * `createProductionValidationMiddleware`, and `createSecurityMiddleware`, which
 * redacts by default - so a false positive is not a cosmetic problem. It
 * silently rewrites the user's message and then asks the model to reason about
 * `[REDACTED_APIKEY]`. The patterns are therefore tuned for precision on
 * ordinary developer text (#67).
 *
 * Two of them are deliberately narrower than the naive version:
 *
 * - `apiKey` requires a **vendor prefix** ({@link API_KEY_SOURCES}), not a
 *   length. The previous `/\b[A-Za-z0-9]{32,}\b/` matched every git SHA, every
 *   dashless UUID, and every base64 id. Entropy is not an available fix - a git
 *   SHA is uniformly random hex, so it scores as high as any secret. The cost
 *   is that an *unprefixed* secret (Mistral, Cohere and other vendors issue
 *   bare alphanumeric keys) is no longer matched; the benefit is that prefixed
 *   ones now are, which the length rule missed entirely because `_` breaks
 *   `\b` (`ghp_...` was never detected) and `AKIA...` is only 20 characters.
 *   To restore length-based matching, add it back explicitly:
 *
 *   ```typescript
 *   piiPatterns: { ...DEFAULT_PII_PATTERNS, longToken: /\b[A-Za-z0-9]{32,}\b/g }
 *   ```
 *
 * - `ipAddress` validates octet ranges and skips quads introduced by a version
 *   marker, so `version 1.2.3.4` and `v1.2.3.4` are left alone. A bare
 *   four-segment version string is **genuinely ambiguous**: `1.2.3.4` is both a
 *   valid IPv4 address and a valid four-part version, and nothing in the text
 *   distinguishes them. With no marker word present this pattern reads it as an
 *   address. That is a choice, not a determination.
 *
 * Uses lookbehind (ES2018), so it needs Node 18+ / Safari 16.4+ - already
 * implied by this package's ES2022 target.
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

  // IPv4 addresses, with valid octets and no version-marker prefix.
  // The trailing `(?!\.\d)` keeps `1.2.3.4.5` from matching its own prefix
  // while still allowing a sentence-final `10.0.0.1.`
  ipAddress: new RegExp(
    `(?<!\\b${VERSION_MARKER}\\.?\\s{0,2})(?<!\\d\\.)\\b${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}\\b(?!\\.\\d)`,
    'gi'
  ),

  // API keys, by vendor prefix rather than by length.
  apiKey: new RegExp(`\\b(?:${API_KEY_SOURCES.join('|')})`, 'g'),
};

/**
 * Default prompt injection patterns.
 *
 * `preventPromptInjection` defaults to `true` and `injectionAction` to
 * `'block'`, so anything matched here throws under a bare
 * `createValidationMiddleware({})`. Patterns therefore have to earn their place
 * against ordinary text, not just against attacks (#67): the named jailbreaks
 * below require surrounding context rather than a bare token.
 */
export const DEFAULT_INJECTION_PATTERNS: RegExp[] = [
  // Ignore previous instructions
  /ignore\s+(previous|above|all)\s+(instructions|prompts?|commands?)/i,

  // System prompt manipulation
  /system\s*:\s*new\s+(instruction|prompt|role)/i,

  // Jailbreak, as a bare term. Unlike `DAN` and `developer mode` below, this
  // word has no high-frequency innocent sense in assistant traffic.
  /\bjailbreak\b/i,

  // The "DAN" jailbreak.
  //
  // `DAN` is matched CASE-SENSITIVELY and only next to jailbreak framing. The
  // three letters on their own are not a signal at any severity: `Dan` is a
  // common personal name, so the previous case-insensitive `\bDAN\b`
  // classified "Hi Dan, can you review this?" as an attack and - with the
  // default config - threw on it. The real jailbreak is a multi-sentence
  // roleplay prompt that always writes the acronym in capitals.
  /\bDAN\b[^\n]{0,40}?\b(?:mode|prompt|jailbreak|persona|enabled?|do\s+anything\s+now)\b/,
  // `act as DAN` / `you are DAN` / `pretend to be DAN` / `you are now DAN`.
  // `is` and `called` are left out on purpose - "the DAN report is DAN
  // certified" should not be an attack.
  /\b(?:as|are|be|now|become)\s+(?:an?\s+|the\s+)?DAN\b/,
  // The expansion, but only in a roleplay frame - "I can't do anything now"
  // is ordinary English, so the phrase by itself is not enough.
  /\b(?:act(?:ing)?\s+as|pretend(?:ing)?\s+to\s+be|stands?\s+for|known\s+as|roleplay(?:ing)?\s+as|you\s+are(?:\s+now)?)\b[^\n]{0,40}?\bdo\s+anything\s+now\b/i,

  // The "Developer Mode" jailbreak, likewise with context. A bare
  // `developer\s+mode` flagged "How do I enable developer mode on Android?",
  // which is an ordinary question for the coding assistants this library is
  // built for. `enable` is pointedly *not* a context word for that reason.
  /\bdeveloper\s+mode\s+(?:enabled|output|response)\b/i,
  /\b(?:act(?:ing)?\s+as|pretend(?:ing)?\s+to\s+be|roleplay(?:ing)?|simulate|you\s+are)\b[^\n]{0,40}?\bdeveloper\s+mode\b/i,

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

  // Perform IR format validation first if enabled
  if (config.validateIRFormat) {
    try {
      validateIRChatRequest(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
        // If format validation fails, return early as security checks may not make sense
        return { valid: false, errors, warnings };
      }
      throw error;
    }
  }

  // Validate message count
  if (config.maxMessages && request.messages.length > config.maxMessages) {
    errors.push(
      createValidationError(
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
    if (!message) {
      continue;
    }

    // Check allowed roles
    if (
      config.allowedRoles &&
      !config.allowedRoles.includes(message.role as 'user' | 'assistant' | 'system')
    ) {
      errors.push(
        createValidationError(
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
        createValidationError(`Empty message at index ${i}`, `messages[${i}].content`, text)
      );
    }

    // Check message length
    if (config.maxMessageLength && text.length > config.maxMessageLength) {
      errors.push(
        createValidationError(
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
        createValidationError(
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
          errors.push(createValidationError(message, `messages[${i}].content`, piiResult));
        } else if (config.piiAction === 'warn' || config.piiAction === 'log') {
          warnings.push(message);
        }
      }
    }

    // Detect prompt injection
    const injectionAction = config.injectionAction ?? 'block';
    if (config.preventPromptInjection !== false && injectionAction !== 'ignore') {
      const hasInjection = detectPromptInjection(text, config.injectionPatterns);

      if (hasInjection) {
        const injectionMessage = `Potential prompt injection detected in message ${i}`;

        if (injectionAction === 'block') {
          errors.push(createValidationError(injectionMessage, `messages[${i}].content`, text));
        } else {
          warnings.push(injectionMessage);
        }
      }
    }

    // Content moderation
    if (config.moderationCallback) {
      const modResult = await config.moderationCallback(text);

      if (modResult.flagged) {
        const message = `Content flagged by moderation in message ${i}: ${modResult.categories.join(', ')}`;

        if (config.blockFlaggedContent) {
          errors.push(createValidationError(message, `messages[${i}].content`, modResult));
        } else {
          warnings.push(message);
        }
      }
    }
  }

  // Check total tokens
  if (config.maxTotalTokens && totalTokens > config.maxTotalTokens) {
    errors.push(
      createValidationError(
        `Total tokens exceed limit: ${totalTokens} > ${config.maxTotalTokens}`,
        'messages',
        totalTokens
      )
    );
  }

  // Validate model
  if (config.validateModel && request.parameters?.model) {
    if (config.allowedModels && !config.allowedModels.includes(request.parameters.model)) {
      errors.push(
        createValidationError(
          `Model not allowed: ${request.parameters.model}`,
          'parameters.model',
          request.parameters.model
        )
      );
    }
  }

  // Validate temperature (deprecated - use validateIRFormat instead)
  if (config.validateTemperature && request.parameters?.temperature !== undefined) {
    try {
      validateTemperature(request.parameters.temperature);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        throw error;
      }
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
export function sanitizeRequest(request: IRChatRequest, config: ValidationConfig): IRChatRequest {
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
 * import { createValidationMiddleware } from '@johnhenry/aimatey';
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
  const logPrefix = config.logPrefix ?? 'Validation';

  return async (context, next) => {
    // Validate request
    const validationResult = await validateRequest(context.request, config);

    // Log warnings
    if (config.logWarnings !== false && validationResult.warnings.length > 0) {
      for (const warning of validationResult.warnings) {
        console.warn(`[${logPrefix}] ${warning}`);
      }
    }

    // Handle validation errors
    if (!validationResult.valid) {
      const errorMessage = validationResult.errors.map((e) => e.message).join('; ');

      if (config.throwOnError !== false) {
        throw createValidationError(
          `Validation failed: ${errorMessage}`,
          'request',
          validationResult.errors
        );
      }

      // Log errors but continue
      console.error(`[${logPrefix}] Errors: ${errorMessage}`);
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
 * import { createProductionValidationMiddleware } from '@johnhenry/aimatey';
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
 * import { createDevelopmentValidationMiddleware } from '@johnhenry/aimatey';
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
