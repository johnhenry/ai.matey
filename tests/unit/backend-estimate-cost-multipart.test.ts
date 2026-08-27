/**
 * Regression tests: estimateCost() must count tokens for multi-part
 * (structured/array) message content, not just plain-string content.
 *
 * Previously ~17 provider adapters' estimateCost() built `inputTokens` via
 * `typeof msg.content === 'string' ? msg.content : ''`, which silently
 * treated any multi-part message (an array of content blocks -- images,
 * multiple text blocks, etc.) as zero-length text, undercounting cost to
 * (near) zero. The fix routes all of them through the existing
 * `estimateTokens()` helper (packages/backend/src/shared.ts), which already
 * walks structured content blocks correctly.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { AI21BackendAdapter, MistralBackendAdapter } from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROVIDERS_DIR = join(__dirname, '..', '..', 'packages', 'backend', 'src', 'providers');

const AFFECTED_PROVIDER_FILES = [
  'ai21.ts',
  'anyscale.ts',
  'aws-bedrock.ts',
  'azure-openai.ts',
  'cerebras.ts',
  'cloudflare.ts',
  'deepinfra.ts',
  'fireworks.ts',
  'moonshot.ts',
  'openrouter.ts',
  'perplexity.ts',
  'sambanova.ts',
  'together-ai.ts',
  'xai.ts',
  'inception.ts',
  'cohere.ts',
  'mistral.ts',
];

function multiPartRequest(text: string): IRChatRequest {
  return {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text },
          { type: 'image', source: { type: 'url', url: 'http://example.com/img.png' } },
        ],
      },
    ],
    parameters: { model: 'jamba-instruct' },
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
  };
}

describe('estimateCost multi-part content regression (static source check)', () => {
  it('none of the previously-affected provider files use the string-only content check anymore', () => {
    for (const file of AFFECTED_PROVIDER_FILES) {
      const source = readFileSync(join(PROVIDERS_DIR, file), 'utf8');
      expect(
        source.includes("typeof msg.content === 'string' ? msg.content : ''"),
        `${file} should not use the string-only content-length check`
      ).toBe(false);
    }
  });

  it('every previously-affected provider file now delegates to the shared estimateTokens() helper', () => {
    for (const file of AFFECTED_PROVIDER_FILES) {
      const source = readFileSync(join(PROVIDERS_DIR, file), 'utf8');
      expect(
        /estimateTokens\(request\)/.test(source),
        `${file} should call estimateTokens(request) in its cost estimation`
      ).toBe(true);
    }
  });

  it('the affected-file list matches every provider file that used to have the bug (no file missed)', () => {
    const allProviderFiles = readdirSync(PROVIDERS_DIR).filter((f) => f.endsWith('.ts'));
    for (const file of allProviderFiles) {
      const source = readFileSync(join(PROVIDERS_DIR, file), 'utf8');
      expect(
        source.includes("typeof msg.content === 'string' ? msg.content : ''"),
        `${file} still has the buggy string-only content check`
      ).toBe(false);
    }
  });
});

describe('AI21BackendAdapter.estimateCost with multi-part content', () => {
  const adapter = new AI21BackendAdapter({ apiKey: 'test-key' });

  it('counts tokens from a multi-part message instead of treating it as empty', async () => {
    const longText = 'This is a fairly long piece of text. '.repeat(20); // ~760 chars
    const cost = await adapter.estimateCost(multiPartRequest(longText));

    expect(cost).not.toBeNull();
    expect(cost).toBeGreaterThan(0);
  });

  it('scales with content length (proves it is not always returning ~0)', async () => {
    const shortCost = await adapter.estimateCost(multiPartRequest('Hi'));
    const longCost = await adapter.estimateCost(
      multiPartRequest('This is a fairly long piece of text. '.repeat(50))
    );

    expect(shortCost).not.toBeNull();
    expect(longCost).not.toBeNull();
    expect(longCost as number).toBeGreaterThan(shortCost as number);
  });
});

describe('MistralBackendAdapter.estimateCost with multi-part content', () => {
  const adapter = new MistralBackendAdapter({ apiKey: 'test-key' });

  it('counts tokens from a multi-part message instead of treating it as empty', async () => {
    const longText = 'Mistral multi-part regression test content. '.repeat(20);
    const cost = await adapter.estimateCost(multiPartRequest(longText));

    expect(cost).not.toBeNull();
    expect(cost).toBeGreaterThan(0);
  });

  it('scales with content length (proves it is not always returning ~0)', async () => {
    const shortCost = await adapter.estimateCost(multiPartRequest('Hi'));
    const longCost = await adapter.estimateCost(
      multiPartRequest('Mistral multi-part regression test content. '.repeat(50))
    );

    expect(shortCost).not.toBeNull();
    expect(longCost).not.toBeNull();
    expect(longCost as number).toBeGreaterThan(shortCost as number);
  });
});
