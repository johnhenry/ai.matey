/**
 * Production Patterns - Enterprise-Ready Setup
 *
 * Demonstrates:
 * - Production-grade configuration
 * - Monitoring and alerting
 * - Security best practices
 * - High availability patterns
 * - Disaster recovery
 *
 * Prerequisites:
 * - Multiple API keys for redundancy
 * - Understanding of production requirements
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/07-production.ts
 *
 * Expected Output:
 *   Production configuration patterns and best practices.
 */

import { Bridge, Router } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import {
  createLoggingMiddleware,
  createRetryMiddleware,
  createCachingMiddleware,
} from 'ai.matey.middleware';
import { loadAPIKeys } from '../_shared/env-loader.js';
import { displayExampleInfo } from '../_shared/helpers.js';

function main() {
  displayExampleInfo(
    'Production Patterns',
    'Enterprise-ready AI application setup',
    [
      'Multiple API keys for redundancy',
      'Monitoring infrastructure',
      'Security policies'
    ]
  );

  const keys = loadAPIKeys();

  console.log('\n═'.repeat(60));
  console.log('Pattern 1: High-Availability Configuration');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Production-grade router with multiple backends
const router = new Router(new OpenAIFrontendAdapter(), {
  backends: [
    // Primary: Anthropic (most reliable for your use case)
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30000,
      maxRetries: 3,
    }),

    // Secondary: OpenAI (fallback)
    new OpenAIBackendAdapter({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    }),

    // Tertiary: Local model (disaster recovery)
    new OllamaBackendAdapter({
      baseUrl: 'http://localhost:11434',
    }),
  ],
  strategy: 'priority',
  fallbackOnError: true,
  healthCheck: {
    enabled: true,
    interval: 60000, // Check every minute
    timeout: 5000,
  },
});
`);

  console.log('═'.repeat(60));
  console.log('Pattern 2: Comprehensive Middleware Stack');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Production middleware stack
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey })
);

// 1. Logging (outermost - sees everything)
bridge.use(
  createLoggingMiddleware({
    level: process.env.LOG_LEVEL || 'info',
    destination: 'file', // or winston/pino
    redactFields: ['apiKey', 'authorization'],
    includeTimestamps: true,
  })
);

// 2. Metrics collection
bridge.use(
  createMetricsMiddleware({
    provider: 'prometheus', // or datadog, newrelic
    endpoint: process.env.METRICS_ENDPOINT,
  })
);

// 3. Rate limiting
bridge.use(
  createRateLimitMiddleware({
    maxRequests: 100,
    windowMs: 60000, // per minute
    strategy: 'sliding-window',
  })
);

// 4. Retry with backoff
bridge.use(
  createRetryMiddleware({
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true, // Add randomness
  })
);

// 5. Caching
bridge.use(
  createCachingMiddleware({
    storage: 'redis', // or memcached
    ttl: 3600,
    maxSize: 10000,
    connectionString: process.env.REDIS_URL,
  })
);

// 6. Cost tracking
bridge.use(
  createCostTrackingMiddleware({
    budgetLimit: parseFloat(process.env.DAILY_BUDGET),
    alertThreshold: 0.9, // Alert at 90%
    onBudgetExceeded: async () => {
      await sendAlert('Budget exceeded!');
    },
  })
);

// 7. Circuit breaker
bridge.use(
  createCircuitBreakerMiddleware({
    threshold: 5, // Open after 5 failures
    timeout: 60000, // Try again after 1 minute
    resetTimeout: 30000,
  })
);
`);

  console.log('═'.repeat(60));
  console.log('Pattern 3: Security Configuration');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Security best practices
import { createSecurityMiddleware } from 'ai.matey.middleware';

bridge.use(
  createSecurityMiddleware({
    // Sanitize inputs
    sanitizeInputs: true,
    maxInputLength: 10000,

    // Content filtering
    contentFilters: ['profanity', 'pii', 'secrets'],

    // Rate limiting by user
    perUserRateLimit: {
      maxRequests: 50,
      windowMs: 3600000, // per hour
    },

    // API key rotation
    rotateKeys: {
      enabled: true,
      rotationInterval: 86400000, // daily
    },

    // Audit logging
    auditLog: {
      enabled: true,
      destination: 's3://audit-logs/',
    },
  })
);

// Environment variable validation
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'REDIS_URL',
  'METRICS_ENDPOINT',
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(\`Missing required env var: \${varName}\`);
  }
});
`);

  console.log('═'.repeat(60));
  console.log('Pattern 4: Monitoring & Alerting');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Monitoring configuration
import { setupMonitoring } from './monitoring';

setupMonitoring({
  // Error tracking
  errorTracking: {
    provider: 'sentry',
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  },

  // Performance monitoring
  apm: {
    provider: 'newrelic',
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
  },

  // Log aggregation
  logging: {
    provider: 'elasticsearch',
    endpoint: process.env.ELASTICSEARCH_URL,
    index: 'ai-matey-logs',
  },

  // Alerts
  alerts: [
    {
      condition: 'errorRate > 0.05', // 5% error rate
      channel: 'pagerduty',
      severity: 'critical',
    },
    {
      condition: 'latencyP95 > 5000', // 5s p95 latency
      channel: 'slack',
      severity: 'warning',
    },
    {
      condition: 'costPerHour > 100', // $100/hour
      channel: 'email',
      severity: 'warning',
    },
  ],
});
`);

  console.log('═'.repeat(60));
  console.log('Pattern 5: Graceful Shutdown');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('Shutting down gracefully...');

  // Stop accepting new requests
  server.close();

  // Wait for in-flight requests (max 30s)
  await Promise.race([
    waitForInFlightRequests(),
    sleep(30000),
  ]);

  // Flush logs and metrics
  await Promise.all([
    flushLogs(),
    flushMetrics(),
  ]);

  // Close connections
  await Promise.all([
    closeDatabase(),
    closeRedis(),
    closeMonitoring(),
  ]);

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`);

  console.log('\n💡 Production Checklist:\n');
  console.log('   ✓ Multiple backends for redundancy');
  console.log('   ✓ Comprehensive error handling');
  console.log('   ✓ Logging and monitoring');
  console.log('   ✓ Rate limiting and throttling');
  console.log('   ✓ Caching strategy');
  console.log('   ✓ Security hardening');
  console.log('   ✓ Cost tracking and budgets');
  console.log('   ✓ Alerting and on-call');
  console.log('   ✓ Disaster recovery plan');
  console.log('   ✓ Graceful shutdown\n');

  console.log('🎯 SLA Targets:\n');
  console.log('   • Availability: 99.9% (3 nines)');
  console.log('   • Latency p95: <5 seconds');
  console.log('   • Latency p99: <10 seconds');
  console.log('   • Error rate: <1%');
  console.log('   • MTTR: <15 minutes\n');

  console.log('📊 Key Metrics:\n');
  console.log('   • Requests per second');
  console.log('   • Error rate by type');
  console.log('   • Latency percentiles (p50, p95, p99)');
  console.log('   • Cache hit rate');
  console.log('   • Token usage & cost');
  console.log('   • Backend health scores\n');
}

main();
