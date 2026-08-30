/**
 * Error message sanitization (issue #43).
 *
 * Client-facing error bodies must describe what the caller did wrong without
 * describing where our code lives.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage, getHTTPStatusCode } from '@johnhenry/aimatey-http-core';
import { AdapterError, ValidationError, RateLimitError } from '@johnhenry/aimatey-errors';
import { ErrorCode } from '@johnhenry/aimatey-types';

describe('sanitizeErrorMessage (#43)', () => {
  it('replaces any 5xx message with the canonical status text', () => {
    const error = new Error('connection to postgres://user:pw@10.0.0.4/prod failed');

    expect(sanitizeErrorMessage(error, 500)).toBe('Internal Server Error');
    expect(sanitizeErrorMessage(error, 502)).toBe('Bad Gateway');
    expect(sanitizeErrorMessage(error, 503)).toBe('Service Unavailable');
  });

  it('keeps a 4xx message, since the caller needs it to fix the request', () => {
    const error = new Error('Invalid JSON body: Unexpected token } at position 4');

    expect(sanitizeErrorMessage(error, 400)).toContain('Invalid JSON body');
  });

  it('strips absolute source paths out of 4xx messages', () => {
    const error = new Error('bad payload at /srv/app/packages/http/src/node/listener.ts:57:12');

    const result = sanitizeErrorMessage(error, 400);

    expect(result).toContain('bad payload');
    expect(result).not.toContain('/srv/app');
    expect(result).not.toContain('listener.ts');
  });

  it('strips file:// URLs out of 4xx messages', () => {
    const error = new Error('failed near file:///Users/someone/proj/src/parse.ts:12 while reading');

    const result = sanitizeErrorMessage(error, 400);

    expect(result).not.toContain('file://');
    expect(result).not.toContain('/Users/someone');
  });

  it('truncates a stack trace appended to a 4xx message', () => {
    const error = new Error(
      'Invalid request\n    at parseRequest (/srv/app/src/request-parser.ts:31:17)\n    at async handler'
    );

    const result = sanitizeErrorMessage(error, 400);

    expect(result).toBe('Invalid request');
    expect(result).not.toContain('    at ');
  });

  it('falls back to the status text when scrubbing empties the message', () => {
    const error = new Error('/srv/app/src/secret.ts:1:1');

    expect(sanitizeErrorMessage(error, 400)).toBe('Bad Request');
  });
});

describe('getHTTPStatusCode (#43)', () => {
  it('honors a status the error declares explicitly', () => {
    const error = new AdapterError({
      code: ErrorCode.INVALID_REQUEST,
      message: 'Request body too large (max 1024 bytes)',
      isRetryable: false,
      details: { httpStatus: 413 },
    });

    // Without the declaration this AdapterError would map to 500.
    expect(getHTTPStatusCode(error)).toBe(413);
  });

  it('maps the error taxonomy to statuses without message sniffing', () => {
    expect(
      getHTTPStatusCode(
        new ValidationError({
          code: ErrorCode.INVALID_REQUEST,
          message: 'nope',
          validationDetails: [],
        })
      )
    ).toBe(400);

    expect(getHTTPStatusCode(new RateLimitError({ message: 'nope' }))).toBe(429);
  });

  it('ignores a declared status outside the 4xx/5xx range', () => {
    const error = new AdapterError({
      code: ErrorCode.INVALID_REQUEST,
      message: 'weird',
      isRetryable: false,
      details: { httpStatus: 200 },
    });

    expect(getHTTPStatusCode(error)).toBe(500);
  });
});
