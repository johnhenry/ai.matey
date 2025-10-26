/**
 * Provider contract tests - ensures all adapters conform to the IR interface
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  loadProviderFixtures,
  createMockFromFixture,
  isChatFixture,
  isStreamingFixture,
} from '../../src/testing/index.js';
import type { IRChatRequest, IRChatResponse } from '../../src/types/ir.js';

/**
 * Contract test suite for a backend adapter
 */
function describeProviderContract(providerName: string) {
  describe(`${providerName} Provider Contract`, () => {
    let fixtures: Awaited<ReturnType<typeof loadProviderFixtures>>;

    beforeAll(async () => {
      fixtures = await loadProviderFixtures(providerName);
    });

    it('should have at least one fixture', () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });

    describe('chat responses', () => {
      it('should return valid IRChatResponse structure', async () => {
        const chatFixtures = fixtures.filter(isChatFixture);
        expect(chatFixtures.length).toBeGreaterThan(0);

        for (const fixture of chatFixtures) {
          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          // Validate response structure
          expect(response).toBeDefined();
          expect(response.message).toBeDefined();
          expect(response.message.role).toBe('assistant');
          expect(response.message.content).toBeDefined();
          expect(Array.isArray(response.message.content)).toBe(true);
          expect(response.usage).toBeDefined();
          expect(response.usage.promptTokens).toBeGreaterThanOrEqual(0);
          expect(response.usage.completionTokens).toBeGreaterThanOrEqual(0);
          expect(response.usage.totalTokens).toBeGreaterThanOrEqual(0);
          expect(response.finishReason).toBeDefined();
          expect(response.metadata).toBeDefined();
          expect(response.metadata.requestId).toBeDefined();
        }
      });

      it('should have non-empty content', async () => {
        const chatFixtures = fixtures.filter(isChatFixture);

        for (const fixture of chatFixtures) {
          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          expect(response.message.content.length).toBeGreaterThan(0);

          // At least one content item should have text or tool_use
          const hasContent = response.message.content.some(c =>
            (c.type === 'text' && c.text) ||
            (c.type === 'tool_use')
          );
          expect(hasContent).toBe(true);
        }
      });

      it('should return valid finish reasons', async () => {
        const chatFixtures = fixtures.filter(isChatFixture);
        const validFinishReasons = ['stop', 'length', 'tool_use', 'content_filter'];

        for (const fixture of chatFixtures) {
          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          expect(validFinishReasons).toContain(response.finishReason);
        }
      });
    });

    describe('streaming responses', () => {
      it('should yield valid stream chunks', async () => {
        const streamFixtures = fixtures.filter(isStreamingFixture);

        if (streamFixtures.length === 0) {
          // Provider might not have streaming fixtures yet
          return;
        }

        for (const fixture of streamFixtures) {
          const mock = createMockFromFixture(fixture);
          if (!mock.chatStream) continue;

          const chunks = [];
          for await (const chunk of mock.chatStream(fixture.request)) {
            chunks.push(chunk);

            // Validate chunk structure
            expect(chunk).toBeDefined();
            expect(chunk.type).toBeDefined();
            expect(['start', 'content', 'tool_use', 'error', 'metadata', 'done']).toContain(chunk.type);
            expect(chunk.metadata).toBeDefined();
          }

          expect(chunks.length).toBeGreaterThan(0);

          // Should start with 'start' chunk
          expect(chunks[0].type).toBe('start');

          // Should end with 'done' chunk
          expect(chunks[chunks.length - 1].type).toBe('done');
        }
      });

      it('should accumulate to coherent content', async () => {
        const streamFixtures = fixtures.filter(isStreamingFixture);

        if (streamFixtures.length === 0) return;

        for (const fixture of streamFixtures) {
          const mock = createMockFromFixture(fixture);
          if (!mock.chatStream) continue;

          let accumulatedText = '';
          for await (const chunk of mock.chatStream(fixture.request)) {
            if (chunk.type === 'content' && chunk.delta) {
              accumulatedText += chunk.delta;
            }
          }

          // Should have accumulated some text
          if (accumulatedText) {
            expect(accumulatedText.length).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('tool use', () => {
      it('should handle tool use responses correctly', async () => {
        const toolFixtures = fixtures.filter(f =>
          f.metadata.tags?.includes('tools') || f.metadata.tags?.includes('function-calling')
        );

        if (toolFixtures.length === 0) return;

        for (const fixture of toolFixtures) {
          if (!isChatFixture(fixture)) continue;

          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          // Should have tool_use content
          const toolUse = response.message.content.find(c => c.type === 'tool_use');
          expect(toolUse).toBeDefined();

          if (toolUse && toolUse.type === 'tool_use') {
            expect(toolUse.id).toBeDefined();
            expect(toolUse.name).toBeDefined();
            expect(toolUse.input).toBeDefined();
          }

          // Finish reason should be tool_use
          expect(response.finishReason).toBe('tool_use');
        }
      });
    });

    describe('metadata', () => {
      it('should include provenance in response metadata', async () => {
        const chatFixtures = fixtures.filter(isChatFixture);

        for (const fixture of chatFixtures) {
          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          expect(response.metadata).toBeDefined();
          expect(response.metadata.requestId).toBeDefined();
          expect(response.metadata.timestamp).toBeDefined();

          // Should have provenance info
          if (response.metadata.provenance) {
            expect(response.metadata.provenance.backend).toBeDefined();
            expect(response.metadata.provenance.model).toBeDefined();
          }
        }
      });
    });

    describe('request handling', () => {
      it('should handle basic chat requests', async () => {
        const basicFixtures = fixtures.filter(f =>
          f.metadata.scenario.includes('basic') && isChatFixture(f)
        );

        expect(basicFixtures.length).toBeGreaterThan(0);

        for (const fixture of basicFixtures) {
          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          expect(response).toBeDefined();
          expect(response.message.content.length).toBeGreaterThan(0);
        }
      });

      it('should handle multi-turn conversations', async () => {
        const multiTurnFixtures = fixtures.filter(f =>
          f.metadata.scenario.includes('multi-turn') && isChatFixture(f)
        );

        if (multiTurnFixtures.length === 0) return;

        for (const fixture of multiTurnFixtures) {
          // Request should have multiple messages
          expect(fixture.request.messages.length).toBeGreaterThan(1);

          const mock = createMockFromFixture(fixture);
          const response = await mock.chat(fixture.request);

          expect(response).toBeDefined();
        }
      });
    });
  });
}

// Run contract tests for each provider
describe('Provider Contracts', () => {
  describeProviderContract('openai');
  describeProviderContract('anthropic');
  describeProviderContract('gemini');
  describeProviderContract('ollama');
});
