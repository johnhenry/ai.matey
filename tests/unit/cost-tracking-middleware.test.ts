import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCostTrackingMiddleware,
  createStreamingCostTrackingMiddleware,
  InMemoryCostStorage,
  calculateCost,
  getCostStats,
  DEFAULT_PRICING,
} from '../../src/middleware/cost-tracking.js';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from '../../src/types/ir.js';
import type { MiddlewareContext, StreamingMiddlewareContext } from '../../src/types/middleware.js';

describe('Cost Tracking Middleware', () => {
  const mockRequest: IRChatRequest = {
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello!' }],
      },
    ],
    parameters: {
      temperature: 0.7,
      maxTokens: 100,
      model: 'gpt-4',
    },
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
      provenance: {
        backend: 'openai',
      },
    },
  };

  const mockResponse: IRChatResponse = {
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi there!' }],
    },
    finishReason: 'stop',
    usage: {
      promptTokens: 10,
      completionTokens: 15,
      totalTokens: 25,
    },
    metadata: {
      requestId: 'test-123',
      timestamp: Date.now(),
      provenance: {
        backend: 'openai',
      },
    },
  };

  const createContext = (request: IRChatRequest): MiddlewareContext => ({
    request,
    metadata: {},
  });

  describe('InMemoryCostStorage', () => {
    let storage: InMemoryCostStorage;

    beforeEach(() => {
      storage = new InMemoryCostStorage();
    });

    it('should store cost calculation', async () => {
      const cost = {
        requestId: 'test-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.00030,
        outputCost: 0.00090,
        totalCost: 0.00120,
      };

      await storage.record(cost);

      const stats = storage.getAllCosts();
      expect(stats.length).toBe(1);
      expect(stats[0]).toEqual(cost);
    });

    it('should retrieve costs within time window', async () => {
      const now = Date.now();

      // Add costs at different times
      await storage.record({
        requestId: 'test-1',
        timestamp: now - 1000 * 60 * 60 * 2, // 2 hours ago
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      await storage.record({
        requestId: 'test-2',
        timestamp: now - 1000 * 60 * 60 * 25, // 25 hours ago
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      // Get costs from last 24 hours
      const since = now - 24 * 60 * 60 * 1000;
      const total = await storage.getTotal(since);

      expect(total).toBe(0.003); // Only test-1 should be included
    });

    it('should clear all costs', async () => {
      await storage.record({
        requestId: 'test-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      await storage.clear();

      const stats = storage.getAllCosts();
      expect(stats.length).toBe(0);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for OpenAI GPT-4', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = calculateCost(usage, 'openai', 'gpt-4', {});

      expect(cost.inputCost).toBeGreaterThan(0);
      expect(cost.outputCost).toBeGreaterThan(0);
      expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
    });

    it('should calculate cost for Anthropic Claude', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = calculateCost(usage, 'anthropic', 'claude-3-opus', {});

      expect(cost.inputCost).toBeGreaterThan(0);
      expect(cost.outputCost).toBeGreaterThan(0);
      expect(cost.totalCost).toBeGreaterThan(0);
    });

    it('should use custom pricing', () => {
      const usage = {
        promptTokens: 1000000, // 1M tokens
        completionTokens: 1000000, // 1M tokens
        totalTokens: 2000000,
      };

      const config = {
        providers: {
          'openai:custom-model': {
            inputCostPer1M: 1.0,
            outputCostPer1M: 2.0,
          },
        },
      };

      const cost = calculateCost(usage, 'openai', 'custom-model', config);

      expect(cost.inputCost).toBe(1.0);
      expect(cost.outputCost).toBe(2.0);
      expect(cost.totalCost).toBe(3.0);
    });

    it('should handle unknown models with default pricing', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const cost = calculateCost(usage, 'openai', 'unknown-model', {});

      // Should use default pricing for openai provider
      expect(cost.totalCost).toBeGreaterThan(0);
    });

    it('should handle zero tokens', () => {
      const usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      const cost = calculateCost(usage, 'openai', 'gpt-4', {});

      expect(cost.inputCost).toBe(0);
      expect(cost.outputCost).toBe(0);
      expect(cost.totalCost).toBe(0);
    });
  });

  describe('getCostStats', () => {
    let storage: InMemoryCostStorage;

    beforeEach(() => {
      storage = new InMemoryCostStorage();
    });

    it('should calculate total cost', async () => {
      await storage.record({
        requestId: 'test-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      await storage.record({
        requestId: 'test-2',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      const stats = await getCostStats(storage, 24);

      expect(stats.total).toBe(0.006);
      expect(stats.period).toBe('Last 24 hours');
    });

    it('should group by provider', async () => {
      await storage.record({
        requestId: 'test-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      await storage.record({
        requestId: 'test-2',
        timestamp: Date.now(),
        provider: 'anthropic',
        model: 'claude-3-opus',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.002,
        outputCost: 0.004,
        totalCost: 0.006,
      });

      const stats = await getCostStats(storage, 24);

      expect(stats.byProvider).toHaveProperty('openai');
      expect(stats.byProvider).toHaveProperty('anthropic');
      expect(stats.byProvider.openai).toBe(0.003);
      expect(stats.byProvider.anthropic).toBe(0.006);
    });

    it('should group by model', async () => {
      await storage.record({
        requestId: 'test-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.001,
        outputCost: 0.002,
        totalCost: 0.003,
      });

      await storage.record({
        requestId: 'test-2',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
        inputCost: 0.0001,
        outputCost: 0.0002,
        totalCost: 0.0003,
      });

      const stats = await getCostStats(storage, 24);

      expect(stats.byModel).toHaveProperty('gpt-4');
      expect(stats.byModel).toHaveProperty('gpt-3.5-turbo');
      expect(stats.byModel['gpt-4']).toBe(0.003);
      expect(stats.byModel['gpt-3.5-turbo']).toBe(0.0003);
    });
  });

  describe('createCostTrackingMiddleware', () => {
    let storage: InMemoryCostStorage;

    beforeEach(() => {
      storage = new InMemoryCostStorage();
    });

    it('should create middleware with default config', () => {
      const middleware = createCostTrackingMiddleware({
        storage,
      });

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should track cost for request', async () => {
      const middleware = createCostTrackingMiddleware({
        storage,
      });

      const context = createContext(mockRequest);
      const next = async () => mockResponse;

      await middleware(context, next);

      const costs = storage.getAllCosts();
      expect(costs.length).toBe(1);
      expect(costs[0].totalCost).toBeGreaterThan(0);
    });

    it('should call onCost callback', async () => {
      let callbackCalled = false;
      let recordedCost = 0;

      const middleware = createCostTrackingMiddleware({
        storage,
        onCost: (cost) => {
          callbackCalled = true;
          recordedCost = cost.totalCost;
        },
      });

      const context = createContext(mockRequest);
      const next = async () => mockResponse;

      await middleware(context, next);

      expect(callbackCalled).toBe(true);
      expect(recordedCost).toBeGreaterThan(0);
    });

    it('should check request threshold', async () => {
      let thresholdExceeded = false;

      const middleware = createCostTrackingMiddleware({
        storage,
        requestThreshold: 0.0001, // Very low threshold
        onThresholdExceeded: (cost, threshold) => {
          thresholdExceeded = true;
        },
      });

      const context = createContext(mockRequest);
      const next = async () => mockResponse;

      await middleware(context, next);

      expect(thresholdExceeded).toBe(true);
    });

    it('should check hourly threshold', async () => {
      let hourlyExceeded = false;

      const middleware = createCostTrackingMiddleware({
        storage,
        hourlyThreshold: 0.001, // Low threshold
        onThresholdExceeded: (cost, threshold) => {
          // Check if this was triggered by hourly threshold
          // The callback doesn't provide 'type' parameter
          hourlyExceeded = true;
        },
      });

      // Add enough costs to exceed hourly threshold
      for (let i = 0; i < 10; i++) {
        const context = createContext(mockRequest);
        const next = async () => mockResponse;
        await middleware(context, next);
      }

      expect(hourlyExceeded).toBe(true);
    });

    it('should log costs when enabled', async () => {
      // Spy on console.log
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: any[]) => logs.push(args.join(' '));

      const middleware = createCostTrackingMiddleware({
        storage,
        logCosts: true,
      });

      const context = createContext(mockRequest);
      const next = async () => mockResponse;

      await middleware(context, next);

      // Restore console.log
      console.log = originalLog;

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log) => log.includes('cost') || log.includes('Cost'))).toBe(true);
    });

    it('should handle missing usage data', async () => {
      const middleware = createCostTrackingMiddleware({
        storage,
      });

      const responseWithoutUsage: IRChatResponse = {
        ...mockResponse,
        usage: undefined,
      };

      const context = createContext(mockRequest);
      const next = async () => responseWithoutUsage;

      await middleware(context, next);

      // When usage is missing, no cost is recorded
      const costs = storage.getAllCosts();
      expect(costs.length).toBe(0);
    });
  });

  describe('createStreamingCostTrackingMiddleware', () => {
    let storage: InMemoryCostStorage;

    beforeEach(() => {
      storage = new InMemoryCostStorage();
    });

    it('should create streaming middleware', () => {
      const middleware = createStreamingCostTrackingMiddleware({
        storage,
      });

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should track cost for streaming request', async () => {
      const middleware = createStreamingCostTrackingMiddleware({
        storage,
      });

      const chunks: IRStreamChunk[] = [
        { type: 'start', sequence: 0 },
        {
          type: 'content',
          sequence: 1,
          delta: 'Hello',
        },
        {
          type: 'done',
          sequence: 2,
          finishReason: 'stop',
          usage: {
            promptTokens: 10,
            completionTokens: 15,
            totalTokens: 25,
          },
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      const context: StreamingMiddlewareContext = {
        request: mockRequest,
        metadata: {},
      };

      const next = mockStream;

      const resultStream = await middleware(context, next);
      const collected = [];

      for await (const chunk of resultStream) {
        collected.push(chunk);
      }

      expect(collected.length).toBe(chunks.length);

      // Cost should be recorded after stream completes
      const costs = storage.getAllCosts();
      expect(costs.length).toBe(1);
      expect(costs[0].totalCost).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_PRICING', () => {
    it('should have OpenAI pricing', () => {
      expect(DEFAULT_PRICING).toHaveProperty('openai');
      expect(DEFAULT_PRICING).toHaveProperty('openai:gpt-4');
      expect(DEFAULT_PRICING['openai:gpt-4']).toHaveProperty('inputCostPer1M');
      expect(DEFAULT_PRICING['openai:gpt-4']).toHaveProperty('outputCostPer1M');
    });

    it('should have Anthropic pricing', () => {
      expect(DEFAULT_PRICING).toHaveProperty('anthropic');
      expect(DEFAULT_PRICING).toHaveProperty('anthropic:claude-3-opus');
    });

    it('should have reasonable pricing values', () => {
      const gpt4Pricing = DEFAULT_PRICING['openai:gpt-4'];

      // Prices should be positive
      expect(gpt4Pricing.inputCostPer1M).toBeGreaterThan(0);
      expect(gpt4Pricing.outputCostPer1M).toBeGreaterThan(0);

      // Output should typically cost more than input
      expect(gpt4Pricing.outputCostPer1M).toBeGreaterThan(gpt4Pricing.inputCostPer1M);
    });
  });
});
