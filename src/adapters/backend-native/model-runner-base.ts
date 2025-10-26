/**
 * Generic Model Runner Backend
 *
 * Base class for backends that run models via subprocess/binary execution.
 * Handles process lifecycle, stdio communication, and common functionality.
 *
 * @module
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { BackendAdapter, AdapterMetadata } from '../../types/adapters.js';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
} from '../../types/ir.js';
import type {
  ModelRunnerBackendConfig,
  ModelRunnerStats,
  PromptTemplate,
} from '../../types/model-runner.js';
import {
  ErrorCode,
  ProviderError,
} from '../../errors/index.js';

// ============================================================================
// Base Class
// ============================================================================

/**
 * Abstract base class for model runner backends.
 *
 * Handles:
 * - Process spawning and lifecycle
 * - stdio communication
 * - Health checking
 * - Event emission
 * - Stats tracking
 *
 * Subclasses must implement:
 * - buildCommandArgs() - Convert config to CLI args
 * - formatPrompt() - Convert IR request to prompt string
 * - parseResponse() - Parse model output to IR response
 * - parseStreamChunk() - Parse streaming output to IR chunks
 */
export abstract class GenericModelRunnerBackend
  extends EventEmitter
  implements BackendAdapter
{
  abstract readonly metadata: AdapterMetadata;

  protected readonly config: ModelRunnerBackendConfig;
  protected process?: ChildProcess;
  protected isRunning = false;
  protected startTime?: number;
  protected requestCount = 0;
  protected restartCount = 0;
  protected port?: number;
  protected stdinWriter?: NodeJS.WritableStream;
  protected stdoutBuffer = '';
  protected healthCheckTimer?: NodeJS.Timeout;

  constructor(config: ModelRunnerBackendConfig) {
    super();
    this.config = this.normalizeConfig(config);

    if (this.config.lifecycle?.autoStart) {
      this.start().catch((error) => {
        this.emit('error', error);
      });
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the model runner process.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.emit('starting' as any);

    try {
      // Discover port if needed (for HTTP communication)
      if (this.config.communication.type === 'http' && !this.port) {
        this.port = this.config.port || (await this.findAvailablePort());
      }

      // Spawn the process
      await this.spawnProcess();

      // Wait for ready
      await this.waitForReady();

      this.isRunning = true;
      this.startTime = Date.now();
      this.emit('ready' as any);

      // Start health check if configured
      if (this.config.lifecycle?.healthCheckInterval) {
        this.startHealthCheck();
      }
    } catch (error) {
      this.emit('error' as any, error as Error);
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Failed to start model runner: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        provenance: {
          backend: this.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Stop the model runner process.
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      return;
    }

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    try {
      // Send graceful shutdown signal
      this.process.kill('SIGTERM');

      // Wait for process to exit or timeout
      const timeout = this.config.lifecycle?.shutdownTimeout || 5000;
      await this.waitForExit(timeout);
    } catch (error) {
      // Force kill if graceful shutdown fails
      this.process.kill('SIGKILL');
    } finally {
      this.cleanup();
      this.emit('stopped' as any);
    }
  }

  /**
   * Restart the model runner process.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Get runtime statistics.
   */
  getStats(): ModelRunnerStats {
    return {
      isRunning: this.isRunning,
      pid: this.process?.pid,
      uptime: this.startTime ? Date.now() - this.startTime : undefined,
      requestCount: this.requestCount,
      restartCount: this.restartCount,
      memory: this.process ? (process.memoryUsage() as any) : undefined,
    };
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isRunning || !this.process) {
      return false;
    }

    try {
      if (this.config.communication.type === 'http') {
        return await this.httpHealthCheck();
      } else {
        return await this.stdioHealthCheck();
      }
    } catch {
      return false;
    }
  }

  /**
   * Dispose and cleanup resources.
   */
  dispose(): void {
    if (this.config.lifecycle?.autoStop) {
      this.stop().catch(console.error);
    }
  }

  // ==========================================================================
  // BackendAdapter Implementation
  // ==========================================================================

  /**
   * Convert IR request to provider format (passthrough - uses IR internally).
   */
  fromIR(request: IRChatRequest): IRChatRequest {
    return request;
  }

  /**
   * Convert provider response to IR format (passthrough - uses IR internally).
   */
  toIR(response: IRChatResponse, _originalRequest: IRChatRequest, _latencyMs: number): IRChatResponse {
    return response;
  }

  /**
   * Execute non-streaming chat completion request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    if (!this.isRunning) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: 'Model runner is not running. Call start() first.',
        isRetryable: false,
        provenance: { backend: this.metadata.name },
      });
    }

    this.requestCount++;

    try {
      if (this.config.communication.type === 'http') {
        return await this.executeHttp(request, signal);
      } else {
        return await this.executeStdio(request, signal);
      }
    } catch (error) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Model execution failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute streaming chat completion request.
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    if (!this.isRunning) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: 'Model runner is not running. Call start() first.',
        isRetryable: false,
        provenance: { backend: this.metadata.name },
      });
    }

    this.requestCount++;

    try {
      if (this.config.communication.type === 'http') {
        yield* this.executeStreamHttp(request, signal);
      } else {
        yield* this.executeStreamStdio(request, signal);
      }
    } catch (error) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      } as IRStreamChunk;
    }
  }

  // ==========================================================================
  // Abstract Methods (Subclasses must implement)
  // ==========================================================================

  /**
   * Build command-line arguments for the binary.
   *
   * Subclasses should convert the config into appropriate CLI args.
   */
  protected abstract buildCommandArgs(): string[];

  /**
   * Format IR request into prompt string for the model.
   */
  protected abstract formatPrompt(request: IRChatRequest): string;

  /**
   * Parse model output into IR response.
   */
  protected abstract parseResponse(output: string, request: IRChatRequest): IRChatResponse;

  /**
   * Parse streaming model output into IR stream chunks.
   */
  protected abstract parseStreamChunk(chunk: string, request: IRChatRequest): IRStreamChunk | null;

  /**
   * Get the prompt template for this model.
   */
  protected abstract getPromptTemplate(): PromptTemplate;

  // ==========================================================================
  // Process Management
  // ==========================================================================

  /**
   * Spawn the model runner process.
   */
  private async spawnProcess(): Promise<void> {
    const args = this.buildCommandArgs();
    const substitutedArgs = this.substitutePlaceholders(args);

    this.process = spawn(this.config.process.command, substitutedArgs, {
      cwd: this.config.process.cwd,
      env: { ...process.env, ...this.config.process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Setup stdio handlers
    if (this.process.stdin) {
      this.stdinWriter = this.process.stdin;
    }

    if (this.process.stdout) {
      this.process.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        this.emit('stdout' as any, output);
        if (this.config.process.captureStdout !== false) {
          this.stdoutBuffer += output;
        }
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        this.emit('stderr' as any, output);
      });
    }

    // Handle process exit
    this.process.on('exit', (_code) => {
      if (this.isRunning && this.config.lifecycle?.autoRestart) {
        this.handleCrash();
      }
    });
  }

  /**
   * Substitute placeholders in arguments.
   */
  private substitutePlaceholders(args: string[]): string[] {
    const modelPath = typeof this.config.model === 'string'
      ? this.config.model
      : this.config.model.path;

    const replacements: Record<string, string> = {
      '{modelPath}': modelPath,
      '{model}': modelPath,
      '{port}': String(this.port || 8080),
      '{contextSize}': String(this.config.runtime?.contextSize || 2048),
      '{threads}': String(this.config.runtime?.threads || 4),
      '{gpuLayers}': String(this.config.runtime?.gpuLayers || 0),
      '{batchSize}': String(this.config.runtime?.batchSize || 512),
    };

    return args.map((arg) => {
      let result = arg;
      for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(placeholder, value);
      }
      return result;
    });
  }

  /**
   * Wait for process to be ready.
   */
  private async waitForReady(): Promise<void> {
    const timeout = this.config.lifecycle?.startupTimeout || 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.healthCheck()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error('Process startup timeout');
  }

  /**
   * Wait for process to exit.
   */
  private async waitForExit(timeout: number): Promise<void> {
    if (!this.process) return;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, timeout);

      this.process!.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Handle process crash and restart if configured.
   */
  private async handleCrash(): Promise<void> {
    const maxRestarts = this.config.lifecycle?.maxRestarts || 3;

    if (this.restartCount < maxRestarts) {
      this.restartCount++;
      this.emit('restarting' as any, {
        attempt: this.restartCount,
        maxAttempts: maxRestarts,
      });

      try {
        await this.restart();
      } catch (error) {
        this.emit('error' as any, error as Error);
      }
    }
  }

  /**
   * Cleanup resources.
   */
  private cleanup(): void {
    this.isRunning = false;
    this.process = undefined;
    this.stdinWriter = undefined;
    this.stdoutBuffer = '';
  }

  /**
   * Normalize configuration with defaults.
   */
  private normalizeConfig(config: ModelRunnerBackendConfig): ModelRunnerBackendConfig {
    return {
      ...config,
      lifecycle: {
        autoStart: false,
        autoStop: true,
        startupTimeout: 60000,
        shutdownTimeout: 5000,
        autoRestart: false,
        maxRestarts: 3,
        healthCheckInterval: 0,
        ...config.lifecycle,
      },
      runtime: {
        contextSize: 2048,
        gpuLayers: 0,
        threads: 4,
        batchSize: 512,
        keepAlive: true,
        mmap: true,
        mlock: false,
        ...config.runtime,
      },
    };
  }

  /**
   * Find an available port.
   */
  private async findAvailablePort(start: number = 8000): Promise<number> {
    // Simple implementation - in production, use a proper port finder
    return start + Math.floor(Math.random() * 1000);
  }

  /**
   * Start periodic health checks.
   */
  private startHealthCheck(): void {
    const interval = this.config.lifecycle?.healthCheckInterval || 0;
    if (interval > 0) {
      this.healthCheckTimer = setInterval(async () => {
        const isHealthy = await this.healthCheck();
        if (!isHealthy && this.isRunning) {
          this.emit('error' as any, new Error('Health check failed'));
        }
      }, interval);
    }
  }

  // ==========================================================================
  // Communication Methods (Stubs - To be implemented)
  // ==========================================================================

  // @ts-expect-error - Stub method parameters are intentionally unused
  protected async executeStdio(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    throw new Error('stdio communication not yet implemented - subclass must override');
  }

  // @ts-expect-error - Stub method parameters are intentionally unused
  protected async *executeStreamStdio(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    throw new Error('stdio streaming not yet implemented - subclass must override');
  }

  // @ts-expect-error - Stub method parameters are intentionally unused
  protected async executeHttp(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    throw new Error('HTTP communication not yet implemented - subclass must override');
  }

  // @ts-expect-error - Stub method parameters are intentionally unused
  protected async *executeStreamHttp(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    throw new Error('HTTP streaming not yet implemented - subclass must override');
  }

  protected async httpHealthCheck(): Promise<boolean> {
    // Stub - subclass can override
    return true;
  }

  protected async stdioHealthCheck(): Promise<boolean> {
    // Stub - subclass can override
    return true;
  }
}
