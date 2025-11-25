/**
 * Ollama CLI Types
 *
 * Shared types for Ollama CLI interface.
 *
 * @module cli/ollama/types
 */

export interface GlobalOptions {
  /**
   * Path to backend module.
   */
  backend: string;

  /**
   * Path to model mapping JSON file.
   */
  modelMap?: string;

  /**
   * Disable colored output.
   */
  noColor?: boolean;

  /**
   * Disable streaming output.
   */
  noStream?: boolean;

  /**
   * Output as JSON.
   */
  json?: boolean;

  /**
   * Verbose output.
   */
  verbose?: boolean;
}

export interface RunOptions extends GlobalOptions {
  /**
   * Model name.
   */
  model: string;

  /**
   * Single prompt (optional).
   */
  prompt?: string;

  /**
   * System message.
   */
  system?: string;
}

export interface ListOptions extends GlobalOptions {}

export interface PsOptions extends GlobalOptions {}

export interface ShowOptions extends GlobalOptions {
  /**
   * Model name.
   */
  model: string;
}
