/**
 * Chrome AI Language Model Wrapper Example
 *
 * This example shows how to use the ChromeAILanguageModel wrapper
 * to mimic the Chrome AI API with any backend adapter.
 */

import {
  ChromeAILanguageModel,
  createChromeAILanguageModel,
  AnthropicBackendAdapter,
  OpenAIBackendAdapter,
} from '../dist/esm/index.js';

// ============================================================================
// Example 1: Basic Usage with Anthropic
// ============================================================================

async function example1() {
  console.log('\n=== Example 1: Basic Usage with Anthropic ===\n');

  const backend = new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const LanguageModel = ChromeAILanguageModel(backend);

  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful assistant and you speak like a pirate.',
      },
    ],
  });

  console.log(await session.prompt('Tell me a joke.'));
  console.log('\n---\n');
  console.log(await session.prompt('Tell me another one!'));

  session.destroy();
}

// ============================================================================
// Example 2: Streaming with OpenAI
// ============================================================================

async function example2() {
  console.log('\n=== Example 2: Streaming with OpenAI ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const LanguageModel = ChromeAILanguageModel(backend);

  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful coding assistant.',
      },
    ],
    temperature: 0.7,
  });

  const stream = session.promptStreaming('Write a hello world function in Python.');

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(value); // Chrome AI streams full content
    }
  } finally {
    reader.releaseLock();
  }

  console.log('\n');
  session.destroy();
}

// ============================================================================
// Example 3: Conversation History
// ============================================================================

async function example3() {
  console.log('\n=== Example 3: Conversation History ===\n');

  const backend = new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const ai = createChromeAILanguageModel(backend);

  const session = await ai.languageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a math tutor.',
      },
    ],
  });

  console.log('Question 1:', await session.prompt('What is 2 + 2?'));
  console.log('\n---\n');
  console.log('Question 2:', await session.prompt('What about if I multiply that by 3?'));
  console.log('\n---\n');
  console.log('Question 3:', await session.prompt('And divide by 2?'));

  session.destroy();
}

// ============================================================================
// Example 4: Check Capabilities
// ============================================================================

async function example4() {
  console.log('\n=== Example 4: Check Capabilities ===\n');

  const backend = new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const LanguageModel = ChromeAILanguageModel(backend);

  const capabilities = await LanguageModel.capabilities();
  console.log('Language Model Available:', capabilities.available);
}

// ============================================================================
// Example 5: Clone Session
// ============================================================================

async function example5() {
  console.log('\n=== Example 5: Clone Session ===\n');

  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const LanguageModel = ChromeAILanguageModel(backend);

  const originalSession = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
    ],
  });

  // Have a conversation
  console.log('Original session:');
  console.log(await originalSession.prompt('My name is Alice.'));

  // Clone the session (preserves system prompts, not conversation history)
  const clonedSession = await originalSession.clone();
  console.log('\nCloned session:');
  console.log(await clonedSession.prompt('What is my name?'));
  // Should say it doesn't know, because conversation history isn't cloned

  originalSession.destroy();
  clonedSession.destroy();
}

// ============================================================================
// Example 6: Error Handling
// ============================================================================

async function example6() {
  console.log('\n=== Example 6: Error Handling ===\n');

  const backend = new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const LanguageModel = ChromeAILanguageModel(backend);

  const session = await LanguageModel.create();

  try {
    await session.prompt('Hello!');
    session.destroy();
    // This should throw an error
    await session.prompt('Hello again!');
  } catch (error) {
    console.log('Caught expected error:', error.message);
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  try {
    // Check environment variables
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error('Please set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable');
      process.exit(1);
    }

    // Run examples (comment out the ones you don't want to run)
    if (process.env.ANTHROPIC_API_KEY) {
      await example1(); // Basic usage
      await example3(); // Conversation history
      await example4(); // Capabilities
      await example6(); // Error handling
    }

    if (process.env.OPENAI_API_KEY) {
      await example2(); // Streaming
      await example5(); // Clone session
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
