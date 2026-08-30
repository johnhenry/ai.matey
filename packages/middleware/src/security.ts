/**
 * Security Middleware
 *
 * Protects the request on its way to a provider, and computes an HTTP response
 * header policy for a host application to apply.
 *
 * ## What this middleware does
 *
 * 1. **Request protection (the part that runs at request time).** Message
 *    content is sanitized and PII is redacted before the request reaches the
 *    backend, and prompt-injection attempts are detected. This is the security
 *    boundary that matters for an LLM call: whatever survives this middleware
 *    is what a third-party provider sees.
 * 2. **Response header policy (advisory).** `Content-Security-Policy`,
 *    `Strict-Transport-Security`, `X-Frame-Options` and friends are *browser
 *    response* headers. They are meaningless as request headers to a provider
 *    API, so this middleware does not send them anywhere. It computes the
 *    policy and exposes it two ways:
 *    - {@link buildSecurityHeaders} - a pure function, for
 *      `createCoreHandler({ headers: buildSecurityHeaders() })`, which is the
 *      supported way to actually emit them on HTTP responses.
 *    - `request.metadata.custom.securityHeaders`, readable via
 *      {@link getSecurityHeaders}, for a host application that wants the policy
 *      per request.
 *
 * ## Relationship to `createValidationMiddleware`
 *
 * There is exactly one PII implementation in this package. The primitives
 * ({@link detectPII}, {@link redactPII}, {@link detectPromptInjection},
 * {@link sanitizeText}, {@link sanitizeRequest}) live in `./validation.js`, and
 * `createSecurityMiddleware` **delegates to `createValidationMiddleware`**
 * rather than reimplementing them.
 *
 * The split is preset vs. knobs:
 * - `createSecurityMiddleware` - a small, opinionated, security-only surface
 *   that is safe by default.
 * - {@link createValidationMiddleware} - the full configuration surface, and
 *   the only place for data-quality validation (message counts, token limits,
 *   allowed models, moderation callbacks, `piiAction: 'block' | 'warn'`).
 *
 * Register only one of them unless you genuinely want both sets of rules; they
 * compose correctly (sanitization is idempotent, redaction runs on already
 * redacted text unchanged) but you will pay for the work twice.
 *
 * @module
 */

import type {
  IRChatRequest,
  IRWarning,
  Middleware,
  MessageContent,
} from '@johnhenry/aimatey-types';
import { createWarning } from '@johnhenry/aimatey-utils';
import {
  createValidationMiddleware,
  detectPII,
  DEFAULT_PII_PATTERNS,
  type ValidationConfig,
} from './validation.js';

/**
 * Marker emitted by `redactPII` for every replacement it makes.
 * @internal
 */
const REDACTION_MARKER = '[REDACTED_';

/**
 * Security configuration
 */
export interface SecurityConfig {
  // ==========================================================================
  // Request protection - applied to the outgoing IR request
  // ==========================================================================

  /**
   * Redact PII from message content before the request reaches the backend.
   *
   * Uses {@link redactPII} with {@link DEFAULT_PII_PATTERNS} unless
   * {@link SecurityConfig.piiPatterns} is supplied. Each match is replaced with
   * `[REDACTED_<TYPE>]` and a `content-redacted` {@link IRWarning} is attached
   * to `request.metadata.warnings`.
   *
   * Set to `false` to pass content through untouched. For `block` / `warn`
   * behaviour instead of redaction, use
   * `createValidationMiddleware({ detectPII: true, piiAction: 'block' })`.
   *
   * @default true
   */
  redactPII?: boolean;

  /**
   * PII patterns used for redaction.
   *
   * Note that {@link DEFAULT_PII_PATTERNS} errs towards over-matching: its
   * `apiKey` pattern matches any run of 32+ alphanumeric characters (a git SHA,
   * a base64 id), and `ipAddress` matches dotted-quad version strings such as
   * `1.2.3.4`. Supply your own patterns if a false positive would damage
   * legitimate content, and watch for the `content-redacted` warning to see
   * when redaction fired.
   *
   * @default DEFAULT_PII_PATTERNS
   */
  piiPatterns?: Record<string, RegExp>;

  /**
   * Action when a prompt-injection attempt is detected.
   *
   * - `'warn'` - log a warning and let the request through (default)
   * - `'log'` - same as `'warn'`
   * - `'block'` - throw a `ValidationError`
   * - `'ignore'` - do not run injection detection
   *
   * The default is `'warn'` rather than `'block'` because
   * {@link DEFAULT_INJECTION_PATTERNS} is a regex heuristic, and a heuristic
   * that throws is a bad default for a middleware you register once and forget.
   * It no longer matches bare tokens such as `DAN` (#67), but phrase patterns
   * like `disregard all` still catch some innocent text. Use `'block'`, or
   * {@link createProductionSecurityMiddleware}, once you have tuned
   * {@link SecurityConfig.injectionPatterns} for your traffic.
   *
   * @default 'warn'
   */
  promptInjectionAction?: 'block' | 'warn' | 'log' | 'ignore';

  /**
   * Prompt-injection patterns to detect.
   * @default DEFAULT_INJECTION_PATTERNS
   */
  injectionPatterns?: RegExp[];

  /**
   * Sanitize message content: strip null bytes and zero-width characters, and
   * normalize CRLF. Zero-width characters in particular are a standard way to
   * smuggle instructions past a human reviewer.
   *
   * @default true
   */
  sanitizeContent?: boolean;

  /**
   * Custom sanitizer, replacing {@link sanitizeText}.
   */
  sanitizer?: (text: string) => string;

  /**
   * Log non-blocking findings (prompt-injection warnings) to the console.
   * @default true
   */
  logWarnings?: boolean;

  // ==========================================================================
  // HTTP response header policy - advisory, see the module docs
  // ==========================================================================

  /**
   * Content Security Policy
   * @default "default-src 'self'"
   */
  contentSecurityPolicy?: string | false;

  /**
   * X-Content-Type-Options header
   * @default "nosniff"
   */
  contentTypeOptions?: string | false;

  /**
   * X-Frame-Options header
   * @default "DENY"
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;

  /**
   * X-XSS-Protection header
   * @default "1; mode=block"
   */
  xssProtection?: string | false;

  /**
   * Strict-Transport-Security header
   * @default "max-age=31536000; includeSubDomains"
   */
  hsts?: string | false;

  /**
   * Referrer-Policy header
   * @default "strict-origin-when-cross-origin"
   */
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | false;

  /**
   * Permissions-Policy header
   * @default "geolocation=(), microphone=(), camera=()"
   */
  permissionsPolicy?: string | false;

  /**
   * X-Powered-By header (should be removed for security)
   * @default false (header removed)
   */
  poweredBy?: string | false;

  /**
   * Additional custom headers
   */
  customHeaders?: Record<string, string>;
}

/**
 * Header-policy portion of {@link SecurityConfig}.
 */
export type SecurityHeaderConfig = Pick<
  SecurityConfig,
  | 'contentSecurityPolicy'
  | 'contentTypeOptions'
  | 'frameOptions'
  | 'xssProtection'
  | 'hsts'
  | 'referrerPolicy'
  | 'permissionsPolicy'
  | 'poweredBy'
  | 'customHeaders'
>;

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: Required<Omit<SecurityHeaderConfig, 'customHeaders'>> = {
  contentSecurityPolicy: "default-src 'self'",
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  xssProtection: '1; mode=block',
  hsts: 'max-age=31536000; includeSubDomains',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  poweredBy: false,
};

/**
 * Metadata key under `request.metadata.custom` holding the header policy.
 */
export const SECURITY_HEADERS_METADATA_KEY = 'securityHeaders';

/**
 * Build the HTTP response header policy described by a {@link SecurityConfig}.
 *
 * These are **response** headers for a browser. Nothing in ai.matey sends them
 * upstream to a provider - pass them to the HTTP layer instead:
 *
 * @example
 * ```typescript
 * import { createCoreHandler } from '@johnhenry/aimatey-http-core';
 * import { buildSecurityHeaders } from '@johnhenry/aimatey-middleware';
 *
 * const handler = createCoreHandler({
 *   bridge,
 *   headers: buildSecurityHeaders({ frameOptions: 'SAMEORIGIN' }),
 * });
 * ```
 *
 * @param config - Header policy configuration
 * @returns Header name/value pairs. `X-Powered-By` maps to `''` when
 *   `poweredBy` is `false`, signalling "remove this header".
 */
export function buildSecurityHeaders(config: SecurityHeaderConfig = {}): Record<string, string> {
  const merged = { ...DEFAULT_SECURITY_CONFIG, ...config };
  const headers: Record<string, string> = {};

  if (merged.contentSecurityPolicy !== false) {
    headers['Content-Security-Policy'] = merged.contentSecurityPolicy;
  }

  if (merged.contentTypeOptions !== false) {
    headers['X-Content-Type-Options'] = merged.contentTypeOptions;
  }

  if (merged.frameOptions !== false) {
    headers['X-Frame-Options'] = merged.frameOptions;
  }

  if (merged.xssProtection !== false) {
    headers['X-XSS-Protection'] = merged.xssProtection;
  }

  if (merged.hsts !== false) {
    headers['Strict-Transport-Security'] = merged.hsts;
  }

  if (merged.referrerPolicy !== false) {
    headers['Referrer-Policy'] = merged.referrerPolicy;
  }

  if (merged.permissionsPolicy !== false) {
    headers['Permissions-Policy'] = merged.permissionsPolicy;
  }

  // Mark X-Powered-By for removal, or set a custom value
  if (merged.poweredBy === false) {
    headers['X-Powered-By'] = '';
  } else if (merged.poweredBy) {
    headers['X-Powered-By'] = merged.poweredBy;
  }

  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  return headers;
}

/**
 * Read the header policy that {@link createSecurityMiddleware} attached to a
 * request, if any.
 *
 * @param request - Request seen by a middleware or backend adapter
 * @returns The header policy, or `undefined` when the security middleware did
 *   not run
 */
export function getSecurityHeaders(request: IRChatRequest): Record<string, string> | undefined {
  const value = request.metadata?.custom?.[SECURITY_HEADERS_METADATA_KEY];
  return typeof value === 'object' && value !== null
    ? (value as Record<string, string>)
    : undefined;
}

/**
 * Extract plain text from message content.
 * @internal
 */
function extractText(content: string | readonly MessageContent[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((part) => part.type === 'text')
    .map((part) => (part as { text: string }).text)
    .join('\n');
}

/**
 * Concatenated text of every message in a request.
 * @internal
 */
function allText(request: IRChatRequest): string {
  return request.messages.map((message) => extractText(message.content)).join('\n');
}

/**
 * Attach metadata (header policy and/or warnings) to a request.
 * @internal
 */
function withMetadata(
  request: IRChatRequest,
  custom?: Record<string, unknown>,
  warnings?: readonly IRWarning[]
): IRChatRequest {
  return {
    ...request,
    metadata: {
      ...request.metadata,
      ...(custom ? { custom: { ...request.metadata?.custom, ...custom } } : {}),
      ...(warnings ? { warnings: [...(request.metadata?.warnings ?? []), ...warnings] } : {}),
    },
  };
}

/**
 * Create security middleware.
 *
 * Sanitizes and redacts the outgoing request, detects prompt injection, and
 * attaches an advisory HTTP response header policy. See the module
 * documentation for how the header policy is meant to be consumed and for the
 * division of labour with {@link createValidationMiddleware}.
 *
 * @param config - Security configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createSecurityMiddleware } from '@johnhenry/aimatey-middleware';
 *
 * // Safe by default: sanitizes content, redacts PII, warns on injection.
 * bridge.use(createSecurityMiddleware());
 * ```
 *
 * @example Opting out of redaction
 * ```typescript
 * bridge.use(createSecurityMiddleware({ redactPII: false }));
 * ```
 *
 * @example Blocking injection attempts with tuned patterns
 * ```typescript
 * bridge.use(createSecurityMiddleware({
 *   promptInjectionAction: 'block',
 *   injectionPatterns: [/ignore\s+(previous|above|all)\s+instructions/i],
 * }));
 * ```
 *
 * @example Emitting the header policy from the HTTP layer
 * ```typescript
 * const handler = createCoreHandler({
 *   bridge,
 *   headers: buildSecurityHeaders({ hsts: 'max-age=31536000; preload' }),
 * });
 * ```
 */
export function createSecurityMiddleware(config: SecurityConfig = {}): Middleware {
  const headers = buildSecurityHeaders(config);

  const redact = config.redactPII !== false;
  const injectionAction = config.promptInjectionAction ?? 'warn';
  const piiPatterns = config.piiPatterns ?? DEFAULT_PII_PATTERNS;

  // Delegate every content rule to the validation middleware so there is a
  // single PII/injection/sanitization implementation in this package.
  const validationConfig: ValidationConfig = {
    sanitizeMessages: config.sanitizeContent !== false,
    sanitizer: config.sanitizer,
    detectPII: redact,
    piiAction: 'redact',
    piiPatterns,
    preventPromptInjection: injectionAction !== 'ignore',
    injectionAction,
    injectionPatterns: config.injectionPatterns,
    // Data-quality rules are `createValidationMiddleware`'s job, not this
    // middleware's. Turn off everything that is not a security control so an
    // empty message or a long conversation is never rejected by *security*.
    blockEmptyMessages: false,
    throwOnError: true,
    logWarnings: config.logWarnings !== false,
    logPrefix: 'Security',
  };

  const validation = createValidationMiddleware(validationConfig);

  return async (context, next) => {
    // Attach the advisory header policy.
    context.request = withMetadata(context.request, {
      [SECURITY_HEADERS_METADATA_KEY]: headers,
    });

    const before = context.request;

    // `validation` rewrites `context.request` and then calls the function we
    // pass as `next`, so by the time this runs the redaction has happened.
    return await validation(context, async () => {
      if (redact) {
        const beforeText = allText(before);
        const afterText = allText(context.request);

        const redacted =
          beforeText !== afterText &&
          afterText.includes(REDACTION_MARKER) &&
          !beforeText.includes(REDACTION_MARKER);

        if (redacted) {
          const { types } = detectPII(beforeText, piiPatterns);
          context.request = withMetadata(context.request, undefined, [
            createWarning(
              'content-redacted',
              `Security middleware redacted PII from message content before it reached the backend${
                types.length > 0 ? `: ${types.join(', ')}` : ''
              }`,
              {
                severity: 'warning',
                field: 'messages',
                source: 'security-middleware',
                details: { types },
              }
            ),
          ]);
        }
      }

      return await next();
    });
  };
}

/**
 * Create production-ready security middleware with strict settings.
 *
 * Redacts PII, sanitizes content, and **blocks** prompt-injection attempts.
 * The header policy is the strictest preset.
 *
 * @returns Middleware with production security settings
 *
 * @example
 * ```typescript
 * import { createProductionSecurityMiddleware } from '@johnhenry/aimatey-middleware';
 *
 * bridge.use(createProductionSecurityMiddleware());
 * ```
 */
export function createProductionSecurityMiddleware(): Middleware {
  return createSecurityMiddleware({
    redactPII: true,
    sanitizeContent: true,
    promptInjectionAction: 'block',
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    frameOptions: 'DENY',
    hsts: 'max-age=31536000; includeSubDomains; preload',
    xssProtection: '1; mode=block',
    contentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    poweredBy: false,
  });
}

/**
 * Create development-friendly security middleware with relaxed settings.
 *
 * The *header* policy is relaxed for local development. Request protection is
 * not: PII is still redacted, because the request still leaves the machine for
 * a third-party provider. Pass `redactPII: false` explicitly if you need to
 * see raw content in development.
 *
 * @returns Middleware with development security settings
 *
 * @example
 * ```typescript
 * import { createDevelopmentSecurityMiddleware } from '@johnhenry/aimatey-middleware';
 *
 * bridge.use(createDevelopmentSecurityMiddleware());
 * ```
 */
export function createDevelopmentSecurityMiddleware(): Middleware {
  return createSecurityMiddleware({
    redactPII: true,
    sanitizeContent: true,
    promptInjectionAction: 'warn',
    contentSecurityPolicy: false, // Disable for easier development
    frameOptions: 'SAMEORIGIN',
    hsts: false, // Don't enforce HTTPS in development
    xssProtection: '1; mode=block',
    contentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: false,
    poweredBy: false,
  });
}
