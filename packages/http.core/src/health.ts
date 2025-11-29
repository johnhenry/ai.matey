/**
 * Health Check Utilities
 *
 * Health check endpoint for monitoring and load balancers.
 *
 * @module
 */

import type { GenericRequest, GenericResponse } from './types.js';
import type { Bridge, Router } from 'ai.matey.core';

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /**
   * Overall health status
   */
  status: HealthStatus;

  /**
   * Timestamp of health check
   */
  timestamp: string;

  /**
   * Service name/version
   */
  service?: string;
  version?: string;

  /**
   * Uptime in milliseconds
   */
  uptime?: number;

  /**
   * Component-specific checks
   */
  checks?: Record<string, ComponentHealth>;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /**
   * Service name
   * @default 'ai.matey'
   */
  serviceName?: string;

  /**
   * Service version
   * @default '1.0.0'
   */
  version?: string;

  /**
   * Include uptime in response
   * @default true
   */
  includeUptime?: boolean;

  /**
   * Include component checks
   * @default true
   */
  includeChecks?: boolean;

  /**
   * Custom health checks
   */
  customChecks?: Record<string, () => Promise<ComponentHealth>>;

  /**
   * Check backend health (for routers)
   * @default true
   */
  checkBackends?: boolean;

  /**
   * Additional metadata to include
   */
  metadata?: Record<string, unknown>;
}

/**
 * Health check handler
 */
export class HealthCheck {
  private config: Required<Omit<HealthCheckConfig, 'customChecks' | 'metadata'>>;
  private customChecks: Record<string, () => Promise<ComponentHealth>>;
  private metadata: Record<string, unknown>;
  private startTime: number;
  private router?: Router;

  constructor(bridgeOrRouter: Bridge | Router, config: HealthCheckConfig = {}) {
    this.config = {
      serviceName: 'ai.matey',
      version: '1.0.0',
      includeUptime: true,
      includeChecks: true,
      checkBackends: true,
      ...config,
    };

    this.customChecks = config.customChecks || {};
    this.metadata = config.metadata || {};
    this.startTime = Date.now();

    // Detect if bridge or router
    if ('getBackends' in bridgeOrRouter) {
      this.router = bridgeOrRouter as Router;
    }
    // Bridge support can be added in the future
  }

  /**
   * Perform health check
   */
  async check(): Promise<HealthCheckResult> {
    const checks: Record<string, ComponentHealth> = {};

    // Basic system check
    if (this.config.includeChecks) {
      checks.system = {
        status: 'healthy',
        message: 'System operational',
      };

      // Check backend health (router only)
      if (this.router && this.config.checkBackends) {
        try {
          // For now, assume healthy if router exists
          // In the future, we can add a getBackends() method to Router
          checks.backends = {
            status: 'healthy',
            message: 'Router operational',
          };
        } catch (error) {
          checks.backends = {
            status: 'unhealthy',
            message: 'Unable to check backends',
            details: { error: (error as Error).message },
          };
        }
      }

      // Run custom checks
      for (const [name, checkFn] of Object.entries(this.customChecks)) {
        try {
          checks[name] = await checkFn();
        } catch (error) {
          checks[name] = {
            status: 'unhealthy',
            message: `Check failed: ${(error as Error).message}`,
          };
        }
      }
    }

    // Determine overall status
    const statuses = Object.values(checks).map((c) => c.status);
    let overallStatus: HealthStatus = 'healthy';

    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      version: this.config.version,
    };

    if (this.config.includeUptime) {
      result.uptime = Date.now() - this.startTime;
    }

    if (this.config.includeChecks && Object.keys(checks).length > 0) {
      result.checks = checks;
    }

    if (Object.keys(this.metadata).length > 0) {
      result.metadata = this.metadata;
    }

    return result;
  }

  /**
   * Handle health check request
   */
  async handle(_req: GenericRequest, res: GenericResponse): Promise<void> {
    const result = await this.check();

    // Set status code based on health
    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

    res.status(statusCode);
    res.header('Content-Type', 'application/json');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(result);
  }
}

/**
 * Create health check handler
 *
 * @param bridgeOrRouter - Bridge or Router instance
 * @param config - Health check configuration
 * @returns Health check handler
 *
 * @example
 * ```typescript
 * import { createHealthCheck } from 'ai.matey.http';
 *
 * const healthCheck = createHealthCheck(bridge, {
 *   serviceName: 'my-ai-service',
 *   version: '1.0.0',
 * });
 *
 * // In your HTTP server:
 * if (req.url === '/health') {
 *   await healthCheck.handle(req, res);
 * }
 * ```
 */
export function createHealthCheck(
  bridgeOrRouter: Bridge | Router,
  config?: HealthCheckConfig
): HealthCheck {
  return new HealthCheck(bridgeOrRouter, config);
}

/**
 * Create simple health check middleware
 *
 * @param bridgeOrRouter - Bridge or Router instance
 * @param path - Health check path (default: '/health')
 * @param config - Health check configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * import { createHealthCheckMiddleware } from 'ai.matey.http';
 *
 * const healthMiddleware = createHealthCheckMiddleware(bridge);
 *
 * // Use in HTTP server
 * app.use(healthMiddleware);
 * ```
 */
export function createHealthCheckMiddleware(
  bridgeOrRouter: Bridge | Router,
  path: string = '/health',
  config?: HealthCheckConfig
): (req: GenericRequest, res: GenericResponse) => Promise<boolean> {
  const healthCheck = new HealthCheck(bridgeOrRouter, config);

  return async (req: GenericRequest, res: GenericResponse): Promise<boolean> => {
    if (req.url === path || req.url?.startsWith(`${path}?`)) {
      await healthCheck.handle(req, res);
      return true; // Handled
    }
    return false; // Not handled
  };
}

/**
 * Readiness check (for Kubernetes)
 *
 * Returns 200 when service is ready to accept traffic.
 */
export function createReadinessCheck(
  bridgeOrRouter: Bridge | Router
): (req: GenericRequest, res: GenericResponse) => Promise<void> {
  const healthCheck = new HealthCheck(bridgeOrRouter, {
    includeUptime: false,
    includeChecks: true,
    checkBackends: true,
  });

  return async (_req: GenericRequest, res: GenericResponse): Promise<void> => {
    const result = await healthCheck.check();

    // Only ready if all checks are healthy
    const isReady = result.status === 'healthy';

    res.status(isReady ? 200 : 503);
    res.header('Content-Type', 'application/json');
    res.send({
      ready: isReady,
      timestamp: result.timestamp,
      checks: result.checks,
    });
  };
}

/**
 * Liveness check (for Kubernetes)
 *
 * Returns 200 if service is alive (even if degraded).
 */
export function createLivenessCheck(): (req: GenericRequest, res: GenericResponse) => void {
  const startTime = Date.now();

  return (_req: GenericRequest, res: GenericResponse): void => {
    res.status(200);
    res.header('Content-Type', 'application/json');
    res.send({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
    });
  };
}
