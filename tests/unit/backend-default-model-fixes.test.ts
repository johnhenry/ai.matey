/**
 * Regression tests for default-model gaps/staleness fixed across the
 * backend provider adapters: some had no default at all (silently
 * inheriting OpenAIBackendAdapter's default via subclassing), others
 * still pointed at models retired years ago (Llama 2, Claude 3 Haiku,
 * the old Perplexity llama-3.1-sonar-* lineup), and some pointed at their
 * mid/balanced tier rather than the cheaper lite tier the provider also
 * offers (Groq, DashScope - verified live against each platform's current
 * pricing/model docs on 2026-08-01).
 */

import { describe, it, expect } from 'vitest';
import {
  NVIDIABackendAdapter,
  LMStudioBackendAdapter,
  OllamaBackendAdapter,
  AnyscaleBackendAdapter,
  PerplexityBackendAdapter,
  AWSBedrockBackendAdapter,
  ReplicateBackendAdapter,
  GroqBackendAdapter,
  DashScopeBackendAdapter,
} from '@johnhenry/aimatey-backend';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

function makeRequest(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
  return {
    messages: [{ role: 'user', content: 'hi' }],
    parameters: {},
    metadata: { requestId: 'req-1', timestamp: Date.now(), provenance: {} },
    ...overrides,
  };
}

describe('NVIDIA default model', () => {
  it('does not inherit OpenAIBackendAdapter default (gpt-5.6-terra is not a NIM model)', () => {
    const adapter = new NVIDIABackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('meta/llama-3.1-8b-instruct');
  });
});

describe('LM Studio default model', () => {
  it('does not inherit OpenAIBackendAdapter default (no local server serves gpt-5.6-terra)', () => {
    const adapter = new LMStudioBackendAdapter({});
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('local-model');
  });
});

describe('Ollama default model', () => {
  it('respects config.defaultModel instead of always sending llama2', () => {
    const adapter = new OllamaBackendAdapter({ defaultModel: 'llama3.2' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('llama3.2');
  });

  it('falls back to llama3.2, not the retired llama2', () => {
    const adapter = new OllamaBackendAdapter({});
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('llama3.2');
  });
});

describe('Anyscale default model', () => {
  it('defaults to a Llama 3.1 model, not the retired Llama 2', () => {
    const adapter = new AnyscaleBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('meta-llama/Meta-Llama-3.1-8B-Instruct');
  });
});

describe('Perplexity default model', () => {
  it('defaults to sonar, not the retired llama-3.1-sonar-*-online lineup', () => {
    const adapter = new PerplexityBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('sonar');
  });
});

describe('AWS Bedrock default model', () => {
  it('defaults to the Claude Haiku 4.5 global inference profile, not Claude 3 Haiku', () => {
    const adapter = new AWSBedrockBackendAdapter({});
    const req = adapter.fromIR(makeRequest());
    // Bare 'anthropic.claude-haiku-4-5-...' 400s with "on-demand throughput
    // isn't supported for this model" - it must go through the 'global.'
    // cross-region inference profile.
    expect(req.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
  });
});

describe('Replicate default model', () => {
  it('defaults to Llama 3 8B Instruct, not the retired Llama 2 70B', () => {
    const adapter = new ReplicateBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.version).toBe('meta/meta-llama-3-8b-instruct');
  });
});

describe('Groq default model', () => {
  it('defaults to the cheap/fast Llama 3.1 8B Instant tier, not the 70B versatile tier', () => {
    const adapter = new GroqBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('llama-3.1-8b-instant');
  });
});

describe('DashScope default model', () => {
  it('defaults to the qwen3.7-flash budget tier, not the qwen3.7-plus mid tier', () => {
    const adapter = new DashScopeBackendAdapter({ apiKey: 'test-key' });
    const req = adapter.fromIR(makeRequest());
    expect(req.model).toBe('qwen3.7-flash');
  });
});
