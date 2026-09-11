/**
 * Model Runner Backend Types
 *
 * Type definitions for backends that run models locally via subprocess/binary execution.
 * Supports stdio and HTTP communication patterns.
 *
 * @module
 */

import type { BackendAdapterConfig } from './adapters.js';

// ============================================================================
// Communication Configuration
// ============================================================================

/**
 * Communication method with the model runner process.
 */
export type CommunicationType = 'stdio' | 'http';

/**
 * stdio communication configuration.
 */
export interface StdioCommunicationConfig {
  type: 'stdio';

  /**
   * Input format for requests.
   * @default 'json-lines'
   */
  inputFormat?: 'json-lines' | 'raw-text';

  /**
   * Output format for responses.
   * @default 'json-lines'
   */
  outputFormat?: 'json-lines' | 'raw-text';

  /**
   * Delimiter for line-based protocols.
   * @default '\n'
   */
  delimiter?: string;
}

/**
 * HTTP communication configuration.
 */
export interface HttpCommunicationConfig {
  type: 'http';

  /**
   * Base URL template (can include {port} placeholder).
   * @example 'http://localhost:{port}'
   */
  baseURL: string;

  /**
   * Health check endpoint.
   * @default '/health'
   */
  healthEndpoint?: string;

  /**
   * Chat completions endpoint.
   * @default '/v1/chat/completions'
   */
  chatEndpoint?: string;
}

/**
 * Communication configuration union type.
 */
export type CommunicationConfig = StdioCommunicationConfig | HttpCommunicationConfig;

// ============================================================================
// Process Configuration
// ============================================================================

/**
 * Process execution configuration.
 */
export interface ProcessConfig {
  /**
   * Command to execute (binary path or command name).
   * @example '/usr/local/bin/llama-cpp-server'
   * @example 'ollama'
   */
  command: string;

  /**
   * Command-line arguments.
   * Can include placeholders: {modelPath}, {port}, {contextSize}, etc.
   * @example ['--model', '{modelPath}', '--ctx-size', '{contextSize}']
   */
  args?: string[];

  /**
   * Environment variables for the process.
   * @example { CUDA_VISIBLE_DEVICES: '0' }
   */
  env?: Record<string, string>;

  /**
   * Working directory for the process.
   */
  cwd?: string;

  /**
   * Capture stdout from the process.
   * @default true
   */
  captureStdout?: boolean;

  /**
   * Capture stderr from the process.
   * @default true
   */
  captureStderr?: boolean;
}

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Model file reference.
 */
export interface ModelReference {
  /**
   * Path to the model file.
   * @example './models/llama-3.1-8b.gguf'
   */
  path: string;

  /**
   * Model format/type.
   * @example 'gguf', 'safetensors', 'pytorch'
   */
  format?: string;

  /**
   * Model name/identifier.
   */
  name?: string;
}

/**
 * Runtime configuration for model execution.
 */
export interface RuntimeConfig {
  /**
   * Context size (max tokens in context window).
   * @default 2048
   */
  contextSize?: number;

  /**
   * Number of GPU layers to offload.
   * -1 = all layers, 0 = CPU only
   * @default 0
   */
  gpuLayers?: number;

  /**
   * Number of threads to use.
   * @default (CPU cores)
   */
  threads?: number;

  /**
   * Batch size for prompt processing.
   * @default 512
   */
  batchSize?: number;

  /**
   * Keep model loaded in memory.
   * @default true
   */
  keepAlive?: boolean;

  /**
   * Memory map the model file.
   * @default true
   */
  mmap?: boolean;

  /**
   * Lock model in memory (prevent swapping).
   * @default false
   */
  mlock?: boolean;
}

// ============================================================================
// Lifecycle Configuration
// ============================================================================

/**
 * Lifecycle management configuration.
 */
export interface LifecycleConfig {
  /**
   * Automatically start the process on construction.
   * @default false
   */
  autoStart?: boolean;

  /**
   * Automatically stop the process on dispose.
   * @default true
   */
  autoStop?: boolean;

  /**
   * Timeout for process startup (milliseconds).
   * @default 60000 (60 seconds)
   */
  startupTimeout?: number;

  /**
   * Timeout for graceful shutdown (milliseconds).
   * @default 5000 (5 seconds)
   */
  shutdownTimeout?: number;

  /**
   * Restart the process if it crashes.
   * @default false
   */
  autoRestart?: boolean;

  /**
   * Maximum restart attempts.
   * @default 3
   */
  maxRestarts?: number;

  /**
   * Health check interval (milliseconds).
   * 0 = disabled
   * @default 0
   */
  healthCheckInterval?: number;
}

// ============================================================================
// Main Configuration
// ============================================================================

/**
 * Configuration for model runner backends.
 *
 * Extends BackendAdapterConfig with model runner-specific options.
 */
export interface ModelRunnerBackendConfig extends BackendAdapterConfig {
  /**
   * Model configuration.
   */
  model: string | ModelReference;

  /**
   * Process execution configuration.
   */
  process: ProcessConfig;

  /**
   * Communication configuration.
   */
  communication: CommunicationConfig;

  /**
   * Runtime configuration for model execution.
   */
  runtime?: RuntimeConfig;

  /**
   * Lifecycle management configuration.
   */
  lifecycle?: LifecycleConfig;

  /**
   * Port number for HTTP communication.
   * If not specified, an available port will be auto-discovered.
   */
  port?: number;

  /**
   * Prompt template name or custom template.
   * @example 'llama2', 'chatml', 'alpaca'
   */
  promptTemplate?: string | PromptTemplate;
}

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Prompt template for formatting messages.
 */
export interface PromptTemplate {
  /**
   * Template name/identifier.
   */
  name: string;

  /**
   * System message wrapper.
   * @example '<<SYS>>\n{content}\n<</SYS>>'
   */
  systemTemplate?: string;

  /**
   * User message wrapper.
   * @example '[INST] {content} [/INST]'
   */
  userTemplate?: string;

  /**
   * Assistant message wrapper.
   * @example '{content}'
   */
  assistantTemplate?: string;

  /**
   * Beginning of sequence token.
   */
  bosToken?: string;

  /**
   * End of sequence token.
   */
  eosToken?: string;

  /**
   * Add generation prompt at the end.
   */
  addGenerationPrompt?: boolean;
}

// ============================================================================
// Process Events
// ============================================================================

/**
 * Events emitted by model runner backends.
 */
export interface ModelRunnerEvents {
  /**
   * Process is starting.
   */
  starting: void;

  /**
   * Process is ready to accept requests.
   */
  ready: void;

  /**
   * Process has stopped.
   */
  stopped: void;

  /**
   * Process encountered an error.
   */
  error: Error;

  /**
   * Process is restarting.
   */
  restarting: { attempt: number; maxAttempts: number };

  /**
   * stdout output from process.
   */
  stdout: string;

  /**
   * stderr output from process.
   */
  stderr: string;
}

// ============================================================================
// Process Stats
// ============================================================================

/**
 * Statistics about the running process.
 */
export interface ModelRunnerStats {
  /**
   * Is the process currently running?
   */
  isRunning: boolean;

  /**
   * Process ID (if running).
   */
  pid?: number;

  /**
   * Uptime in milliseconds.
   */
  uptime?: number;

  /**
   * Number of requests processed.
   */
  requestCount: number;

  /**
   * Number of restart attempts.
   */
  restartCount: number;

  /**
   * Memory usage (if available).
   */
  memory?: {
    rss: number; // Resident Set Size
    heapTotal: number;
    heapUsed: number;
    external: number;
  };

  /**
   * CPU usage percentage (if available).
   */
  cpu?: number;
}
