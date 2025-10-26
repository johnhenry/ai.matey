/**
 * LlamaCpp Backend Example
 *
 * This example demonstrates how to use the LlamaCppBackend to run local models
 * via llama.cpp binaries. Shows both stdio and HTTP communication modes.
 *
 * Prerequisites:
 * 1. Install llama.cpp: https://github.com/ggerganov/llama.cpp
 * 2. Build the binaries:
 *    - llama-server for HTTP mode
 *    - llama-cli for stdio mode
 * 3. Download a GGUF model file
 *
 * @example
 */

import {
  LlamaCppBackend,
  type ModelRunnerBackendConfig,
} from '../src/adapters/backend-native/model-runners/index.js';
import type { IRChatRequest } from '../src/types/ir.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Example 1: HTTP Mode (Recommended for production)
 *
 * Uses llama-server binary which provides an OpenAI-compatible HTTP API.
 * This is more robust and feature-complete than stdio mode.
 */
const httpConfig: ModelRunnerBackendConfig = {
  // Path to your GGUF model file
  model: './models/llama-3.1-8b-instruct.Q4_K_M.gguf',

  // Process configuration
  process: {
    // Path to llama-server binary
    command: '/usr/local/bin/llama-server',
    // Optional: Set environment variables
    env: {
      // Uncomment to force CPU mode
      // CUDA_VISIBLE_DEVICES: '',
    },
  },

  // HTTP communication
  communication: {
    type: 'http',
    baseURL: 'http://localhost:{port}',
    healthEndpoint: '/health',
    chatEndpoint: '/v1/chat/completions',
  },

  // Runtime configuration
  runtime: {
    contextSize: 4096, // Context window size
    gpuLayers: 35, // Number of layers to offload to GPU (0 for CPU only)
    threads: 8, // CPU threads to use
    batchSize: 512, // Batch size for prompt processing
    keepAlive: true, // Keep model loaded in memory
    mmap: true, // Memory map the model file
    mlock: false, // Lock model in memory (prevents swapping)
  },

  // Lifecycle configuration
  lifecycle: {
    autoStart: false, // Start manually
    autoStop: true, // Stop when disposed
    startupTimeout: 60000, // 60 seconds to start
    shutdownTimeout: 5000, // 5 seconds for graceful shutdown
    autoRestart: false, // Don't auto-restart on crash
    maxRestarts: 3, // Max restart attempts
    healthCheckInterval: 30000, // Health check every 30 seconds
  },

  // Port for HTTP server
  port: 8080,

  // Prompt template (choose based on your model)
  // Options: 'llama2', 'llama3', 'chatml', 'alpaca', 'mistral'
  promptTemplate: 'llama3',
};

/**
 * Example 2: stdio Mode (Experimental)
 *
 * Uses llama-cli in interactive mode with stdio communication.
 * This is more lightweight but less robust than HTTP mode.
 */
const stdioConfig: ModelRunnerBackendConfig = {
  model: './models/llama-3.1-8b-instruct.Q4_K_M.gguf',

  process: {
    command: '/usr/local/bin/llama-cli',
  },

  communication: {
    type: 'stdio',
    inputFormat: 'raw-text',
    outputFormat: 'raw-text',
    delimiter: '\n',
  },

  runtime: {
    contextSize: 4096,
    gpuLayers: 35,
    threads: 8,
  },

  lifecycle: {
    autoStart: false,
    autoStop: true,
    startupTimeout: 60000,
  },

  promptTemplate: 'llama3',
};

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Basic usage example
 */
async function basicExample() {
  console.log('=== Basic Usage Example ===\n');

  // Create backend with HTTP mode
  const backend = new LlamaCppBackend(httpConfig);

  // Listen to events
  backend.on('starting', () => console.log('🚀 Starting llama.cpp...'));
  backend.on('ready', () => console.log('✅ Ready!'));
  backend.on('error', (error) => console.error('❌ Error:', error.message));
  backend.on('stopped', () => console.log('🛑 Stopped'));

  try {
    // Start the backend
    console.log('Starting backend...');
    await backend.start();

    // Check stats
    const stats = backend.getStats();
    console.log('\nBackend stats:', {
      isRunning: stats.isRunning,
      pid: stats.pid,
      requestCount: stats.requestCount,
    });

    // Create a request
    const request: IRChatRequest = {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'What is the capital of France?',
        },
      ],
      parameters: {
        temperature: 0.7,
        maxTokens: 100,
      },
    };

    // Execute request
    console.log('\nSending request...');
    const response = await backend.execute(request);

    console.log('\nResponse:');
    console.log('- Model:', response.model);
    console.log('- Finish reason:', response.finishReason);
    console.log('- Content:', response.message.content[0]);
    if (response.usage) {
      console.log('- Usage:', response.usage);
    }
  } finally {
    // Clean up
    await backend.stop();
  }
}

/**
 * Streaming example
 */
async function streamingExample() {
  console.log('\n=== Streaming Example ===\n');

  const backend = new LlamaCppBackend(httpConfig);

  try {
    await backend.start();
    console.log('Backend started\n');

    const request: IRChatRequest = {
      messages: [
        {
          role: 'user',
          content: 'Write a short poem about coding.',
        },
      ],
      parameters: {
        temperature: 0.9,
        maxTokens: 200,
      },
    };

    console.log('Streaming response:\n');
    let fullText = '';

    for await (const chunk of backend.executeStream(request)) {
      if (chunk.type === 'content' && chunk.delta?.content) {
        const text = chunk.delta.content[0];
        if (text.type === 'text') {
          process.stdout.write(text.text);
          fullText += text.text;
        }
      } else if (chunk.type === 'done') {
        console.log('\n\n✅ Stream complete');
        console.log('Finish reason:', chunk.finishReason);
      }
    }

    console.log('\nFull response length:', fullText.length);
  } finally {
    await backend.stop();
  }
}

/**
 * Multiple requests example
 */
async function multipleRequestsExample() {
  console.log('\n=== Multiple Requests Example ===\n');

  const backend = new LlamaCppBackend(httpConfig);

  try {
    await backend.start();
    console.log('Backend started\n');

    const questions = [
      'What is 2 + 2?',
      'What is the speed of light?',
      'Who wrote Romeo and Juliet?',
    ];

    for (const question of questions) {
      console.log(`Q: ${question}`);

      const response = await backend.execute({
        messages: [{ role: 'user', content: question }],
        parameters: { temperature: 0.3, maxTokens: 50 },
      });

      const answer = response.message.content[0];
      if (answer.type === 'text') {
        console.log(`A: ${answer.text}\n`);
      }
    }

    // Check final stats
    const stats = backend.getStats();
    console.log('Final stats:', {
      requestCount: stats.requestCount,
      uptime: stats.uptime ? `${(stats.uptime / 1000).toFixed(2)}s` : undefined,
    });
  } finally {
    await backend.stop();
  }
}

/**
 * Custom prompt template example
 */
async function customTemplateExample() {
  console.log('\n=== Custom Prompt Template Example ===\n');

  // Create config with custom template
  const customConfig: ModelRunnerBackendConfig = {
    ...httpConfig,
    promptTemplate: {
      name: 'custom',
      systemTemplate: '<<SYSTEM>>\n{content}\n<</SYSTEM>>',
      userTemplate: '<<USER>>\n{content}\n<</USER>>',
      assistantTemplate: '<<ASSISTANT>>\n{content}\n<</ASSISTANT>>',
      bosToken: '<BOS>',
      eosToken: '<EOS>',
      addGenerationPrompt: true,
    },
  };

  const backend = new LlamaCppBackend(customConfig);

  try {
    await backend.start();

    const response = await backend.execute({
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi!' },
      ],
    });

    console.log('Response:', response.message.content[0]);
  } finally {
    await backend.stop();
  }
}

/**
 * Error handling example
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');

  // Create backend with invalid config to demonstrate error handling
  const backend = new LlamaCppBackend({
    ...httpConfig,
    model: './models/nonexistent.gguf',
    lifecycle: {
      ...httpConfig.lifecycle,
      startupTimeout: 5000, // Short timeout
    },
  });

  backend.on('error', (error) => {
    console.log('Caught error event:', error.message);
  });

  try {
    await backend.start();
  } catch (error) {
    console.log('Caught error in try/catch:', (error as Error).message);
  }

  // Try to execute without starting
  const backend2 = new LlamaCppBackend(httpConfig);
  try {
    await backend2.execute({
      messages: [{ role: 'user', content: 'Hi' }],
    });
  } catch (error) {
    console.log('Caught execution error:', (error as Error).message);
  }
}

/**
 * stdio mode example
 */
async function stdioModeExample() {
  console.log('\n=== stdio Mode Example ===\n');

  const backend = new LlamaCppBackend(stdioConfig);

  // Monitor stdout/stderr
  backend.on('stdout', (data) => {
    console.log('[stdout]', data);
  });
  backend.on('stderr', (data) => {
    console.log('[stderr]', data);
  });

  try {
    await backend.start();
    console.log('Backend started in stdio mode\n');

    const response = await backend.execute({
      messages: [{ role: 'user', content: 'Hello!' }],
      parameters: { maxTokens: 50 },
    });

    console.log('Response:', response.message.content[0]);
  } finally {
    await backend.stop();
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('LlamaCpp Backend Examples\n');
  console.log('='.repeat(50));

  try {
    // Run examples
    // Uncomment the ones you want to run:

    await basicExample();
    // await streamingExample();
    // await multipleRequestsExample();
    // await customTemplateExample();
    // await errorHandlingExample();
    // await stdioModeExample();

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for use in other examples
export {
  httpConfig,
  stdioConfig,
  basicExample,
  streamingExample,
  multipleRequestsExample,
  customTemplateExample,
  errorHandlingExample,
  stdioModeExample,
};
