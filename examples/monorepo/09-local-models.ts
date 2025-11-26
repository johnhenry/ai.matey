/**
 * Local Models Example - Using Native Packages
 *
 * Shows how to use native/local model packages:
 * - Ollama backend (local LLMs)
 * - LM Studio backend
 * - llama.cpp via node binding
 */

// Core imports
import { Bridge, Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

// Local model backends
import { OllamaBackendAdapter } from 'ai.matey.backend.ollama';
import { LMStudioBackendAdapter } from 'ai.matey.backend.lmstudio';

// Cloud backends for fallback
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

async function main() {
  console.log('=== Local Models Examples ===\n');

  // Example 1: Ollama local inference
  console.log('1. Ollama Local Inference:');
  await ollamaExample();

  // Example 2: LM Studio
  console.log('\n2. LM Studio Local Inference:');
  await lmStudioExample();

  // Example 3: Hybrid local + cloud
  console.log('\n3. Hybrid Local + Cloud Routing:');
  await hybridExample();
}

async function ollamaExample() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new OllamaBackendAdapter({
      baseUrl: 'http://localhost:11434', // Default Ollama port
      model: 'llama3.2', // Default model
    })
  );

  try {
    // List available local models
    const models = await bridge.listModels();
    console.log('  Available models:', models.data.map((m) => m.id).join(', '));

    // Make inference request
    const response = await bridge.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
    });

    console.log('  Response:', response.choices[0].message.content);
  } catch (error) {
    console.log('  Ollama not running or model not available');
    console.log('  To use: ollama run llama3.2');
  }
}

async function lmStudioExample() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new LMStudioBackendAdapter({
      baseUrl: 'http://localhost:1234', // Default LM Studio port
    })
  );

  try {
    // LM Studio exposes OpenAI-compatible API
    const response = await bridge.chat({
      model: 'local-model', // LM Studio uses whatever model is loaded
      messages: [{ role: 'user', content: 'Hello from LM Studio!' }],
    });

    console.log('  Response:', response.choices[0].message.content);
  } catch (error) {
    console.log('  LM Studio not running');
    console.log('  To use: Start LM Studio and load a model');
  }
}

async function hybridExample() {
  // Create router that tries local first, falls back to cloud
  const router = new Router(new OpenAIFrontendAdapter(), {
    backends: [
      // Primary: Local Ollama (fast, private, free)
      new OllamaBackendAdapter({
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2',
      }),
      // Fallback: OpenAI cloud (reliable, but costs money)
      new OpenAIBackendAdapter({
        apiKey: process.env.OPENAI_API_KEY || 'sk-...',
      }),
    ],
    strategy: 'priority',
    fallbackStrategy: 'next',
  });

  // Listen for backend switches
  router.on('backend:switch', (event) => {
    console.log(`  Switched backend: ${event.data.from} -> ${event.data.to}`);
  });

  try {
    const response = await router.chat({
      model: 'gpt-4', // Request GPT-4 format, will be handled by available backend
      messages: [{ role: 'user', content: 'What is the capital of Japan?' }],
    });

    console.log('  Response:', response.choices[0].message.content);
    console.log('  Stats:', router.getStats());
  } catch (error) {
    console.log('  All backends failed:', (error as Error).message);
  }
}

main().catch(console.error);
