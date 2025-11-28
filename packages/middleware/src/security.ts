/**
 * Security Middleware
 *
 * Adds security headers and implements security best practices for HTTP responses.
 *
 * @module
 */

import type { Middleware } from 'ai.matey.types';

/**
 * Security headers configuration
 */
export interface SecurityConfig {
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
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: Required<Omit<SecurityConfig, 'customHeaders'>> = {
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
 * Create security headers middleware
 *
 * Adds security headers to responses to protect against common vulnerabilities.
 *
 * @param config - Security configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createSecurityMiddleware } from 'ai.matey';
 *
 * const security = createSecurityMiddleware({
 *   contentSecurityPolicy: "default-src 'self'",
 *   hsts: 'max-age=31536000',
 * });
 *
 * bridge.use(security);
 * ```
 *
 * @example Production Configuration
 * ```typescript
 * const productionSecurity = createSecurityMiddleware({
 *   contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
 *   frameOptions: 'DENY',
 *   hsts: 'max-age=31536000; includeSubDomains; preload',
 *   referrerPolicy: 'strict-origin-when-cross-origin',
 *   permissionsPolicy: 'geolocation=(), microphone=(), camera=(), payment=()',
 * });
 * ```
 */
export function createSecurityMiddleware(config: SecurityConfig = {}): Middleware {
  const mergedConfig = {
    ...DEFAULT_SECURITY_CONFIG,
    ...config,
  };

  return async (context, next) => {
    // Add security headers to request metadata (will be passed through to response)
    // Note: In ai.matey, security headers should ideally be added at the HTTP layer
    // This middleware just marks that security headers should be added
    const custom = context.request.metadata?.custom || {};
    const securityHeaders: Record<string, string> = {};
    const headers = securityHeaders;

    // Content Security Policy
    if (mergedConfig.contentSecurityPolicy !== false) {
      headers['Content-Security-Policy'] = mergedConfig.contentSecurityPolicy;
    }

    // X-Content-Type-Options
    if (mergedConfig.contentTypeOptions !== false) {
      headers['X-Content-Type-Options'] = mergedConfig.contentTypeOptions;
    }

    // X-Frame-Options
    if (mergedConfig.frameOptions !== false) {
      headers['X-Frame-Options'] = mergedConfig.frameOptions;
    }

    // X-XSS-Protection
    if (mergedConfig.xssProtection !== false) {
      headers['X-XSS-Protection'] = mergedConfig.xssProtection;
    }

    // Strict-Transport-Security
    if (mergedConfig.hsts !== false) {
      headers['Strict-Transport-Security'] = mergedConfig.hsts;
    }

    // Referrer-Policy
    if (mergedConfig.referrerPolicy !== false) {
      headers['Referrer-Policy'] = mergedConfig.referrerPolicy;
    }

    // Permissions-Policy
    if (mergedConfig.permissionsPolicy !== false) {
      headers['Permissions-Policy'] = mergedConfig.permissionsPolicy;
    }

    // Remove X-Powered-By (or set custom value)
    if (mergedConfig.poweredBy === false) {
      // Mark for removal
      headers['X-Powered-By'] = '';
    } else if (mergedConfig.poweredBy) {
      headers['X-Powered-By'] = mergedConfig.poweredBy;
    }

    // Add custom headers
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    // Store headers in custom metadata (HTTP layer should apply these)
    const newCustom = {
      ...custom,
      securityHeaders,
    };

    // Update request with security headers metadata
    context.request = {
      ...context.request,
      metadata: {
        ...context.request.metadata,
        custom: newCustom,
      },
    };

    // Execute next middleware/backend
    return await next();
  };
}

/**
 * Create production-ready security middleware with strict settings
 *
 * @returns Middleware with production security settings
 *
 * @example
 * ```typescript
 * import { createProductionSecurityMiddleware } from 'ai.matey';
 *
 * bridge.use(createProductionSecurityMiddleware());
 * ```
 */
export function createProductionSecurityMiddleware(): Middleware {
  return createSecurityMiddleware({
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
 * Create development-friendly security middleware with relaxed settings
 *
 * @returns Middleware with development security settings
 *
 * @example
 * ```typescript
 * import { createDevelopmentSecurityMiddleware } from 'ai.matey';
 *
 * bridge.use(createDevelopmentSecurityMiddleware());
 * ```
 */
export function createDevelopmentSecurityMiddleware(): Middleware {
  return createSecurityMiddleware({
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
