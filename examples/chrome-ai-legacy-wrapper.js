/**
 * Legacy Chrome AI Wrapper Example
 *
 * This example shows how to use the legacy Chrome AI API wrapper
 * (the old API before recent changes) with different backend providers.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node examples/chrome-ai-legacy-wrapper.js
 */

import { OpenAIBackendAdapter } from '../dist/esm/adapters/backend/openai.js';
import {
  LegacyChromeAILanguageModel,
  createLegacyWindowAI,
  polyfillLegacyWindowAI,
} from '../dist/esm/wrappers/chrome-ai-legacy.js';

// ============================================================================
// Example 1: Direct Usage
// ============================================================================

async function example1() {
  console.log('\n=== Example 1: Direct Usage ===\n');

  // Create backend adapter
  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
  });

  // Create legacy languageModel API
  const languageModel = LegacyChromeAILanguageModel(backend);

  // Check capabilities
  const caps = await languageModel.capabilities();
  console.log('Capabilities:', caps);

  // Create session
  const session = await languageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful assistant who speaks like a pirate.',
      },
    ],
    temperature: 0.8,
  });

  // Non-streaming prompt
  console.log('\nPrompt: "Tell me a joke."');
  const response = await session.prompt('Tell me a joke.');
  console.log('Response:', response);

  // Check token usage
  console.log('\nToken tracking:');
  console.log('- Tokens so far:', session.tokensSoFar);
  console.log('- Max tokens:', session.maxTokens);
  console.log('- Tokens left:', session.tokensLeft);

  // Cleanup
  session.destroy();
}

// ============================================================================
// Example 2: Streaming
// ============================================================================

async function example2() {
  console.log('\n=== Example 2: Streaming ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
  });

  const languageModel = LegacyChromeAILanguageModel(backend);

  const session = await languageModel.create({
    temperature: 0.7,
  });

  console.log('Prompt: "Count from 1 to 10."');
  console.log('Response (streaming):');

  // Streaming prompt (async iterator)
  for await (const chunk of session.promptStreaming('Count from 1 to 10.')) {
    process.stdout.write(chunk);
  }

  console.log('\n\nToken usage:', session.tokensSoFar);

  session.destroy();
}

// ============================================================================
// Example 3: window.ai Style
// ============================================================================

async function example3() {
  console.log('\n=== Example 3: window.ai Style ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
  });

  // Create window.ai-style object
  const ai = createLegacyWindowAI(backend);

  // Use like original window.ai
  const session = await ai.languageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful coding assistant.',
      },
    ],
  });

  const response = await session.prompt('What is a closure in JavaScript?');
  console.log('Response:', response);

  session.destroy();
}

// ============================================================================
// Example 4: Session Cloning
// ============================================================================

async function example4() {
  console.log('\n=== Example 4: Session Cloning ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
  });

  const languageModel = LegacyChromeAILanguageModel(backend);

  // Create original session
  const session1 = await languageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ],
  });

  await session1.prompt('Remember: my favorite color is blue.');
  console.log('Session 1 - Asked to remember favorite color is blue');

  // Clone session (same config, no history)
  const session2 = session1.clone();

  const response1 = await session1.prompt('What is my favorite color?');
  console.log('\nSession 1 response:', response1);

  const response2 = await session2.prompt('What is my favorite color?');
  console.log('Session 2 (cloned) response:', response2);

  session1.destroy();
  session2.destroy();
}

// ============================================================================
// Example 5: Global Polyfill
// ============================================================================

async function example5() {
  console.log('\n=== Example 5: Global Polyfill ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
  });

  // Polyfill global.ai (window.ai in browser)
  polyfillLegacyWindowAI(backend);

  // Now can use global.ai directly
  const session = await global.ai.languageModel.create();
  const response = await session.prompt('Hello, world!');
  console.log('Response via global.ai:', response);

  session.destroy();
}

// ============================================================================
// Example 6: Conversation
// ============================================================================

async function example6() {
  console.log('\n=== Example 6: Multi-turn Conversation ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || 'sk-test',
  });

  const languageModel = LegacyChromeAILanguageModel(backend);

  const session = await languageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful math tutor.',
      },
    ],
  });

  const questions = [
    'What is 5 + 3?',
    'What about 10 - 2?',
    'Are those two answers the same?',
  ];

  for (const question of questions) {
    console.log(`\nQ: ${question}`);
    const answer = await session.prompt(question);
    console.log(`A: ${answer}`);
    console.log(`   (tokens used: ${session.tokensSoFar})`);
  }

  session.destroy();
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  try {
    await example1();
    await example2();
    await example3();
    await example4();
    await example5();
    await example6();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
