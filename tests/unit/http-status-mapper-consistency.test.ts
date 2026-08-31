/**
 * http.core error -> HTTP status mapping must have exactly one implementation.
 *
 * Issue #105 reported that `packages/http.core/src/handler.ts` and
 * `packages/http.core/src/error-handler.ts` mapped the *same* input to
 * different statuses, using a character-for-character identical predicate:
 *
 *   handler.ts:507        if (message.includes('timeout')) return 408;
 *   error-handler.ts:132  if (message.includes('timeout')) return 504;
 *
 * Measuring both paths before the fix showed the divergence was wider than the
 * report. `CoreHTTPHandler` carried a *private* duplicate of the mapper that
 * message-sniffed and ignored the typed error taxonomy entirely:
 *
 *   | input                  | handler.ts | error-handler.ts |
 *   | ---------------------- | ---------- | ---------------- |
 *   | message 'timeout'      | 408        | 504              |
 *   | message 'conflict'     | 409        | 500              |
 *   | message 'validation'   | 400        | 500              |
 *   | message 'too large'    | 500        | 413              |
 *   | RateLimitError         | 500        | 429              |
 *   | NetworkError           | 500        | 502              |
 *   | ProviderError          | 500        | 503              |
 *   | ValidationError        | 500        | 400              |
 *
 * `getHTTPStatusCode` is exported precisely so "every HTTP entry point maps
 * errors to statuses the same way instead of hardcoding a number at each catch
 * site" (its own doc comment). The handler did not use it. It does now, and
 * the mapper lives in one module both files import.
 *
 * The unified mapper is the UNION of the two, so nothing is lost: `conflict`
 * and `validation` came from the handler's copy, `too large` and the whole
 * typed taxonomy from the shared one. Timeout resolves to 504, the upstream
 * reading, because this library proxies to a provider -- a timeout here is a
 * gateway that gave up, not a slow client.
 *
 * WHAT THIS FILE DOES NOT PROVE: it exercises the handler's built-in
 * embeddings catch site (handler.ts:421), not every catch site in the package.
 * It pins that the handler and the exported mapper agree; it does not
 * enumerate every route through which an error can reach a response.
 */

import { describe, it, expect } from 'vitest';
import {
  CoreHTTPHandler,
  getHTTPStatusCode,
  type GenericRequest,
  type GenericResponse,
} from '@johnhenry/aimatey-http-core';
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend';
import {
  RateLimitError,
  NetworkError,
  ProviderError,
  ValidationError,
} from '@johnhenry/aimatey-errors';
import type { AdapterMetadata, BackendAdapter } from '@johnhenry/aimatey-types';

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(overrides: Partial<GenericRequest> = {}): GenericRequest {
  return {
    method: 'GET',
    url: '/health',
    headers: {},
    body: null,
    ip: '127.0.0.1',
    ...overrides,
  };
}

interface CapturedResponse extends GenericResponse {
  statusCode: number;
  sent: unknown;
  headers: Record<string, string>;
}

function makeResponse(): CapturedResponse {
  const captured: CapturedResponse = {
    statusCode: 200,
    sent: undefined,
    headers: {},
    status(code) {
      captured.statusCode = code;
    },
    header(name, value) {
      captured.headers[name] = value;
    },
    send(data) {
      captured.sent = data;
    },
    stream: () => Promise.resolve(),
    isWritable: () => true,
  };
  return captured;
}

/**
 * A backend whose every entry point throws `error`, so the handler's catch
 * site receives exactly the error under test rather than a wrapped one.
 */
function throwingBackend(error: Error): BackendAdapter {
  const metadata: AdapterMetadata = {
    name: 'throwing-mock',
    version: '1.0.0',
    provider: 'Mock',
    capabilities: {
      streaming: false,
      multiModal: false,
      tools: false,
      embeddings: true,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };
  return {
    metadata,
    fromIR: (request) => request,
    toIR: () => {
      throw error;
    },
    execute: () => {
      throw error;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock generator interface
    executeStream: async function* () {
      throw error;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock interface
    embed: async () => {
      throw error;
    },
  } as unknown as BackendAdapter;
}

/** Status the `CoreHTTPHandler` response path actually serves for `error`. */
async function statusFromHandler(error: Error): Promise<number> {
  const handler = new CoreHTTPHandler({
    bridge: new Bridge(new OpenAIFrontendAdapter(), throwingBackend(error)),
    embeddings: { enabled: true },
  } as never);
  const res = makeResponse();
  await handler.handle(
    makeRequest({ method: 'POST', url: '/v1/embeddings', body: { model: 'm', input: 'hi' } }),
    res
  );
  handler.dispose();
  return res.statusCode;
}

// ============================================================================
// The invariant
// ============================================================================

const DIVERGENT_INPUTS: ReadonlyArray<readonly [string, () => Error, number]> = [
  // The reported case.
  ['message "timeout"', () => new Error('Request timeout after 30000ms'), 504],
  // Predicates that only the handler's private copy had.
  ['message "conflict"', () => new Error('conflict detected'), 409],
  ['message "validation"', () => new Error('validation blew up'), 400],
  // A predicate that only the shared mapper had.
  ['message "too large"', () => new Error('payload too large'), 413],
  // The typed taxonomy, which the handler's copy ignored entirely.
  ['RateLimitError', () => new RateLimitError({ message: 'slow down' }), 429],
  ['NetworkError', () => new NetworkError({ message: 'socket gone' }), 502],
  ['ProviderError', () => new ProviderError({ message: 'upstream sad' }), 503],
  [
    'ValidationError',
    () => new ValidationError({ message: 'bad field', validationDetails: [] }),
    400,
  ],
];

const AGREED_INPUTS: ReadonlyArray<readonly [string, () => Error, number]> = [
  ['message "not found"', () => new Error('model not found'), 404],
  ['message "unauthorized"', () => new Error('unauthorized caller'), 401],
  ['message "forbidden"', () => new Error('forbidden resource'), 403],
  ['unrecognised message', () => new Error('random boom'), 500],
];

describe('http.core status mapping is single-sourced (#105)', () => {
  describe.each([...DIVERGENT_INPUTS, ...AGREED_INPUTS])('%s', (_label, makeError, expected) => {
    it(`maps to ${expected} through the exported mapper`, () => {
      expect(getHTTPStatusCode(makeError())).toBe(expected);
    });

    it(`maps to ${expected} through the CoreHTTPHandler response path`, async () => {
      expect(await statusFromHandler(makeError())).toBe(expected);
    });

    it('gives the same answer on both paths', async () => {
      const error = makeError();
      expect(await statusFromHandler(error)).toBe(getHTTPStatusCode(error));
    });
  });
});

describe('timeout resolves to 504, not 408 (#105)', () => {
  it('treats a timeout as an upstream failure on both paths', async () => {
    const error = new Error('Request timeout after 30000ms');

    // 408 says the *client* was too slow; 504 says an upstream was. A library
    // that proxies to a provider means the latter.
    expect(getHTTPStatusCode(error)).toBe(504);
    expect(await statusFromHandler(error)).toBe(504);
    expect(await statusFromHandler(error)).not.toBe(408);
  });
});

describe('unifying did not drop either mapper predicates (#105)', () => {
  it('keeps "conflict" -> 409, which only the handler copy had', () => {
    expect(getHTTPStatusCode(new Error('conflict detected'))).toBe(409);
  });

  it('keeps "validation" -> 400, which only the handler copy had', () => {
    expect(getHTTPStatusCode(new Error('validation blew up'))).toBe(400);
  });

  it('keeps "too large" -> 413, which only the shared mapper had', () => {
    expect(getHTTPStatusCode(new Error('payload too large'))).toBe(413);
  });

  it('still lets an error declare its own status explicitly', () => {
    // Pinned by tests/unit/http-error-sanitization.test.ts too; repeated here
    // because the explicit-status branch must survive the move.
    const error = Object.assign(new Error('conflict detected'), {
      details: { httpStatus: 503 },
    });
    expect(getHTTPStatusCode(error)).toBe(503);
  });
});
