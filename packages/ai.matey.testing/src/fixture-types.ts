/**
 * Type definitions for test fixtures
 */

import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';

/**
 * Fixture metadata
 */
export interface FixtureMetadata {
  /** Provider name (e.g., "openai", "anthropic") */
  readonly provider: string;

  /** Scenario description (e.g., "basic-chat", "streaming-with-tools") */
  readonly scenario: string;

  /** API version used to capture this fixture */
  readonly apiVersion?: string;

  /** Model used in this fixture */
  readonly model: string;

  /** When this fixture was captured */
  readonly capturedAt: string; // ISO 8601

  /** Description of what this fixture tests */
  readonly description?: string;

  /** Tags for categorization */
  readonly tags?: readonly string[];
}

/**
 * Non-streaming fixture
 */
export interface ChatFixture {
  readonly metadata: FixtureMetadata;
  readonly request: IRChatRequest;
  readonly response: IRChatResponse;
  readonly providerRequest?: unknown; // Original provider-specific request
  readonly providerResponse?: unknown; // Original provider-specific response
}

/**
 * Streaming fixture
 */
export interface StreamingFixture {
  readonly metadata: FixtureMetadata;
  readonly request: IRChatRequest;
  readonly chunks: readonly IRStreamChunk[];
  readonly finalResponse?: IRChatResponse;
  readonly providerRequest?: unknown;
  readonly providerStreamEvents?: readonly unknown[];
}

/**
 * Combined fixture type
 */
export type Fixture = ChatFixture | StreamingFixture;

/**
 * Type guard for streaming fixtures
 */
export function isStreamingFixture(fixture: Fixture): fixture is StreamingFixture {
  return 'chunks' in fixture;
}

/**
 * Type guard for chat fixtures
 */
export function isChatFixture(fixture: Fixture): fixture is ChatFixture {
  return 'response' in fixture && !('chunks' in fixture);
}

/**
 * Fixture collection (multiple fixtures grouped together)
 */
export interface FixtureCollection {
  readonly provider: string;
  readonly fixtures: readonly Fixture[];
  readonly version: string; // Collection version
  readonly createdAt: string;
}

/**
 * Fixture search criteria
 */
export interface FixtureQuery {
  readonly provider?: string;
  readonly scenario?: string;
  readonly model?: string;
  readonly tags?: readonly string[];
  readonly streaming?: boolean;
}
