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
 *
 * #113 replaced the mechanism underneath: the attribute is now read from the typed
 * `IRProvenance.servedModel` field, which backend adapters fill from the provider payload,
 * with `raw.model` demoted to a fallback for provenance that predates the field. The #112
 * assertions below are kept verbatim -- they still pass through the fallback branch, which is
 * exactly the out-of-tree-adapter compatibility #113 must not break -- and the #113 block
 * adds the typed-field, precedence, multi-hop and Gemini cases.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  createOpenTelemetryMiddleware,
  OpenTelemetryAttributes,
  shutdownOpenTelemetry,
} from '@johnhenry/aimatey-middleware';
import type {
  IRChatResponse,
  IRProvenance,
  Middleware,
  MiddlewareContext,
} from '@johnhenry/aimatey-types';

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
function makeResponse(raw?: Record<string, unknown>, provenance?: IRProvenance): IRChatResponse {
  return {
    message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
    finishReason: 'stop',
    usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    metadata: {
      requestId: 'req-112',
      timestamp: Date.now(),
      provenance: provenance ?? { frontend: 'openai', backend: 'openai' },
    },
    ...(raw ? { raw } : {}),
  } as IRChatResponse;
}

describe('OpenTelemetry middleware: ai.response.model (#112, #113)', () => {
  let middleware: Middleware;
  let exporter: InMemorySpanExporter;

  beforeAll(async () => {
    // `exportSpans: false` keeps the OTLP exporter (and its network calls) out of the test;
    // the provider is still a real BasicTracerProvider registered globally.
    middleware = await createOpenTelemetryMiddleware({ exportSpans: false, samplingRate: 1.0 });

    // The provider is created once and memoised behind a module-level singleton, so attach the
    // in-memory processor once and reset it per test rather than re-registering a global.
    const proxy = trace.getTracerProvider() as unknown as { getDelegate?: () => unknown };
    const delegate = (typeof proxy.getDelegate === 'function' ? proxy.getDelegate() : proxy) as {
      addSpanProcessor: (p: SimpleSpanProcessor) => void;
    };

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
  // ==========================================================================
  // #113 - the typed field replaces the raw read
  // ==========================================================================

  describe('from the typed IRProvenance.servedModel field (#113)', () => {
    it('sets the attribute with no `raw` on the response at all', async () => {
      // The point of the issue: tracing no longer needs the provider payload, so it no
      // longer needs to know which key each provider happens to use.
      const attributes = await attributesFor(
        makeResponse(undefined, {
          frontend: 'openai',
          backend: 'openai',
          servedModel: SERVED_MODEL,
        })
      );

      expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe(SERVED_MODEL);
    });

    it('prefers the typed field over raw.model when the two disagree', async () => {
      // Precedence is load-bearing: a proxying adapter's `raw` is the near hop's payload,
      // while provenance carries the hop that actually served.
      const attributes = await attributesFor(
        makeResponse({ model: 'stale-from-raw' }, { backend: 'openai', servedModel: SERVED_MODEL })
      );

      expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe(SERVED_MODEL);
      expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).not.toBe('stale-from-raw');
    });

    it('resolves the far hop of a proxied chain, not the tunnel', async () => {
      // `phone -> desktop -> llama-cpp`. The near hop served nothing, so its `servedModel`
      // is unset and the walk continues. A flat field could not have said this.
      const attributes = await attributesFor(
        makeResponse(undefined, {
          backend: 'tunnel',
          upstream: { backend: 'llama-cpp', servedModel: 'qwen2.5-7b-instruct' },
        })
      );

      expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe('qwen2.5-7b-instruct');
      expect(attributes[OpenTelemetryAttributes.RESPONSE_BACKEND]).toBe('tunnel');
    });

    it('covers Gemini, which the raw.model read structurally could not', async () => {
      // Gemini's payload has `modelVersion` and no `model`, so the #112 mechanism left the
      // attribute unset for every Gemini response. The adapter now maps it, and the
      // middleware stays ignorant of the difference -- it must NOT learn `raw.modelVersion`.
      const geminiRaw = { modelVersion: 'gemini-3.6-flash-001', candidates: [] };

      const withField = await attributesFor(
        makeResponse(geminiRaw, { backend: 'gemini-backend', servedModel: 'gemini-3.6-flash-001' })
      );
      expect(withField[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe('gemini-3.6-flash-001');

      exporter.reset();
      const withoutField = await attributesFor(
        makeResponse(geminiRaw, { backend: 'gemini-backend' })
      );
      expect(withoutField).not.toHaveProperty(OpenTelemetryAttributes.RESPONSE_MODEL);
    });

    it('keeps raw.model working for provenance that predates the field', async () => {
      // An out-of-tree BackendAdapter still compiles while setting only `raw` (the field is
      // optional), and a cache or fixture written before this change carries no field either.
      // Dropping the fallback would take those from "attribute set" to "attribute unset".
      const attributes = await attributesFor(
        makeResponse({ model: SERVED_MODEL }, { frontend: 'openai', backend: 'third-party' })
      );

      expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe(SERVED_MODEL);
    });

    it('still refuses to fall back to the requested model', async () => {
      // #113 must not weaken #112's central rule. Neither source reports anything here, so
      // the attribute stays absent rather than echoing `parameters.model`.
      const attributes = await attributesFor(
        makeResponse(undefined, { backend: 'cohere-backend' })
      );

      expect(attributes).not.toHaveProperty(OpenTelemetryAttributes.RESPONSE_MODEL);
      expect(attributes[OpenTelemetryAttributes.REQUEST_MODEL]).toBe(REQUESTED_MODEL);
    });

    it('treats an empty served model as not reported, and does not fall through to raw', async () => {
      const attributes = await attributesFor(
        makeResponse({ model: 'from-raw' }, { backend: 'openai', servedModel: '' })
      );

      // Empty is not a value, so the fallback is allowed to answer here.
      expect(attributes[OpenTelemetryAttributes.RESPONSE_MODEL]).toBe('from-raw');
    });
  });
});
