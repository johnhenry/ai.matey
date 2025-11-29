/**
 * SDK Wrapper Example - Using Official SDK Packages
 *
 * Shows how to use wrapper packages that provide
 * compatibility with official provider SDKs:
 * - OpenAI SDK wrapper
 * - Anthropic SDK wrapper
 */

// SDK wrappers - drop-in replacements for official SDKs
import { createOpenAICompatibleClient } from 'ai.matey.wrapper/openai';
import { createAnthropicCompatibleClient } from 'ai.matey.wrapper/anthropic';

// Backend adapters
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';

async function main() {
  console.log('=== SDK Wrapper Examples ===\n');

  // Example 1: OpenAI SDK compatible client backed by Anthropic
  console.log('1. OpenAI SDK client -> Anthropic backend:');
  await openaiSdkToAnthropicExample();

  // Example 2: Anthropic SDK compatible client backed by OpenAI
  console.log('\n2. Anthropic SDK client -> OpenAI backend:');
  await anthropicSdkToOpenaiExample();

  // Example 3: OpenAI SDK compatible client backed by Gemini
  console.log('\n3. OpenAI SDK client -> Gemini backend:');
  await openaiSdkToGeminiExample();
}

async function openaiSdkToAnthropicExample() {
  // Create an OpenAI SDK-compatible client that uses Anthropic
  const client = createOpenAICompatibleClient({
    backend: new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    }),
  });

  try {
    // Use exact OpenAI SDK syntax
    const completion = await client.chat.completions.create({
      model: 'gpt-4', // Will be translated to Claude model
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello! What AI model are you?' },
      ],
      max_tokens: 100,
    });

    console.log('  Response:', completion.choices[0].message.content);
    console.log('  Model used:', completion.model);
  } catch (error) {
    console.log('  Error:', (error as Error).message);
  }
}

async function anthropicSdkToOpenaiExample() {
  // Create an Anthropic SDK-compatible client that uses OpenAI
  const client = createAnthropicCompatibleClient({
    backend: new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    }),
  });

  try {
    // Use exact Anthropic SDK syntax
    const message = await client.messages.create({
      model: 'claude-3-opus-20240229', // Will be translated to GPT model
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello! What AI model are you?' }],
    });

    console.log('  Response:', message.content[0].text);
    console.log('  Model used:', message.model);
  } catch (error) {
    console.log('  Error:', (error as Error).message);
  }
}

async function openaiSdkToGeminiExample() {
  // Create an OpenAI SDK-compatible client that uses Gemini
  const client = createOpenAICompatibleClient({
    backend: new GeminiBackendAdapter({
      apiKey: process.env.GOOGLE_API_KEY || 'AIza...',
    }),
  });

  try {
    // Use OpenAI SDK syntax, but actually call Gemini
    const completion = await client.chat.completions.create({
      model: 'gpt-4', // Will be translated to Gemini model
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    });

    console.log('  Response:', completion.choices[0].message.content);
    console.log('  Actual model:', completion.model);
  } catch (error) {
    console.log('  Error:', (error as Error).message);
  }
}

// Bonus: Using wrappers for easy provider migration
async function migrationExample() {
  console.log('\n=== Migration Example ===');
  console.log('Easily switch providers without changing application code:\n');

  // Original code using OpenAI SDK
  // const openai = new OpenAI({ apiKey: '...' });
  // const response = await openai.chat.completions.create({ ... });

  // Migration step 1: Replace import with wrapper
  // import { createOpenAICompatibleClient } from 'ai.matey.wrapper/openai';
  // const openai = createOpenAICompatibleClient({ backend: new OpenAIBackendAdapter({ apiKey: '...' }) });

  // Migration step 2: Switch backend (no other code changes needed!)
  // const openai = createOpenAICompatibleClient({ backend: new AnthropicBackendAdapter({ apiKey: '...' }) });

  console.log('  1. Replace SDK import with ai.matey wrapper');
  console.log('  2. Configure backend adapter');
  console.log('  3. Switch backends anytime without changing app code');
  console.log('  4. Add middleware, routing, caching as needed');
}

main().catch(console.error);
migrationExample().catch(console.error);
