/**
 * `ai.response.model` on OpenTelemetry spans (#112).
 *
 * The attribute was previously read from `response.metadata.provenance.backendModel`, a field
 * that does not exist on `IRProvenance`, so the condition was always falsy and the attribute
 * was never set on any span, for any provider.
 *
 * These tests assert the attribute on a real span produced by a real `BasicTracerProvider`,
 * captured through an `InMemorySpanExporter`, rather than on a hand-rolled span double -- a
 * mock would have happily "passed" against the broken code too.
 *
 * The semantic contract under test comes from the OpenTelemetry GenAI semantic conventions:
 * `request.model` is the model a request is made to (`gpt-4`), `response.model` is the model
 * that generated the response (`gpt-4-0613`). The two exist in order to differ.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  createOpenTelemetryMiddleware,
  OpenTelemetryAttributes,
  shutdownOpenTelemetry,
} from '@johnhenry/aimatey-middleware';
import type { IRChatResponse, Middleware, MiddlewareContext } from '@johnhenry/aimatey-types';

const REQUESTED_MODEL = 'gpt-4';
const SERVED_MODEL = 'gpt-4-0613';

/** A request that asks for REQUESTED_MODEL. */
function makeContext(): MiddlewareContext {
  return {
    request: {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello!' }] }],
      parameters: { model: REQUESTED_MODEL },
      metadata: {
        requestId: 'req-112',
        timestamp: Date.now(),
        provenance: { frontend: 'openai' },
      },
    },
  } as unknown as MiddlewareContext;
}

/** A response carrying whatever the provider actually returned in `raw`. */
function makeResponse(raw?: Record<string, unknown>): IRChatResponse {
  return {
    message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
    finishReason: 'stop',
    usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    metadata: {
      requestId: 'req-112',
      timestamp: Date.now(),
      provenance: { frontend: 'openai', backend: 'openai' },
    },
    ...(raw ? { raw } : {}),
  } as IRChatResponse;
}

describe('OpenTelemetry middleware: ai.response.model (#112)', () => {
  let middleware: Middleware;
  let exporter: InMemorySpanExporter;

  beforeAll(async () => {
    // `exportSpans: false` keeps the OTLP exporter (and its network calls) out of the test;
    // the provider is still a real BasicTracerProvider registered globally.
    middleware = await createOpenTelemetryMiddleware({ exportSpans: false, samplingRate: 1.0 });

    // The provider is created once and memoised behind a module-level singleton, so attach the
    // in-memory processor once and reset it per test rather than re-registering a global.
    const proxy = trace.getTracerProvider() as unknown as { getDelegate?: () => unknown };
    const delegate = (
      typeof proxy.getDelegate === 'function' ? proxy.getDelegate() : proxy
    ) as { addSpanProcessor: (p: SimpleSpanProcessor) => void };

    exporter = new InMemorySpanExporter();
    delegate.addSpanProcessor(new SimpleSpanProcessor(exporter));
  });

  beforeEach(() => {
    exporter.reset();
  });

  afterAll(async () => {
    await shutdownOpenTelemetry();
  });

  /** Run one request through the middleware and return the finished span's attributes. */
  async function attributesFor(response: IRChatResponse) {
    await middleware(makeContext(), async () => response);
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    return spans[0]!.attributes;
  }

  it('sets ai.response.model from the model the provider actually served', async () => {
    const attributes = await attributesFor(makeResponse({ model: SERVED_MODEL }));

    expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe(SERVED_MODEL);
  });

  it('reports the served model, not the requested one, when they differ', async () => {
    // The case the attribute exists for: an alias resolved to a dated snapshot, or a
    // `model-substituted` routing decision. Filling this attribute from the request would
    // make it silently wrong here.
    const attributes = await attributesFor(makeResponse({ model: SERVED_MODEL }));

    expect(attributes[OpenTelemetryAttributes.REQUEST_MODEL]).toBe(REQUESTED_MODEL);
    expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe(SERVED_MODEL);
    expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).not.toBe(
      attributes[OpenTelemetryAttributes.REQUEST_MODEL]
    );
  });

  it('leaves ai.response.model unset when the served model is unknown', async () => {
    // Absent, not defaulted: a consumer must be able to tell "not reported" from "reported
    // as X". This is the assertion that forbids a fallback to the requested model.
    const attributes = await attributesFor(makeResponse());

    expect(attributes).not.toHaveProperty(OpenTelemetryAttributes.RESPONSE_MODEL);
    expect(attributes[OpenTelemetryAttributes.REQUEST_MODEL]).toBe(REQUESTED_MODEL);
  });

  it('ignores a raw payload whose model is absent, empty, or not a string', async () => {
    for (const raw of [{ id: 'chatcmpl-1' }, { model: '' }, { model: 123 }, { model: null }]) {
      exporter.reset();
      const attributes = await attributesFor(makeResponse(raw));
      expect(attributes).not.toHaveProperty(OpenTelemetryAttributes.RESPONSE_MODEL);
    }
  });

  it('still records the other response attributes alongside it', async () => {
    // Guards the narrowing of `response` to IRChatResponse: these reads went through an
    // `any` before, so a regression in any of them would previously have been invisible.
    const attributes = await attributesFor(makeResponse({ model: SERVED_MODEL }));

    expect(attributes[OpenTelemetryAttributes.RESPONSE_BACKEND]).toBe('openai');
    expect(attributes[OpenTelemetryAttributes.RESPONSE_FINISH_REASON]).toBe('stop');
    expect(attributes[OpenTelemetryAttributes.TOKENS_PROMPT]).toBe(5);
    expect(attributes[OpenTelemetryAttributes.TOKENS_COMPLETION]).toBe(3);
    expect(attributes[OpenTelemetryAttributes.TOKENS_TOTAL]).toBe(8);
  });
});
