/**
 * Tests for the fixture system
 */

import { describe, it, expect } from 'vitest';
import {
  loadFixture,
  loadProviderFixtures,
  findFixtures,
  createMockFromFixture,
  validateAgainstFixture,
  extractRequest,
  extractResponse,
  isChatFixture,
  isStreamingFixture,
} from 'ai.matey.testing';

describe('Fixture System', () => {
  describe('loadFixture', () => {
    it('should load an OpenAI fixture', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');

      expect(fixture).toBeDefined();
      expect(fixture.metadata.provider).toBe('openai');
      expect(fixture.metadata.scenario).toBe('basic-chat');
      expect(fixture.request).toBeDefined();
      expect(isChatFixture(fixture)).toBe(true);
    });

    it('should load an Anthropic fixture', async () => {
      const fixture = await loadFixture('anthropic', 'basic-chat');

      expect(fixture).toBeDefined();
      expect(fixture.metadata.provider).toBe('anthropic');
      expect(fixture.request.messages).toBeDefined();
    });

    it('should load a streaming fixture', async () => {
      const fixture = await loadFixture('openai', 'streaming-chat');

      expect(fixture).toBeDefined();
      expect(isStreamingFixture(fixture)).toBe(true);
      if (isStreamingFixture(fixture)) {
        expect(fixture.chunks).toBeDefined();
        expect(fixture.chunks.length).toBeGreaterThan(0);
      }
    });

    it('should throw error for non-existent fixture', async () => {
      await expect(
        loadFixture('openai', 'non-existent')
      ).rejects.toThrow('Fixture not found');
    });
  });

  describe('loadProviderFixtures', () => {
    it('should load all OpenAI fixtures', async () => {
      const fixtures = await loadProviderFixtures('openai');

      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.every(f => f.metadata.provider === 'openai')).toBe(true);
    });

    it('should load all Anthropic fixtures', async () => {
      const fixtures = await loadProviderFixtures('anthropic');

      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.every(f => f.metadata.provider === 'anthropic')).toBe(true);
    });

    it('should return empty array for non-existent provider', async () => {
      const fixtures = await loadProviderFixtures('non-existent');
      expect(fixtures).toEqual([]);
    });
  });

  describe('findFixtures', () => {
    it('should find fixtures by provider', async () => {
      const fixtures = await findFixtures({ provider: 'openai' });

      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.every(f => f.metadata.provider === 'openai')).toBe(true);
    });

    it('should find streaming fixtures', async () => {
      const fixtures = await findFixtures({ streaming: true });

      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.every(f => isStreamingFixture(f))).toBe(true);
    });

    it('should find fixtures by tag', async () => {
      const fixtures = await findFixtures({ tags: ['tools'] });

      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.every(f =>
        f.metadata.tags && f.metadata.tags.includes('tools')
      )).toBe(true);
    });
  });

  describe('createMockFromFixture', () => {
    it('should create mock backend from chat fixture', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');
      const mock = createMockFromFixture(fixture);

      expect(mock).toBeDefined();
      expect(mock.name).toContain('mock');
      expect(mock.chat).toBeDefined();

      const response = await mock.chat(fixture.request);
      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.message.role).toBe('assistant');
    });

    it('should create mock backend from streaming fixture', async () => {
      const fixture = await loadFixture('openai', 'streaming-chat');
      const mock = createMockFromFixture(fixture);

      expect(mock).toBeDefined();
      expect(mock.chatStream).toBeDefined();

      if (mock.chatStream && isStreamingFixture(fixture)) {
        const chunks = [];
        for await (const chunk of mock.chatStream(fixture.request)) {
          chunks.push(chunk);
        }
        expect(chunks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateAgainstFixture', () => {
    it('should validate response matches fixture', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');
      if (!isChatFixture(fixture)) return;

      const response = extractResponse(fixture);
      const isValid = validateAgainstFixture(response, fixture);

      expect(isValid).toBe(true);
    });

    it('should detect invalid response', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');
      if (!isChatFixture(fixture)) return;

      const invalidResponse = {
        message: {
          role: 'user' as const,  // Wrong role
          content: [{ type: 'text' as const, text: 'test' }],
        },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        finishReason: 'stop' as const,
        metadata: {
          requestId: 'test',
          timestamp: Date.now(),
        },
      };

      const isValid = validateAgainstFixture(invalidResponse, fixture);
      expect(isValid).toBe(false);
    });
  });

  describe('extractRequest', () => {
    it('should extract request from fixture', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');
      const request = extractRequest(fixture);

      expect(request).toBeDefined();
      expect(request.messages).toBeDefined();
      expect(request.parameters).toBeDefined();
    });
  });

  describe('extractResponse', () => {
    it('should extract response from chat fixture', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');
      if (!isChatFixture(fixture)) return;

      const response = extractResponse(fixture);

      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.usage).toBeDefined();
    });
  });

  describe('fixture metadata', () => {
    it('should have complete metadata', async () => {
      const fixture = await loadFixture('openai', 'basic-chat');

      expect(fixture.metadata).toBeDefined();
      expect(fixture.metadata.provider).toBeDefined();
      expect(fixture.metadata.scenario).toBeDefined();
      expect(fixture.metadata.model).toBeDefined();
      expect(fixture.metadata.capturedAt).toBeDefined();
    });

    it('should support tags', async () => {
      const fixture = await loadFixture('openai', 'tools-function-calling');

      expect(fixture.metadata.tags).toBeDefined();
      expect(Array.isArray(fixture.metadata.tags)).toBe(true);
      expect(fixture.metadata.tags).toContain('tools');
    });
  });
});
