/**
 * Type declarations for optional OpenTelemetry peer dependencies.
 *
 * These types are used when the packages are not installed to prevent
 * TypeScript compilation errors.
 */

declare module '@opentelemetry/api' {
  export const trace: any;
  export const context: any;
  export const propagation: any;
  export const SpanStatusCode: any;
}

declare module '@opentelemetry/sdk-trace-base' {
  export const BasicTracerProvider: any;
  export const BatchSpanProcessor: any;
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export const OTLPTraceExporter: any;
}

declare module '@opentelemetry/resources' {
  export const Resource: any;
}

declare module '@opentelemetry/semantic-conventions' {
  export const SEMRESATTRS_SERVICE_NAME: any;
  export const SEMRESATTRS_SERVICE_VERSION: any;
}
