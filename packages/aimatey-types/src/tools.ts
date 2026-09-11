/**
 * Tool Execution Types
 *
 * Types for the agentic tool-execution loop (`bridge.runTools()`) and
 * tool-calling helpers.
 *
 * @module
 */

import type {
  FinishReason,
  IRChatRequest,
  IRChatResponse,
  IRMessage,
  IRParameters,
  IRTool,
  IRUsage,
} from './ir.js';

/**
 * Context passed to a tool's execute function.
 */
export interface ToolExecutionContext {
  /** The provider-assigned id of this tool call. */
  readonly toolCallId: string;

  /** Conversation messages up to (and including) the assistant's tool call. */
  readonly messages: readonly IRMessage[];

  /** Abort signal from the runTools invocation. */
  readonly signal?: AbortSignal;
}

/**
 * A tool the model may call, with its executable implementation.
 *
 * Passed to `runTools` as a record keyed by tool name (which prevents
 * duplicate names); converted to the IR `tools` array internally.
 */
export interface ToolDefinition extends Omit<IRTool, 'name'> {
  /**
   * Execute the tool. The return value is JSON-stringified (unless already
   * a string) and fed back to the model as a tool result. Thrown errors
   * become `isError: true` tool results rather than aborting the loop.
   */
  readonly execute: (input: Record<string, unknown>, context: ToolExecutionContext) => unknown; // sync or Promise; the loop awaits either
}

/**
 * Options for `bridge.runTools()`.
 */
export interface RunToolsOptions {
  /** Conversation messages (alternative to `prompt`). */
  readonly messages?: readonly IRMessage[];

  /** Convenience: a single user prompt. */
  readonly prompt?: string;

  /** Tools keyed by name. */
  readonly tools: Readonly<Record<string, ToolDefinition>>;

  /** Model id. */
  readonly model?: string;

  /** Tool-choice constraint for the FIRST iteration. */
  readonly toolChoice?: IRChatRequest['toolChoice'];

  /** Maximum model round-trips before aborting. @default 10 */
  readonly maxIterations?: number;

  /** Run multiple tool calls from one response concurrently. @default true */
  readonly parallelToolCalls?: boolean;

  /**
   * Validate arguments against each tool's JSON schema before executing;
   * invalid arguments are fed back to the model as error tool results.
   * @default true
   */
  readonly validateArguments?: boolean;

  /** Called after each iteration completes. */
  readonly onStepFinish?: (step: RunToolsStep) => void | Promise<void>;

  /** Abort signal. */
  readonly signal?: AbortSignal;

  /** Additional request parameters (temperature, maxTokens, ...). */
  readonly parameters?: IRParameters;
}

/**
 * One iteration of the tool loop.
 */
export interface RunToolsStep {
  /** 1-based iteration number. */
  readonly iteration: number;

  /** The model response for this iteration. */
  readonly response: IRChatResponse;

  /** Tool calls the model requested (empty on the final iteration). */
  readonly toolCalls: readonly { id: string; name: string; input: Record<string, unknown> }[];

  /** Results fed back to the model. */
  readonly toolResults: readonly { toolCallId: string; result: unknown; isError?: boolean }[];
}

/**
 * Result of a completed tool loop.
 */
export interface RunToolsResult {
  /** Final assistant text. */
  readonly text: string;

  /** Final model response. */
  readonly response: IRChatResponse;

  /** Full conversation including tool calls and results. */
  readonly messages: readonly IRMessage[];

  /** Every iteration's step record. */
  readonly steps: readonly RunToolsStep[];

  /** Finish reason of the final response. */
  readonly finishReason: FinishReason;

  /** Summed usage across iterations (when providers report it). */
  readonly totalUsage: IRUsage;
}
