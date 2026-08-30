/**
 * AWS Bedrock adapter: SigV4 request signing.
 *
 * Issue #38 reported that `getHeaders()` in
 * packages/backend/src/providers/aws-bedrock.ts set a literal placeholder
 * `Authorization` header with no computed signature and never read
 * `awsSecretAccessKey`. Real signing landed in #45; these tests pin that
 * behaviour down and additionally cover two defects found afterwards:
 *
 *  1. Canonical header VALUES were only `.trim()`-ed. SigV4 also requires
 *     runs of internal whitespace to be collapsed to a single space, so the
 *     signer disagreed with AWS on any such header (`get-header-value-trim`,
 *     `get-header-value-multiline` below both failed).
 *  2. The signer used `node:crypto`, which -- because
 *     packages/backend/src/index.ts re-exports this provider -- dragged a
 *     Node-only builtin into the module graph of every
 *     `@johnhenry/aimatey-backend` consumer, breaking browser/edge bundles
 *     (the same failure mode as #48). It now uses Web Crypto, which made
 *     `signAwsRequestV4` asynchronous.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE OF THE TEST VECTORS
 *
 * The `AWS_SIGV4_TEST_SUITE_CASES` table below is AWS's own published
 * `aws-sig-v4-test-suite`. The `expectedCanonicalRequest` and
 * `expectedAuthorization` strings are copied verbatim from the suite's
 * `.creq` and `.authz` files as vendored in botocore
 * (tests/unit/auth/aws4_testsuite/), which in turn vendors them from
 * awslabs/aws-c-auth (tests/aws-sig-v4-test-suite). They are NOT generated
 * by this implementation, so these assertions are a genuine external check
 * rather than a self-consistency check.
 *
 * The suite fixes the following inputs (see botocore tests/unit/auth/test_sigv4.py):
 *   access key id     AKIDEXAMPLE
 *   secret access key wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY
 *   region            us-east-1
 *   service           service
 *   timestamp         20150830T123600Z
 *
 * WHAT THESE TESTS DO NOT PROVE: they exercise the signer against fixed
 * inputs only. No request is made to AWS, so they cannot prove that AWS
 * accepts a signature for a real Bedrock endpoint. The suite's
 * `normalize-path/*` relative-path cases (`../`, `./`, duplicate slashes)
 * are NOT covered and `canonicalUri()` does not implement dot-segment
 * normalization; Bedrock paths are built from a model id and contain no dot
 * segments, so this is a documented limitation rather than a live bug.
 * Duplicate header names (`get-header-key-duplicate`, `get-header-value-order`)
 * are unrepresentable in the `Record<string, string>` input type and are
 * likewise not covered.
 * ---------------------------------------------------------------------------
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { AWSBedrockBackendAdapter, signAwsRequestV4 } from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

const SUITE_ACCESS_KEY_ID = 'AKIDEXAMPLE';
const SUITE_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
const SUITE_REGION = 'us-east-1';
const SUITE_SERVICE = 'service';
const SUITE_AMZ_DATE = '20150830T123600Z';

// `AWSBedrockConfig` extends `BackendAdapterConfig`, which makes `apiKey`
// REQUIRED -- even though Bedrock authenticates purely with SigV4 and this
// adapter never reads `apiKey`. Every Bedrock user has to pass a meaningless
// value; these tests do the same rather than casting the type away.
const BEDROCK_CONFIG_BASE = { apiKey: '' } as const;

interface SigV4TestCase {
  readonly name: string;
  readonly description: string;
  readonly input: {
    readonly method: string;
    readonly path: string;
    readonly canonicalQueryString: string;
    readonly headers: Record<string, string>;
    readonly body: string;
  };
  readonly expectedCanonicalRequest: string;
  readonly expectedAuthorization: string;
}

const AWS_SIGV4_TEST_SUITE_CASES: readonly SigV4TestCase[] = [
  {
    name: 'get-vanilla',
    description: 'the baseline GET with an empty body',
    input: {
      method: 'GET',
      path: '/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  },
  {
    name: 'post-vanilla',
    description: 'a POST with an empty body',
    input: {
      method: 'POST',
      path: '/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'POST\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b',
  },
  {
    name: 'get-header-value-trim',
    description:
      'header values are trimmed AND internal runs of spaces collapsed (even inside quotes)',
    input: {
      method: 'GET',
      path: '/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'My-Header1': '  value1  ',
        'My-Header2': '  "a   b   c"  ',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/\n\nhost:example.amazonaws.com\nmy-header1:value1\nmy-header2:"a b c"\nx-amz-date:20150830T123600Z\n\nhost;my-header1;my-header2;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;my-header1;my-header2;x-amz-date, Signature=acc3ed3afb60bb290fc8d2dd0098b9911fcaa05412b367055dee359757a9c736',
  },
  {
    name: 'get-header-value-multiline',
    description: 'a folded multi-line header value collapses to single spaces',
    input: {
      method: 'GET',
      path: '/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'My-Header1': 'value1\n  value2\n     value3',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/\n\nhost:example.amazonaws.com\nmy-header1:value1 value2 value3\nx-amz-date:20150830T123600Z\n\nhost;my-header1;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;my-header1;x-amz-date, Signature=cfd34249e4b1c8d6b91ef74165d41a32e5fab3306300901bb65a51a73575eefd',
  },
  {
    name: 'post-header-value-case',
    description: 'header NAMES are lowercased but header VALUES keep their case',
    input: {
      method: 'POST',
      path: '/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'My-Header1': 'VALUE1',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'POST\n/\n\nhost:example.amazonaws.com\nmy-header1:VALUE1\nx-amz-date:20150830T123600Z\n\nhost;my-header1;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;my-header1;x-amz-date, Signature=cdbc9802e29d2942e5e10b5bccfdd67c5f22c7c4e8ae67b53629efa58b974b7d',
  },
  {
    name: 'post-header-key-sort',
    description: 'headers are sorted by lowercased name regardless of insertion order',
    input: {
      method: 'POST',
      path: '/',
      canonicalQueryString: '',
      headers: {
        'X-Amz-Date': '20150830T123600Z',
        'My-Header1': 'value1',
        Host: 'example.amazonaws.com',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'POST\n/\n\nhost:example.amazonaws.com\nmy-header1:value1\nx-amz-date:20150830T123600Z\n\nhost;my-header1;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;my-header1;x-amz-date, Signature=c5410059b04c1ee005303aed430f6e6645f61f4dc9e1461ec8f8916fdf18852c',
  },
  {
    name: 'get-unreserved',
    description: 'RFC 3986 unreserved characters in the path are left unencoded',
    input: {
      method: 'GET',
      path: '/-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=07ef7494c76fa4850883e2b006601f940f8a34d404d0cfa977f52a65bbf5f24f',
  },
  {
    name: 'get-utf8',
    description: 'a non-ASCII path segment is percent-encoded as UTF-8',
    input: {
      method: 'GET',
      path: '/ሴ',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/%E1%88%B4\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=8318018e0b0f223aa2bbf98705b62bb787dc9c0e678f255a891fd03141be5d85',
  },
  {
    name: 'get-space',
    description: 'a space in the path is encoded as %20 (never +)',
    input: {
      method: 'GET',
      path: '/example space/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/example%20space/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=652487583200325589f1fba4c7e578f72c47cb61beeca81406b39ddec1366741',
  },
  {
    name: 'get-vanilla-with-session-token',
    description: 'x-amz-security-token participates in the canonical + signed headers',
    input: {
      method: 'GET',
      path: '/',
      canonicalQueryString: '',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
        'X-Amz-Security-Token': '6e86291e8372ff2a2260956d9b8aae1d763fbf315fa00fa31553b73ebf194267',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\nx-amz-security-token:6e86291e8372ff2a2260956d9b8aae1d763fbf315fa00fa31553b73ebf194267\n\nhost;x-amz-date;x-amz-security-token\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date;x-amz-security-token, Signature=07ec1639c89043aa0e3e2de82b96708f198cceab042d4a97044c66dd9f74e7f8',
  },
  {
    name: 'post-x-www-form-urlencoded',
    description: 'a NON-EMPTY body is hashed into the canonical request',
    input: {
      method: 'POST',
      path: '/',
      canonicalQueryString: '',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: 'Param1=value1',
    },
    expectedCanonicalRequest:
      'POST\n/\n\ncontent-type:application/x-www-form-urlencoded\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\ncontent-type;host;x-amz-date\n9095672bbd1f56dfc5b65f3e153adc8731a4a654192329106275f4c7b24d0b6e',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=ff11897932ad3f4e8b18135d722051e5ac45fc38421b1da7b9d196a0fe09473a',
  },
  {
    name: 'get-vanilla-query-order-key-case',
    description: 'the caller-supplied canonical query string is placed in field 3',
    input: {
      method: 'GET',
      path: '/',
      canonicalQueryString: 'Param1=value1&Param2=value2',
      headers: {
        Host: 'example.amazonaws.com',
        'X-Amz-Date': '20150830T123600Z',
      },
      body: '',
    },
    expectedCanonicalRequest:
      'GET\n/\nParam1=value1&Param2=value2\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedAuthorization:
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500',
  },
];

function signSuiteCase(testCase: SigV4TestCase) {
  return signAwsRequestV4({
    ...testCase.input,
    region: SUITE_REGION,
    service: SUITE_SERVICE,
    accessKeyId: SUITE_ACCESS_KEY_ID,
    secretAccessKey: SUITE_SECRET_ACCESS_KEY,
    amzDate: SUITE_AMZ_DATE,
  });
}

describe("signAwsRequestV4 against AWS's published aws-sig-v4-test-suite", () => {
  for (const testCase of AWS_SIGV4_TEST_SUITE_CASES) {
    describe(testCase.name, () => {
      it(`builds the canonical request AWS expects (${testCase.description})`, async () => {
        const result = await signSuiteCase(testCase);
        expect(result.canonicalRequest).toBe(testCase.expectedCanonicalRequest);
      });

      it('derives the signature and Authorization header AWS expects', async () => {
        const result = await signSuiteCase(testCase);
        expect(result.authorizationHeader).toBe(testCase.expectedAuthorization);
      });
    });
  }

  it('covers every documented facet of canonicalization', () => {
    expect(AWS_SIGV4_TEST_SUITE_CASES.map((c) => c.name)).toEqual([
      'get-vanilla',
      'post-vanilla',
      'get-header-value-trim',
      'get-header-value-multiline',
      'post-header-value-case',
      'post-header-key-sort',
      'get-unreserved',
      'get-utf8',
      'get-space',
      'get-vanilla-with-session-token',
      'post-x-www-form-urlencoded',
      'get-vanilla-query-order-key-case',
    ]);
  });
});

describe('signAwsRequestV4 string-to-sign and credential scope', () => {
  it("matches the suite's get-vanilla.sts byte for byte", async () => {
    const vanilla = AWS_SIGV4_TEST_SUITE_CASES.find((c) => c.name === 'get-vanilla')!;
    const result = await signSuiteCase(vanilla);
    expect(result.stringToSign).toBe(
      'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/service/aws4_request\nbb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63'
    );
    expect(result.credentialScope).toBe('20150830/us-east-1/service/aws4_request');
    expect(result.signedHeaders).toBe('host;x-amz-date');
  });

  it("matches the suite's post-x-www-form-urlencoded.sts (non-empty body)", async () => {
    const form = AWS_SIGV4_TEST_SUITE_CASES.find((c) => c.name === 'post-x-www-form-urlencoded')!;
    const result = await signSuiteCase(form);
    expect(result.stringToSign).toBe(
      'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/service/aws4_request\n42a5e5bb34198acb3e84da4f085bb7927f2bc277ca766e6d19c73c2154021281'
    );
  });

  it('hashes an empty payload as SHA-256("")', async () => {
    const result = await signSuiteCase(
      AWS_SIGV4_TEST_SUITE_CASES.find((c) => c.name === 'get-vanilla')!
    );
    // The well-known SHA-256 of the empty string, which every empty-body
    // canonical request in the suite ends with.
    expect(result.canonicalRequest.split('\n').pop()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('hashes a non-empty payload rather than reusing the empty hash', async () => {
    const result = await signSuiteCase(
      AWS_SIGV4_TEST_SUITE_CASES.find((c) => c.name === 'post-x-www-form-urlencoded')!
    );
    expect(result.canonicalRequest.split('\n').pop()).toBe(
      '9095672bbd1f56dfc5b65f3e153adc8731a4a654192329106275f4c7b24d0b6e'
    );
  });

  it('derives the credential scope from the amzDate, not from the wall clock', async () => {
    const result = await signAwsRequestV4({
      method: 'GET',
      path: '/',
      headers: { Host: 'example.amazonaws.com', 'X-Amz-Date': '19991231T235959Z' },
      body: '',
      region: 'eu-west-1',
      service: 'bedrock',
      accessKeyId: SUITE_ACCESS_KEY_ID,
      secretAccessKey: SUITE_SECRET_ACCESS_KEY,
      amzDate: '19991231T235959Z',
    });
    expect(result.credentialScope).toBe('19991231/eu-west-1/bedrock/aws4_request');
    expect(result.stringToSign.split('\n')[1]).toBe('19991231T235959Z');
    expect(result.authorizationHeader).toContain(
      'Credential=AKIDEXAMPLE/19991231/eu-west-1/bedrock/aws4_request'
    );
  });
});

describe('signAwsRequestV4 is browser-safe (issue #48 regression guard)', () => {
  it('imports no Node-only builtin in the provider module', async () => {
    // Behavioural tests cannot catch this: a `node:crypto` import works fine
    // under vitest. The breakage is at bundle time for browser/edge consumers,
    // so assert on the source itself. packages/backend/src/index.ts re-exports
    // this provider, so any Node builtin here poisons the whole package.
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(
      new URL('../../packages/backend/src/providers/aws-bedrock.ts', import.meta.url),
      'utf8'
    );
    const importedModules = [...source.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map(
      (match) => match[1]!
    );
    expect(importedModules.length).toBeGreaterThan(0);
    expect(importedModules.filter((specifier) => specifier.startsWith('node:'))).toEqual([]);
  });

  it('fails loudly rather than silently when Web Crypto is unavailable', async () => {
    const realCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      await expect(signSuiteCase(AWS_SIGV4_TEST_SUITE_CASES[0]!)).rejects.toThrow(/Web Crypto API/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
    }
  });
});

describe('AWSBedrockBackendAdapter request signing', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeRequest(): IRChatRequest {
    return {
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'anthropic.claude-3-haiku-20240307-v1:0' },
      metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    } as unknown as IRChatRequest;
  }

  function stubJsonResponse(capture: (url: string, init: RequestInit) => void) {
    globalThis.fetch = vi.fn(async (url: unknown, init?: unknown) => {
      capture(String(url), (init ?? {}) as RequestInit);
      return new Response(
        JSON.stringify({
          output: { message: { role: 'assistant', content: [{ text: 'Hi!' }] } },
          stopReason: 'end_turn',
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;
  }

  it('sends a real computed signature (not a placeholder) using awsSecretAccessKey', async () => {
    let headers: Record<string, string> = {};
    stubJsonResponse((_url, init) => {
      headers = init.headers as Record<string, string>;
    });

    const adapter = new AWSBedrockBackendAdapter({
      ...BEDROCK_CONFIG_BASE,
      region: 'us-east-1',
      awsAccessKeyId: SUITE_ACCESS_KEY_ID,
      awsSecretAccessKey: SUITE_SECRET_ACCESS_KEY,
    });
    await adapter.execute(makeRequest());

    expect(headers['Authorization']).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/bedrock\/aws4_request, SignedHeaders=host;x-amz-date, Signature=[0-9a-f]{64}$/
    );
    expect(headers['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it('signs the exact request body it sends, for the exact path it requests', async () => {
    let url = '';
    let headers: Record<string, string> = {};
    let body = '';
    stubJsonResponse((u, init) => {
      url = u;
      headers = init.headers as Record<string, string>;
      body = String(init.body);
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2015-08-30T12:36:00.000Z'));

    const adapter = new AWSBedrockBackendAdapter({
      ...BEDROCK_CONFIG_BASE,
      region: 'us-east-1',
      awsAccessKeyId: SUITE_ACCESS_KEY_ID,
      awsSecretAccessKey: SUITE_SECRET_ACCESS_KEY,
    });
    await adapter.execute(makeRequest());
    vi.useRealTimers();

    // Recompute the signature independently from what was actually sent.
    const expected = await signAwsRequestV4({
      method: 'POST',
      path: new URL(url).pathname,
      headers: {
        host: new URL(url).host,
        'x-amz-date': headers['X-Amz-Date']!,
      },
      body,
      region: 'us-east-1',
      service: 'bedrock',
      accessKeyId: SUITE_ACCESS_KEY_ID,
      secretAccessKey: SUITE_SECRET_ACCESS_KEY,
      amzDate: headers['X-Amz-Date']!,
    });

    expect(headers['Authorization']).toBe(expected.authorizationHeader);
  });

  it('includes the session token in the signature when one is configured', async () => {
    let headers: Record<string, string> = {};
    stubJsonResponse((_url, init) => {
      headers = init.headers as Record<string, string>;
    });

    const adapter = new AWSBedrockBackendAdapter({
      ...BEDROCK_CONFIG_BASE,
      region: 'us-east-1',
      awsAccessKeyId: SUITE_ACCESS_KEY_ID,
      awsSecretAccessKey: SUITE_SECRET_ACCESS_KEY,
      awsSessionToken: 'session-token-value',
    });
    await adapter.execute(makeRequest());

    expect(headers['Authorization']).toContain(
      'SignedHeaders=host;x-amz-date;x-amz-security-token'
    );
    expect(headers['X-Amz-Security-Token']).toBe('session-token-value');
  });

  it('omits Authorization entirely when no credentials are configured', async () => {
    let headers: Record<string, string> = {};
    stubJsonResponse((_url, init) => {
      headers = init.headers as Record<string, string>;
    });

    const adapter = new AWSBedrockBackendAdapter({ ...BEDROCK_CONFIG_BASE, region: 'us-east-1' });
    await adapter.execute(makeRequest());

    expect(headers['Authorization']).toBeUndefined();
  });

  it('changes the signature when awsSecretAccessKey differs (the secret is really used)', async () => {
    const seen: string[] = [];
    stubJsonResponse((_url, init) => {
      seen.push((init.headers as Record<string, string>)['Authorization']!);
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    for (const secret of [SUITE_SECRET_ACCESS_KEY, 'aDifferentSecretKeyEntirelyXXXXXXXXXXXXX']) {
      const adapter = new AWSBedrockBackendAdapter({
        ...BEDROCK_CONFIG_BASE,
        region: 'us-east-1',
        awsAccessKeyId: SUITE_ACCESS_KEY_ID,
        awsSecretAccessKey: secret,
      });
      await adapter.execute(makeRequest());
    }
    vi.useRealTimers();

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it('signs the streaming endpoint too, over its own /converse-stream path', async () => {
    let url = '';
    let headers: Record<string, string> = {};
    globalThis.fetch = vi.fn(async (u: unknown, init?: unknown) => {
      url = String(u);
      headers = ((init ?? {}) as RequestInit).headers as Record<string, string>;
      return new Response(new ReadableStream({ start: (c) => c.close() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const adapter = new AWSBedrockBackendAdapter({
      ...BEDROCK_CONFIG_BASE,
      region: 'us-east-1',
      awsAccessKeyId: SUITE_ACCESS_KEY_ID,
      awsSecretAccessKey: SUITE_SECRET_ACCESS_KEY,
    });
    for await (const chunk of adapter.executeStream(makeRequest())) {
      expect(chunk.type).not.toBe('error');
    }

    expect(url).toContain('/converse-stream');
    expect(headers['Authorization']).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/bedrock\/aws4_request, SignedHeaders=host;x-amz-date, Signature=[0-9a-f]{64}$/
    );

    // The streaming signature must cover the streaming path, so it must
    // differ from the signature the non-streaming path would produce.
    const nonStreaming = await signAwsRequestV4({
      method: 'POST',
      path: new URL(url).pathname.replace('/converse-stream', '/converse'),
      headers: { host: new URL(url).host, 'x-amz-date': headers['X-Amz-Date']! },
      body: '',
      region: 'us-east-1',
      service: 'bedrock',
      accessKeyId: SUITE_ACCESS_KEY_ID,
      secretAccessKey: SUITE_SECRET_ACCESS_KEY,
      amzDate: headers['X-Amz-Date']!,
    });
    expect(headers['Authorization']).not.toBe(nonStreaming.authorizationHeader);
  });
});
