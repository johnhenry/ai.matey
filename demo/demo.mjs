/**
 * AI.Matey Ultimate Kitchen-Sink Demo
 *
 * This comprehensive demo showcases ALL features of ai.matey in a single file:
 *
 * PART 0: Setup & Configuration
 * PART 1: Backend Adapters - Basic Usage
 * PART 2: Streaming Responses
 * PART 3: Multi-Backend Comparison
 * PART 4: Request/Response Conversion
 * PART 5: Router System
 * PART 6: Parallel Dispatch
 * PART 7: Bridge Testing
 * PART 8: HTTP Listener
 * PART 9: SDK Wrappers (OpenAI, Anthropic, Chrome AI)
 * PART 10: Summary
 *
 * Run this regularly to verify everything is working!
 *
 * Usage:
 *   node demo/demo.mjs              # Run all demos
 *   node demo/demo.mjs --test-only  # Run only specific demos marked with .only
 */

import demo from 'node:test';
import { Readable } from 'stream';

// Import from monorepo packages
import { Bridge, createRouter } from 'ai.matey.core';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend.anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { GeminiBackendAdapter } from 'ai.matey.backend.gemini';
import { OllamaBackendAdapter } from 'ai.matey.backend.ollama';
import { MistralBackendAdapter } from 'ai.matey.backend.mistral';
import { DeepSeekBackendAdapter } from 'ai.matey.backend.deepseek';
import { GroqBackendAdapter } from 'ai.matey.backend.groq';
import { HuggingFaceBackendAdapter } from 'ai.matey.backend.huggingface';
import { LMStudioBackendAdapter } from 'ai.matey.backend.lmstudio';
import { NVIDIABackendAdapter } from 'ai.matey.backend.nvidia';
import { MockBackendAdapter, createEchoBackend } from 'ai.matey.backend.mock';
import { NodeHTTPListener } from 'ai.matey.http.node';

// SDK Wrappers - each in their own package
import { OpenAI } from 'ai.matey.wrapper.openai-sdk';
import { Anthropic } from 'ai.matey.wrapper.anthropic-sdk';
import { ChromeAILanguageModel } from 'ai.matey.wrapper.chrome-ai';

// Conversion utilities - from CLI package
import {
  toOpenAIRequest,
  toAnthropicRequest,
  toGeminiRequest,
  toMultipleRequestFormats,
  toOpenAI,
  toAnthropic,
  toGemini,
  toMultipleFormats,
} from 'ai.matey.cli';

// Import native backends (Node.js only) - optional, may not be available
let NodeLlamaCppBackend, AppleBackend;
try {
  const nativeModule = await import('ai.matey.native.node-llamacpp');
  NodeLlamaCppBackend = nativeModule.NodeLlamaCppBackend;
} catch {
  // Node-llama-cpp not available
}
try {
  const appleModule = await import('ai.matey.native.apple');
  AppleBackend = appleModule.AppleBackend;
} catch {
  // Apple backend not available
}

// ============================================================================
// PART 0: Setup & Configuration
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('🏴‍☠️ AI.MATEY - ULTIMATE KITCHEN-SINK DEMO');
console.log('='.repeat(80));
console.log('\nThis comprehensive demo showcases ALL ai.matey features:\n');
console.log('  0. Setup & Configuration');
console.log('  1. Backend Adapters (Basic Usage)');
console.log('  2. Streaming Responses');
console.log('  3. Multi-Backend Comparison');
console.log('  4. Request/Response Conversion');
console.log('  5. Router System');
console.log('  6. Parallel Dispatch');
console.log('  7. Bridge Testing');
console.log('  8. HTTP Listener');
console.log('  9. SDK Wrappers (OpenAI, Anthropic, Chrome AI)\n');

// Load API keys from web.env.local.mjs
const { api_keys } = await import('../web.env.local.mjs')
  .then((response) => response.default)
  .catch((e) => {
    console.error('Error loading environment variables from web.env.local.mjs:', e);
    console.error('Please create web.env.local.mjs with your API keys.');
    process.exit(1);
  });

// Backend configurations - only include backends with API keys
const backendConfigs = {
  // Always include mock backend
  mock: {
    adapter: () => createEchoBackend(),
    config: {},
    model: 'echo-model',
    description: 'Mock backend for testing (echoes input)',
  },

  // Conditionally add backends based on API key availability
  ...(api_keys.openai ? {
    openai: {
      adapter: OpenAIBackendAdapter,
      config: { apiKey: api_keys.openai },
      model: 'gpt-4o-mini',
    }
  } : {}),

  ...(api_keys.anthropic ? {
    anthropic: {
      adapter: AnthropicBackendAdapter,
      config: { apiKey: api_keys.anthropic },
      model: 'claude-3-5-sonnet-20241022',
    }
  } : {}),

  ...(api_keys.gemini ? {
    gemini: {
      adapter: GeminiBackendAdapter,
      config: { apiKey: api_keys.gemini },
      model: 'gemini-1.5-flash-latest',
    }
  } : {}),

  ...(api_keys.deepseek ? {
    deepseek: {
      adapter: DeepSeekBackendAdapter,
      config: { apiKey: api_keys.deepseek },
      model: 'deepseek-chat',
    }
  } : {}),

  ...(api_keys.groq ? {
    groq: {
      adapter: GroqBackendAdapter,
      config: { apiKey: api_keys.groq },
      model: 'llama-3.1-8b-instant',
    }
  } : {}),

  ...(api_keys.mistral ? {
    mistral: {
      adapter: MistralBackendAdapter,
      config: { apiKey: api_keys.mistral },
      model: 'mistral-tiny',
    }
  } : {}),

  ...(api_keys.huggingface ? {
    huggingface: {
      adapter: HuggingFaceBackendAdapter,
      config: { apiKey: api_keys.huggingface },
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
    }
  } : {}),

  ...(api_keys.nvidia ? {
    nvidia: {
      adapter: NVIDIABackendAdapter,
      config: { apiKey: api_keys.nvidia },
      model: 'meta/llama3-8b-instruct',
    }
  } : {}),

  ...(api_keys.ollama ? {
    ollama: {
      adapter: OllamaBackendAdapter,
      config: { baseURL: 'http://localhost:11434' },
      model: 'llama3.2:latest',
    }
  } : {}),

  ...(api_keys.lmstudio ? {
    lmstudio: {
      adapter: LMStudioBackendAdapter,
      config: { baseURL: api_keys.lmstudio_baseurl || 'http://localhost:1234/v1' },
      model: api_keys.lmstudio_model || 'phi-4-mini-reasoning-mlx',
      description: 'Local LM Studio instance',
    }
  } : {}),

  ...(api_keys.llamacpp_enabled ? {
    llamacpp: {
      adapter: NodeLlamaCppBackend,
      config: {
        modelPath: api_keys.llamacpp_model || './models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        contextSize: api_keys.llamacpp_context_size || 2048,
        gpuLayers: api_keys.llamacpp_gpu_layers || 0,
        temperature: 0.7,
      },
      model: 'TinyLlama-1.1B',
      description: 'Local model via node-llama-cpp',
    }
  } : {}),

  ...(api_keys.apple_enabled ? {
    apple: {
      adapter: AppleBackend,
      config: {
        instructions: api_keys.apple_instructions || 'You are a helpful assistant.',
        maximumResponseTokens: api_keys.apple_max_tokens || 2048,
        temperature: api_keys.apple_temperature || 0.7,
        samplingMode: api_keys.apple_sampling || 'default',
      },
      model: 'Apple Foundation Model',
      description: 'Apple on-device AI (macOS 15+ Sequoia)',
    }
  } : {}),
};

// Create backend instances
const backends = {};
for (const [name, config] of Object.entries(backendConfigs)) {
  try {
    const adapter = typeof config.adapter === 'function' && name === 'mock'
      ? config.adapter()
      : new config.adapter(config.config);

    backends[name] = {
      adapter,
      model: config.model,
      description: config.description,
    };

    // Initialize node-llama-cpp backends
    if (name === 'llamacpp' && typeof adapter.initialize === 'function') {
      try {
        console.log(`Initializing ${name} backend...`);
        await adapter.initialize();
        console.log(`✓ Initialized ${name} backend`);
      } catch (error) {
        console.error(`Failed to initialize ${name}:`, error.message);
        delete backends[name]; // Remove if failed to initialize
      }
    }
  } catch (error) {
    console.error(`Failed to create ${name} backend:`, error.message);
  }
}

// Helper to convert ReadableStream to async iterator for Node.js
async function* streamToAsyncIterator(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// Display configuration summary
if (Object.keys(backends).length === 0) {
  console.error('❌ No backends available!');
  console.error('Please add API keys to web.env.local.mjs');
  process.exit(1);
}

const enabledCount = Object.keys(backends).length;
const disabledCount = Object.keys(backendConfigs).length - enabledCount;
console.log(`Enabled backends: ${enabledCount}`);
if (disabledCount > 0) {
  console.log(`Disabled backends: ${disabledCount} (missing API keys)`);
}
console.log();

// ============================================================================
// PART 1: Backend Adapters - Basic Usage
// ============================================================================

demo('PART 1: Backend Adapters - Basic Usage', async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🏴‍☠️ PART 1: Backend Adapters - Basic Usage');
  console.log('='.repeat(80) + '\n');
  console.log('📖 This shows the simplest way to use ai.matey:');
  console.log('   Direct backend adapter usage with execute()\n');

  const [name, { adapter, model }] = Object.entries(backends).find(([n]) => n !== 'mock') || [];

  if (!name) {
    console.log('⚠️  No real backends available. Using mock backend...\n');
    const mockBackend = backends.mock;

    const response = await mockBackend.adapter.execute({
      messages: [{ role: 'user', content: 'Hello, AI!' }],
      parameters: { model: mockBackend.model },
      metadata: {
        requestId: `basic-${Date.now()}`,
        timestamp: Date.now(),
      },
    });

    const content = typeof response.message.content === 'string'
      ? response.message.content
      : response.message.content.find(c => c.type === 'text')?.text || '';

    console.log(`Response: ${content}`);
    console.log('✓ Basic demo complete (mock backend)\n');
    return;
  }

  console.log(`Using backend: ${name.toUpperCase()}`);
  console.log(`Model: ${model}\n`);

  const response = await adapter.execute({
    messages: [{ role: 'user', content: 'What is 2+2?' }],
    parameters: {
      model,
      temperature: 0.7,
      maxTokens: 100,
    },
    metadata: {
      requestId: `basic-${Date.now()}`,
      timestamp: Date.now(),
    },
  });

  const content = typeof response.message.content === 'string'
    ? response.message.content
    : response.message.content.find(c => c.type === 'text')?.text || '';

  console.log(`Response: ${content}\n`);
  if (response.usage) {
    console.log(`Usage: ${response.usage.totalTokens} tokens`);
  }
  console.log('✓ Basic backend demo complete\n');
});

// ============================================================================
// PART 2: Streaming Responses
// ============================================================================

demo('PART 2: Streaming Responses', async () => {
  console.log('='.repeat(80));
  console.log('🌊 PART 2: Streaming Responses');
  console.log('='.repeat(80) + '\n');

  const [name, { adapter, model }] = Object.entries(backends)[0] || [];

  if (!name) {
    console.log('❌ No backends available for streaming demo');
    return;
  }

  console.log(`Using: ${name.toUpperCase()}\n`);
  console.log(`Prompt: "Count from 1 to 5"`);
  process.stdout.write(`Response: `);

  const stream = adapter.executeStream({
    messages: [
      { role: 'user', content: 'Count from 1 to 5, each number on a new line.' }
    ],
    parameters: {
      model,
      temperature: 0.7,
    },
    metadata: {
      requestId: `stream-demo-${Date.now()}`,
      timestamp: Date.now(),
    },
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content' && typeof chunk.delta === 'string') {
      process.stdout.write(chunk.delta);
    } else if (chunk.type === 'done') {
      console.log('\n\n✓ Streaming complete');
      if (chunk.usage) {
        console.log(`📊 Tokens: ${chunk.usage.totalTokens}`);
      }
    } else if (chunk.type === 'error') {
      console.log(`\n✗ Error: ${chunk.error}`);
    }
  }
  console.log();
});

// ============================================================================
// PART 3: Multi-Backend Comparison
// ============================================================================

demo('PART 3: Multi-Backend Comparison', { skip: Object.keys(backends).length <= 1 }, async () => {
  console.log('='.repeat(80));
  console.log('🔄 PART 3: Multi-Backend Comparison');
  console.log('='.repeat(80) + '\n');

  for (const [name, { adapter, model }] of Object.entries(backends)) {
    try {
      console.log('\n' + '─'.repeat(50));
      console.log(`Testing: ${name.toUpperCase()}`);
      console.log(`Model: ${model}`);
      console.log('─'.repeat(50) + '\n');

      const startTime = Date.now();

      const response = await adapter.execute({
        messages: [
          { role: 'user', content: 'Tell me a fun fact about space in one sentence.' }
        ],
        parameters: {
          model,
          temperature: 0.8,
          maxTokens: 100,
        },
        metadata: {
          requestId: `demo-${name}-${Date.now()}`,
          timestamp: Date.now(),
        },
      });

      const duration = Date.now() - startTime;

      const content = response.message.content;
      const text = typeof content === 'string'
        ? content
        : content.find(c => c.type === 'text')?.text || 'No response';

      console.log(`Response: ${text}\n`);

      console.log(`⏱️  Duration: ${duration}ms`);
      if (response.usage) {
        console.log(`📊 Tokens: ${response.usage.totalTokens} (${response.usage.promptTokens} prompt + ${response.usage.completionTokens} completion)`);
      }
      console.log(`✓ ${name} complete`);
    } catch (error) {
      console.log(`✗ Error with ${name}: ${error.message}`);
    }
  }
  console.log();
});

// ============================================================================
// PART 4: Request/Response Conversion
// ============================================================================

demo('PART 4: Request/Response Conversion', async () => {
  console.log('='.repeat(80));
  console.log('🔄 PART 4: Request/Response Conversion');
  console.log('='.repeat(80) + '\n');
  console.log('Demonstrates the symmetry between request and response converters.');
  console.log('Shows what gets sent to providers and what comes back.\n');

  // Create sample IR request
  const irRequest = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, how are you?' }
    ],
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 100,
    },
    metadata: {
      requestId: 'demo-conversion',
      timestamp: Date.now(),
      provenance: { frontend: 'demo' },
    },
  };

  // Get a mock response
  const backend = createEchoBackend();
  const irResponse = await backend.execute(irRequest);

  console.log('──────────────────────────────────────────────────');
  console.log('REQUEST CONVERSION: What Gets Sent to Providers');
  console.log('──────────────────────────────────────────────────\n');

  // Convert to different provider formats
  const openaiReq = toOpenAIRequest(irRequest);
  console.log('✓ OpenAI Request Format:');
  console.log(`  Messages: ${openaiReq.messages.length}`);
  console.log(`  System in messages: ${openaiReq.messages.some(m => m.role === 'system')}\n`);

  const anthropicReq = toAnthropicRequest(irRequest);
  console.log('✓ Anthropic Request Format:');
  console.log(`  Messages: ${anthropicReq.messages.length}`);
  console.log(`  Separate system parameter: ${!!anthropicReq.system}\n`);

  const geminiReq = toGeminiRequest(irRequest);
  console.log('✓ Gemini Request Format:');
  console.log(`  Contents: ${geminiReq.contents?.length || 0}`);
  console.log(`  System instruction: ${!!geminiReq.systemInstruction}\n`);

  console.log('──────────────────────────────────────────────────');
  console.log('RESPONSE CONVERSION: What Comes Back');
  console.log('──────────────────────────────────────────────────\n');

  // Convert IR response to different formats
  const openaiResp = await toOpenAI(irResponse);
  console.log('✓ OpenAI Response Format:');
  console.log(`  ID: ${openaiResp.id}`);
  console.log(`  Type: ${openaiResp.object}`);
  console.log(`  Choices: ${openaiResp.choices.length}\n`);

  const anthropicResp = await toAnthropic(irResponse);
  console.log('✓ Anthropic Response Format:');
  console.log(`  ID: ${anthropicResp.id}`);
  console.log(`  Type: ${anthropicResp.type}`);
  console.log(`  Content blocks: ${anthropicResp.content.length}\n`);

  const geminiResp = await toGemini(irResponse);
  console.log('✓ Gemini Response Format:');
  console.log(`  Candidates: ${geminiResp.candidates?.length || 0}`);
  console.log(`  Usage metadata: ${!!geminiResp.usageMetadata}\n`);

  console.log('💡 Use Case: Debug API integrations, test without API calls\n');
  console.log('✓ Request/Response conversion demo complete\n');
});

// ============================================================================
// PART 5: Router System
// ============================================================================

demo('PART 5: Router System', { skip: Object.keys(backends).length < 2 }, async () => {
  console.log('='.repeat(80));
  console.log('🚦 PART 5: Router System');
  console.log('='.repeat(80) + '\n');
  console.log('Demonstrates routing strategies, fallbacks, and circuit breakers.\n');

  const router = createRouter({
    routingStrategy: 'model-based',
    defaultBackend: 'mock',
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 3,
  });

  // Register available backends
  let registeredCount = 0;
  for (const [name, { adapter }] of Object.entries(backends)) {
    router.register(name, adapter);
    registeredCount++;
  }

  console.log(`✓ Registered ${registeredCount} backends\n`);

  // Set model mapping
  const backendNames = Object.keys(backends);
  if (backendNames.length >= 2) {
    const modelMapping = {};
    if (backends.openai) modelMapping['gpt-4'] = 'openai';
    if (backends.anthropic) modelMapping['claude-3-opus'] = 'anthropic';
    if (backends.gemini) modelMapping['gemini-pro'] = 'gemini';

    router.setModelMapping(modelMapping);
    console.log('✓ Set model mapping:', Object.keys(modelMapping).length, 'models\n');
  }

  // Test routing
  const testRequest = {
    messages: [{ role: 'user', content: 'Hello' }],
    parameters: { model: 'gpt-4' },
    metadata: { requestId: 'router-test', timestamp: Date.now() },
  };

  try {
    const selectedBackend = await router.selectBackend(testRequest);
    console.log(`✓ Selected backend for model "gpt-4": ${selectedBackend}\n`);
  } catch (error) {
    console.log(`  Using default backend (model not mapped)\n`);
  }

  // Get router stats
  const stats = router.getStats();
  console.log('Router Statistics:');
  console.log(`  Total backends: ${stats.totalBackends}`);
  console.log(`  Healthy backends: ${stats.healthyBackends}`);
  console.log(`  Total requests: ${stats.totalRequests}\n`);

  console.log('✓ Router system demo complete\n');
});

// ============================================================================
// PART 6: Parallel Dispatch
// ============================================================================

demo('PART 6: Parallel Dispatch', { skip: Object.keys(backends).length < 2 }, async () => {
  console.log('='.repeat(80));
  console.log('🚀 PART 6: Parallel Dispatch');
  console.log('='.repeat(80) + '\n');
  console.log('Query multiple backends simultaneously and aggregate responses.\n');

  const router = createRouter();

  // Register at least 2 backends
  const availableBackends = Object.entries(backends).slice(0, 3);
  for (const [name, { adapter }] of availableBackends) {
    router.register(name, adapter);
  }

  const backendNames = availableBackends.map(([name]) => name);
  console.log(`Testing with backends: ${backendNames.join(', ')}\n`);

  const testRequest = {
    messages: [{ role: 'user', content: 'Say hello in a unique way' }],
    parameters: {
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 50,
    },
  };

  console.log('──────────────────────────────────────────────────');
  console.log('STRATEGY: ALL - Get Every Response');
  console.log('──────────────────────────────────────────────────\n');

  try {
    const allResult = await router.dispatchParallel(testRequest, {
      strategy: 'all',
      backends: backendNames,
    });

    console.log(`✓ Received ${allResult.allResponses.length} responses:\n`);

    allResult.allResponses.forEach(({ backend, latencyMs }, index) => {
      console.log(`${index + 1}. [${backend}] - ${latencyMs}ms`);
    });

    console.log(`\nSuccessful: ${allResult.successfulBackends.length}`);
    console.log(`Failed: ${allResult.failedBackends.length}`);
    console.log(`Total time: ${allResult.totalTimeMs}ms\n`);
  } catch (error) {
    console.log(`⚠️  Parallel dispatch error (expected with test keys): ${error.message}\n`);
  }

  console.log('💡 Use Cases:');
  console.log('  • Model comparison (GPT vs Claude vs Gemini)');
  console.log('  • A/B testing');
  console.log('  • Consensus/voting');
  console.log('  • Fast fallback strategies\n');

  console.log('✓ Parallel dispatch demo complete\n');
});

// ============================================================================
// PART 7: Bridge Testing
// ============================================================================

demo('PART 7: Bridge Testing', async () => {
  console.log('='.repeat(80));
  console.log('🌉 PART 7: Bridge Testing');
  console.log('='.repeat(80) + '\n');
  console.log('Demonstrates frontend/backend adapter connection via Bridge.\n');

  // Create frontend and backend adapters
  const frontend = new AnthropicFrontendAdapter();
  const mockBackend = createEchoBackend();

  console.log(`Frontend: ${frontend.metadata.name}`);
  console.log(`Backend: ${mockBackend.metadata.name}\n`);

  // Create bridge
  const bridge = new Bridge(frontend, mockBackend, {
    debug: false,
    timeout: 30000,
  });

  console.log('✓ Bridge created successfully\n');

  // Test non-streaming
  console.log('Testing non-streaming chat...');
  const request = {
    model: 'test-model',
    messages: [
      { role: 'user', content: 'Hello from Bridge!' }
    ],
    max_tokens: 100,
  };

  try {
    const response = await bridge.chat(request);
    console.log(`✓ Response ID: ${response.id}`);
    console.log(`  Stop reason: ${response.stop_reason}`);
    console.log(`  Content blocks: ${response.content.length}\n`);
  } catch (error) {
    console.log(`✗ Chat error: ${error.message}\n`);
  }

  // Test streaming
  console.log('Testing streaming chat...');
  const streamRequest = {
    model: 'test-model',
    messages: [
      { role: 'user', content: 'Count to 3' }
    ],
    max_tokens: 50,
    stream: true,
  };

  try {
    let chunkCount = 0;
    const stream = bridge.chatStream(streamRequest);

    for await (const chunk of stream) {
      chunkCount++;
      if (chunk.type === 'message_stop') {
        console.log(`✓ Stream complete (${chunkCount} chunks)\n`);
      }
    }
  } catch (error) {
    console.log(`✗ Stream error: ${error.message}\n`);
  }

  console.log('✓ Bridge testing demo complete\n');
});

// ============================================================================
// PART 8: HTTP Listener
// ============================================================================

demo('PART 8: HTTP Listener', async () => {
  console.log('='.repeat(80));
  console.log('🌐 PART 8: HTTP Listener');
  console.log('='.repeat(80) + '\n');
  console.log('Demonstrates HTTP request handling via NodeHTTPListener.\n');

  // Create a simple mock backend
  class SimpleMockBackend {
    metadata = {
      name: 'simple-mock',
      version: '1.0.0',
      provider: 'mock',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        maxContextTokens: 4096,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
      },
    };

    async execute() {
      return {
        message: { role: 'assistant', content: 'Hello from HTTP listener!' },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        metadata: { requestId: 'http-test', timestamp: Date.now(), provenance: {} },
      };
    }

    async *executeStream() {
      yield { type: 'message_start', message: { id: 'msg_http', type: 'message', role: 'assistant', model: 'mock' } };
      yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello ' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'HTTP!' } };
      yield { type: 'content_block_stop', index: 0 };
      yield { type: 'message_stop' };
    }
  }

  const frontend = new AnthropicFrontendAdapter();
  const backend = new SimpleMockBackend();
  const bridge = new Bridge(frontend, backend);

  const listener = NodeHTTPListener(bridge);

  // Create mock HTTP request
  const req = new Readable();
  req.method = 'POST';
  req.url = '/v1/messages';
  req.headers = { 'content-type': 'application/json' };
  req.socket = { remoteAddress: '127.0.0.1' };
  req.push(JSON.stringify({
    model: 'test-model',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello!' }],
  }));
  req.push(null);

  // Create mock HTTP response
  const res = {
    statusCode: 200,
    _headers: {},
    _body: '',
    writable: true,
    setHeader(name, value) {
      this._headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this._headers[name.toLowerCase()];
    },
    write(chunk) {
      this._body += chunk;
    },
    end(data) {
      if (data) this._body = data;
      this.writable = false;
    },
    on() {},
  };

  try {
    await listener(req, res);
    console.log(`✓ HTTP Status: ${res.statusCode}`);
    console.log(`  Content-Type: ${res._headers['content-type']}`);
    console.log(`  Body length: ${res._body.length} bytes\n`);
  } catch (error) {
    console.log(`✗ HTTP listener error: ${error.message}\n`);
  }

  console.log('✓ HTTP listener demo complete\n');
});

// ============================================================================
// PART 9: SDK Wrappers
// ============================================================================

demo('PART 9A: OpenAI SDK Wrapper', { skip: !api_keys.anthropic }, async () => {
  console.log('─'.repeat(80));
  console.log('📦 PART 9A: OpenAI SDK with Anthropic Backend');
  console.log('─'.repeat(80) + '\n');

  const anthropicBackend = new AnthropicBackendAdapter({
    apiKey: api_keys.anthropic,
  });

  const openaiClient = OpenAI(anthropicBackend);

  const completion = await openaiClient.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Tell me a short joke about programming.' }
    ],
    temperature: 0.7,
    max_tokens: 100,
  });

  console.log(`Response: ${completion.choices[0].message.content}\n`);
  console.log('✓ OpenAI SDK wrapper demo complete\n');
});

demo('PART 9B: Anthropic SDK Wrapper', { skip: !api_keys.openai }, async () => {
  console.log('─'.repeat(80));
  console.log('📦 PART 9B: Anthropic SDK with OpenAI Backend');
  console.log('─'.repeat(80) + '\n');

  const openaiBackend = new OpenAIBackendAdapter({
    apiKey: api_keys.openai,
  });

  const anthropicClient = Anthropic(openaiBackend);

  const message = await anthropicClient.messages.create({
    model: 'gpt-4o-mini',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'What is the meaning of life in one sentence?' }
    ],
  });

  console.log(`Response: ${message.content[0].text}\n`);
  console.log('✓ Anthropic SDK wrapper demo complete\n');
});

demo('PART 9C: Chrome AI Non-streaming', { skip: !api_keys.openai }, async () => {
  console.log('─'.repeat(80));
  console.log('📦 PART 9C: Chrome AI API (Non-streaming)');
  console.log('─'.repeat(80) + '\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: api_keys.openai,
  });

  const LanguageModel = ChromeAILanguageModel(backend, {
    temperature: 0.7,
    topK: 40,
  });

  // Check capabilities (from chrome-ai-wrapper-demo.js)
  console.log('Checking capabilities...');
  const capabilities = await LanguageModel.capabilities();
  console.log(`  Available: ${capabilities.available}\n`);

  const session = await LanguageModel.create({
    initialPrompts: [
      { role: 'system', content: 'You are a helpful assistant.' },
    ],
  });

  console.log('Prompt: What is the capital of Japan?');
  const response1 = await session.prompt('What is the capital of Japan?');
  console.log(`Response: ${response1}\n`);

  console.log('Prompt: What is its population?');
  const response2 = await session.prompt('What is its population?');
  console.log(`Response: ${response2}\n`);

  session.destroy();
  console.log('✓ Chrome AI non-streaming demo complete\n');
});

demo('PART 9D: Chrome AI Streaming (Delta)', { skip: !api_keys.openai }, async () => {
  console.log('─'.repeat(80));
  console.log('📦 PART 9D: Chrome AI Streaming (Delta Mode)');
  console.log('─'.repeat(80) + '\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: api_keys.openai,
  });

  const LanguageModel = ChromeAILanguageModel(backend, {
    temperature: 0.7,
    topK: 40,
    streamMode: 'delta',
  });

  const session = await LanguageModel.create({
    initialPrompts: [
      { role: 'system', content: 'You are a creative assistant.' }
    ],
  });

  console.log('Prompt: Tell me a haiku about coding');
  process.stdout.write('Response: ');

  const stream = session.promptStreaming('Tell me a haiku about coding.');

  for await (const chunk of streamToAsyncIterator(stream)) {
    process.stdout.write(chunk);
  }

  console.log('\n');
  session.destroy();
  console.log('✓ Chrome AI streaming (delta) demo complete\n');
});

demo('PART 9E: Chrome AI Streaming (Accumulated)', { skip: !api_keys.openai }, async () => {
  console.log('─'.repeat(80));
  console.log('📦 PART 9E: Chrome AI Streaming (Accumulated Mode)');
  console.log('─'.repeat(80));
  console.log('Each chunk contains the full text so far\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: api_keys.openai,
  });

  const LanguageModelAccumulated = ChromeAILanguageModel(backend, {
    temperature: 0.7,
    topK: 40,
    streamMode: 'accumulated',
  });

  const session2 = await LanguageModelAccumulated.create({
    initialPrompts: [
      { role: 'system', content: 'You are a helpful assistant. Be concise.' }
    ],
  });

  console.log('Prompt: Count to three');
  console.log('Chunks received:');

  const stream2 = session2.promptStreaming('Count to three.');
  let chunkNum = 0;

  for await (const chunk of streamToAsyncIterator(stream2)) {
    console.log(`  Chunk ${++chunkNum}: "${chunk}"`);
  }

  console.log();
  session2.destroy();
  console.log('✓ Chrome AI streaming (accumulated) demo complete\n');
});

// ============================================================================
// PART 10: Summary & Cleanup
// ============================================================================

process.on('exit', async () => {
  // Cleanup: Dispose node-llama-cpp backends
  for (const { adapter } of Object.values(backends)) {
    if (typeof adapter.dispose === 'function') {
      try {
        await adapter.dispose();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
});

demo('PART 10: Summary', async () => {
  console.log('='.repeat(80));
  console.log('🎉 ULTIMATE DEMO COMPLETE!');
  console.log('='.repeat(80));
  console.log(`\nSummary:`);
  console.log(`  ✓ Tested ${Object.keys(backends).length} backend(s)`);
  console.log(`  ✓ Total available: ${Object.keys(backendConfigs).length}`);
  console.log(`  ✓ All major features verified\n`);

  console.log('Features Demonstrated:');
  console.log('  1. Backend Adapters - Direct usage');
  console.log('  2. Streaming - Real-time responses');
  console.log('  3. Multi-Backend - Compare providers');
  console.log('  4. Conversions - Request/Response transforms');
  console.log('  5. Router - Smart routing & fallbacks');
  console.log('  6. Parallel Dispatch - Fan-out queries');
  console.log('  7. Bridge - Frontend/Backend connection');
  console.log('  8. HTTP Listener - Server integration');
  console.log('  9. SDK Wrappers - OpenAI/Anthropic/Chrome AI APIs\n');

  console.log('💡 Tip: Run this demo regularly to ensure everything is working!\n');

  // Cleanup: Stop model runner backends
  for (const { adapter } of Object.values(backends)) {
    if (typeof adapter.stop === 'function') {
      try {
        await adapter.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }

  console.log('='.repeat(80));
  console.log('🏴‍☠️ AI.MATEY - Ready to sail!');
  console.log('='.repeat(80) + '\n');
});
