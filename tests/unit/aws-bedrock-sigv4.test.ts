/**
 * Regression tests: AWS Bedrock adapter's SigV4 request signing.
 *
 * Previously `getHeaders()` in packages/backend/src/providers/aws-bedrock.ts
 * set a literal placeholder `Authorization` header
 * (`AWS4-HMAC-SHA256 Credential=${accessKeyId}/...`) with no computed
 * signature, and never read `awsSecretAccessKey` at all -- every request
 * would fail AWS's signature verification. The fix implements the real
 * SigV4 algorithm (canonical request -> string-to-sign -> derived signing
 * key -> HMAC-SHA256 signature) as the exported `signAwsRequestV4()`
 * function, verified below against AWS's own published SigV4 test vector
 * ("get-vanilla", from the aws-sig-v4-test-suite that mirrors AWS's
 * documented signing test cases).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { AWSBedrockBackendAdapter, signAwsRequestV4 } from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

// ============================================================================
// AWS's own published SigV4 test vector ("get-vanilla")
//
// config: accessKeyId=AKIDEXAMPLE,
//         secretAccessKey=wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY,
//         region=us-east-1, service=service, date=20150830T123600Z
// request: GET / HTTP/1.1, Host: example.amazonaws.com,
//          X-Amz-Date: 20150830T123600Z, empty body
// ============================================================================

const VANILLA_EXPECTED_CANONICAL_REQUEST = [
  'GET',
  '/',
  '',
  'host:example.amazonaws.com',
  'x-amz-date:20150830T123600Z',
  '',
  'host;x-amz-date',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
].join('\n');

const VANILLA_EXPECTED_STRING_TO_SIGN = [
  'AWS4-HMAC-SHA256',
  '20150830T123600Z',
  '20150830/us-east-1/service/aws4_request',
  'bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63',
].join('\n');

const VANILLA_EXPECTED_AUTHZ =
  'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
  'SignedHeaders=host;x-amz-date, ' +
  'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31';

describe('signAwsRequestV4 against AWS SigV4 published test vector', () => {
  const result = signAwsRequestV4({
    method: 'GET',
    path: '/',
    headers: {
      Host: 'example.amazonaws.com',
      'X-Amz-Date': '20150830T123600Z',
    },
    body: '',
    region: 'us-east-1',
    service: 'service',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    amzDate: '20150830T123600Z',
  });

  it('produces the exact canonical request from the test vector', () => {
    expect(result.canonicalRequest).toBe(VANILLA_EXPECTED_CANONICAL_REQUEST);
  });

  it('produces the exact string-to-sign from the test vector', () => {
    expect(result.stringToSign).toBe(VANILLA_EXPECTED_STRING_TO_SIGN);
  });

  it('produces the exact Authorization header (and signature) from the test vector', () => {
    expect(result.authorizationHeader).toBe(VANILLA_EXPECTED_AUTHZ);
    expect(result.signature).toBe(
      '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'
    );
  });
});

describe('AWSBedrockBackendAdapter request signing', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeRequest(): IRChatRequest {
    return {
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { model: 'anthropic.claude-3-haiku-20240307-v1:0' },
      metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    };
  }

  it('sends a real computed signature (not a placeholder) using awsSecretAccessKey', async () => {
    let capturedHeaders: Record<string, string> | undefined;

    globalThis.fetch = vi.fn(async (_url: any, init?: any) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(
        JSON.stringify({
          output: { message: { role: 'assistant', content: [{ text: 'Hi!' }] } },
          stopReason: 'end_turn',
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const adapter = new AWSBedrockBackendAdapter({
      region: 'us-east-1',
      awsAccessKeyId: 'AKIDEXAMPLE',
      awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    });

    await adapter.execute(makeRequest());

    expect(capturedHeaders).toBeDefined();
    const authz = capturedHeaders!['Authorization'];

    // Must not be the old placeholder shape.
    expect(authz).not.toContain('/...');
    // Must be a well-formed SigV4 Authorization header with a real
    // 64-hex-char signature (not empty, not a placeholder).
    expect(authz).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/bedrock\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/
    );
  });

  it('changes the signature when awsSecretAccessKey differs (proves the secret is actually used)', async () => {
    const capturedAuthz: string[] = [];

    globalThis.fetch = vi.fn(async (_url: any, init?: any) => {
      capturedAuthz.push((init?.headers as Record<string, string>)['Authorization']);
      return new Response(
        JSON.stringify({
          output: { message: { role: 'assistant', content: [{ text: 'Hi!' }] } },
          stopReason: 'end_turn',
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    // Freeze time so the two requests get the same X-Amz-Date and are
    // otherwise identical except for the secret key.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const adapterA = new AWSBedrockBackendAdapter({
      region: 'us-east-1',
      awsAccessKeyId: 'AKIDEXAMPLE',
      awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    });
    const adapterB = new AWSBedrockBackendAdapter({
      region: 'us-east-1',
      awsAccessKeyId: 'AKIDEXAMPLE',
      awsSecretAccessKey: 'aDifferentSecretKeyEntirelyXXXXXXXXXXXXX',
    });

    await adapterA.execute(makeRequest());
    await adapterB.execute(makeRequest());

    vi.useRealTimers();

    expect(capturedAuthz).toHaveLength(2);
    expect(capturedAuthz[0]).not.toBe(capturedAuthz[1]);
  });
});
