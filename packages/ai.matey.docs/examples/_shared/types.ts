/**
 * Shared TypeScript types for examples
 *
 * Common type definitions used across multiple examples.
 */

import type { IRChatCompletionRequest, IRChatCompletionResponse } from 'ai.matey.types';

/**
 * Example metadata for documentation
 */
export interface ExampleMetadata {
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  relatedExamples?: string[];
}

/**
 * Backend configuration for examples
 */
export interface BackendConfig {
  name: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  enabled: boolean;
}

/**
 * Example execution result
 */
export interface ExampleResult {
  success: boolean;
  duration: number;
  error?: Error;
  response?: IRChatCompletionResponse;
}

/**
 * Test case for examples
 */
export interface TestCase {
  name: string;
  request: IRChatCompletionRequest;
  expectedOutputPattern?: RegExp;
  shouldFail?: boolean;
}
