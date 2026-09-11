/**
 * Example Helper Utilities
 *
 * Common helper functions used across all examples for consistent
 * formatting, error handling, and output display.
 */

import type { IRChatCompletionChunk, IRChatCompletionResponse } from '@johnhenry/aimatey-types';

/**
 * Extract text content from a completion response
 */
export function extractText(response: IRChatCompletionResponse): string {
  if (!response.choices || response.choices.length === 0) {
    return '';
  }

  const message = response.choices[0].message;
  return message.content || '';
}

/**
 * Format and display a completion response
 */
export function displayResponse(response: IRChatCompletionResponse, label = 'Response'): void {
  console.log(`\n📝 ${label}:`);
  console.log('─'.repeat(60));
  console.log(extractText(response));
  console.log('─'.repeat(60));

  if (response.usage) {
    console.log(`\n📊 Usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total tokens`);
  }
  console.log();
}

/**
 * Display a section header
 */
export function displaySection(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

/**
 * Display a subsection header
 */
export function displaySubsection(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}\n`);
}

/**
 * Display an error with formatting
 */
export function displayError(error: unknown, context?: string): void {
  console.error(`\n❌ Error${context ? ` in ${context}` : ''}:`);
  console.error('─'.repeat(60));

  if (error instanceof Error) {
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack:\n${error.stack}`);
    }
  } else {
    console.error(error);
  }

  console.error('─'.repeat(60) + '\n');
}

/**
 * Display streaming chunks with formatting
 */
export async function displayStream(
  stream: AsyncIterable<IRChatCompletionChunk>,
  label = 'Streaming Response'
): Promise<string> {
  console.log(`\n📝 ${label}:`);
  console.log('─'.repeat(60));

  let fullText = '';

  try {
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        const text = chunk.choices[0].delta.content;
        process.stdout.write(text);
        fullText += text;
      }
    }
  } catch (error) {
    displayError(error, 'streaming');
    throw error;
  }

  console.log('\n' + '─'.repeat(60) + '\n');
  return fullText;
}

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  if (label) {
    console.log(`⏱️  ${label}: ${duration}ms`);
  }

  return { result, duration };
}

/**
 * Wait for a specified duration (for demo purposes)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Display example info header
 */
export function displayExampleInfo(title: string, description: string, prerequisites?: string[]): void {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
  console.log(`\n${description}\n`);

  if (prerequisites && prerequisites.length > 0) {
    console.log('📋 Prerequisites:');
    prerequisites.forEach(prereq => console.log(`   • ${prereq}`));
    console.log();
  }
}

/**
 * Simple progress indicator
 */
export function displayProgress(current: number, total: number, label?: string): void {
  const percentage = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
  process.stdout.write(`\r${label ? `${label}: ` : ''}[${bar}] ${percentage}%`);

  if (current === total) {
    console.log(); // New line when complete
  }
}
