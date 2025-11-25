/**
 * Fixture capture tool - captures real API calls and saves them as fixtures
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';
import type {
  ChatFixture,
  StreamingFixture,
  FixtureMetadata,
} from './fixture-types.js';
import { FIXTURES_DIR } from './fixture-loader.js';

/**
 * Capture configuration
 */
export interface CaptureConfig {
  /** Provider name */
  readonly provider: string;

  /** Scenario name */
  readonly scenario: string;

  /** Description of this fixture */
  readonly description?: string;

  /** Tags for categorization */
  readonly tags?: readonly string[];

  /** API version */
  readonly apiVersion?: string;

  /** Whether to sanitize sensitive data */
  readonly sanitize?: boolean;

  /** Custom output directory */
  readonly outputDir?: string;
}

/**
 * Sanitize sensitive data from request/response
 */
function sanitizeData<T>(data: T, config: CaptureConfig): T {
  if (!config.sanitize) return data;

  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(data)) as T;

  // Remove API keys from metadata
  if (typeof sanitized === 'object' && sanitized !== null) {
    const obj = sanitized as Record<string, unknown>;
    if (obj.metadata && typeof obj.metadata === 'object') {
      const metadata = obj.metadata as Record<string, unknown>;
      if (metadata.custom && typeof metadata.custom === 'object') {
        const custom = metadata.custom as Record<string, unknown>;
        delete custom.apiKey;
        delete custom.api_key;
        delete custom.authorization;
      }
    }
  }

  return sanitized;
}

/**
 * Capture a non-streaming chat interaction
 */
export async function captureChat(
  config: CaptureConfig,
  request: IRChatRequest,
  response: IRChatResponse,
  providerData?: {
    providerRequest?: unknown;
    providerResponse?: unknown;
  }
): Promise<ChatFixture> {
  const metadata: FixtureMetadata = {
    provider: config.provider,
    scenario: config.scenario,
    model: request.parameters?.model || 'unknown',
    capturedAt: new Date().toISOString(),
    description: config.description,
    tags: config.tags,
    apiVersion: config.apiVersion,
  };

  const fixture: ChatFixture = {
    metadata,
    request: sanitizeData(request, config),
    response: sanitizeData(response, config),
    providerRequest: providerData?.providerRequest
      ? sanitizeData(providerData.providerRequest, config)
      : undefined,
    providerResponse: providerData?.providerResponse
      ? sanitizeData(providerData.providerResponse, config)
      : undefined,
  };

  // Save to file
  await saveFixture(config, fixture);

  return fixture;
}

/**
 * Capture a streaming chat interaction
 */
export async function captureStream(
  config: CaptureConfig,
  request: IRChatRequest,
  chunks: readonly IRStreamChunk[],
  finalResponse?: IRChatResponse,
  providerData?: {
    providerRequest?: unknown;
    providerStreamEvents?: readonly unknown[];
  }
): Promise<StreamingFixture> {
  const metadata: FixtureMetadata = {
    provider: config.provider,
    scenario: config.scenario,
    model: request.parameters?.model || 'unknown',
    capturedAt: new Date().toISOString(),
    description: config.description,
    tags: config.tags ? [...config.tags, 'streaming'] : ['streaming'],
    apiVersion: config.apiVersion,
  };

  const fixture: StreamingFixture = {
    metadata,
    request: sanitizeData(request, config),
    chunks: sanitizeData(chunks as IRStreamChunk[], config),
    finalResponse: finalResponse ? sanitizeData(finalResponse, config) : undefined,
    providerRequest: providerData?.providerRequest
      ? sanitizeData(providerData.providerRequest, config)
      : undefined,
    providerStreamEvents: providerData?.providerStreamEvents
      ? sanitizeData(providerData.providerStreamEvents as unknown[], config)
      : undefined,
  };

  // Save to file
  await saveFixture(config, fixture);

  return fixture;
}

/**
 * Save fixture to file
 */
async function saveFixture(
  config: CaptureConfig,
  fixture: ChatFixture | StreamingFixture
): Promise<void> {
  const outputDir = config.outputDir || FIXTURES_DIR;
  const providerDir = join(outputDir, config.provider);

  // Ensure provider directory exists
  await mkdir(providerDir, { recursive: true });

  // Write fixture file
  const fixturePath = join(providerDir, `${config.scenario}.json`);
  const content = JSON.stringify(fixture, null, 2);
  await writeFile(fixturePath, content, 'utf-8');

  console.log(`Fixture saved: ${fixturePath}`);
}

/**
 * Capture middleware - wraps a backend adapter to automatically capture fixtures
 */
export function createCaptureMiddleware(
  config: Omit<CaptureConfig, 'scenario'>
) {
  return {
    name: 'fixture-capture',

    async processRequest(request: IRChatRequest): Promise<IRChatRequest> {
      // Store request for later capture
      (request as { _captureRequest?: IRChatRequest })._captureRequest = request;
      return request;
    },

    async processResponse(
      response: IRChatResponse,
      request: IRChatRequest
    ): Promise<IRChatResponse> {
      // Auto-generate scenario name from request
      const scenario = generateScenarioName(request);

      await captureChat(
        {
          ...config,
          scenario,
          sanitize: config.sanitize ?? true,
        },
        request,
        response
      );

      return response;
    },
  };
}

/**
 * Generate a scenario name from request
 */
function generateScenarioName(request: IRChatRequest): string {
  const parts: string[] = [];

  // Add model
  if (request.parameters?.model) {
    parts.push(request.parameters.model.replace(/[^a-z0-9-]/gi, '-'));
  }

  // Add tools indicator
  if (request.tools && request.tools.length > 0) {
    parts.push('with-tools');
  }

  // Add vision indicator
  const hasImages = request.messages.some((msg) => {
    const content = msg.content;
    if (Array.isArray(content)) {
      return content.some((c) => c.type === 'image');
    }
    return false;
  });
  if (hasImages) {
    parts.push('with-vision');
  }

  return parts.join('-') || 'basic-chat';
}

/**
 * Bulk capture utility - capture multiple fixtures at once
 */
export async function bulkCapture(
  config: Omit<CaptureConfig, 'scenario'>,
  captures: Array<{
    scenario: string;
    request: IRChatRequest;
    response: IRChatResponse;
  }>
): Promise<void> {
  for (const capture of captures) {
    await captureChat(
      {
        ...config,
        scenario: capture.scenario,
      },
      capture.request,
      capture.response
    );
  }

  console.log(`Captured ${captures.length} fixtures for ${config.provider}`);
}
