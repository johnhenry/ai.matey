/**
 * Agentic Tool-Execution Loop
 *
 * `createRunTools(bridge)` builds the `bridge.runTools()` method: execute →
 * if the model requests tools, run their handlers → append results →
 * re-execute, until the model answers or `maxIterations` is exhausted.
 *
 * @module
 */

import type {
  IRChatRequest,
  IRChatResponse,
  IRMessage,
  IRTool,
  IRUsage,
  RunToolsOptions,
  RunToolsResult,
  RunToolsStep,
} from 'ai.matey.types';
import { AdapterError, ErrorCode } from 'ai.matey.errors';
import {
  extractToolCalls,
  createToolResultMessage,
  validateToolArgs,
  type ToolCallResult,
} from 'ai.matey.utils';

/**
 * The subset of Bridge that runTools needs (avoids a circular type import).
 */
export interface RunToolsBridge {
  executeIR(request: IRChatRequest, options?: { signal?: AbortSignal }): Promise<IRChatResponse>;
  readonly frontend: { readonly metadata: { readonly name: string } };
}

/**
 * Create the runTools function for a Bridge.
 */
export function createRunTools(
  bridge: RunToolsBridge
): (options: RunToolsOptions) => Promise<RunToolsResult> {
  return async function runTools(options: RunToolsOptions): Promise<RunToolsResult> {
    const {
      tools,
      maxIterations = 10,
      parallelToolCalls = true,
      validateArguments = true,
      signal,
    } = options;

    if (!options.prompt && (!options.messages || options.messages.length === 0)) {
      throw new AdapterError({
        code: ErrorCode.INVALID_REQUEST,
        message: 'runTools requires either `prompt` or non-empty `messages`',
        isRetryable: false,
        provenance: {},
      });
    }

    // Record-keyed tools → IR array
    const irTools: IRTool[] = Object.entries(tools).map(([name, definition]) => ({
      name,
      description: definition.description,
      parameters: definition.parameters,
      metadata: definition.metadata,
    }));

    let messages: IRMessage[] = options.messages
      ? [...options.messages]
      : [{ role: 'user', content: options.prompt as string }];

    const steps: RunToolsStep[] = [];
    let totalUsage: IRUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      const request: IRChatRequest = {
        messages,
        parameters: {
          ...options.parameters,
          ...(options.model && { model: options.model }),
        },
        tools: irTools,
        // Only constrain the first round; later rounds must be able to answer
        ...(iteration === 1 && options.toolChoice && { toolChoice: options.toolChoice }),
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          provenance: { frontend: bridge.frontend.metadata.name },
          custom: { runToolsIteration: iteration },
        },
      };

      const response = await bridge.executeIR(request, { signal });

      if (response.usage) {
        totalUsage = {
          promptTokens: totalUsage.promptTokens + response.usage.promptTokens,
          completionTokens: totalUsage.completionTokens + response.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + response.usage.totalTokens,
        };
      }

      const toolCalls = extractToolCalls(response);

      // Model answered without tools: done
      if (toolCalls.length === 0) {
        const step: RunToolsStep = { iteration, response, toolCalls: [], toolResults: [] };
        steps.push(step);
        await options.onStepFinish?.(step);

        return {
          text: extractText(response),
          response,
          messages: [...messages, response.message],
          steps,
          finishReason: response.finishReason,
          totalUsage,
        };
      }

      // Append the assistant's tool-call message before executing
      messages = [...messages, response.message];

      // Execute the requested tools
      const executeOne = async (call: (typeof toolCalls)[number]): Promise<ToolCallResult> => {
        const definition = tools[call.name];
        if (!definition) {
          return {
            toolCallId: call.id,
            result: `Unknown tool: ${call.name}`,
            isError: true,
          };
        }

        if (validateArguments) {
          const validation = validateToolArgs(
            {
              name: call.name,
              description: definition.description,
              parameters: definition.parameters,
            },
            call.input
          );
          if (!validation.valid) {
            // Feed validation failures back to the model so it can retry
            return {
              toolCallId: call.id,
              result: `Invalid arguments: ${validation.errors
                .map((error) => `${error.path}: ${error.message}`)
                .join('; ')}`,
              isError: true,
            };
          }
        }

        try {
          const result = await definition.execute(call.input, {
            toolCallId: call.id,
            messages,
            signal,
          });
          return { toolCallId: call.id, result };
        } catch (error) {
          return {
            toolCallId: call.id,
            result: error instanceof Error ? error.message : String(error),
            isError: true,
          };
        }
      };

      let toolResults: ToolCallResult[];
      if (parallelToolCalls) {
        toolResults = await Promise.all(toolCalls.map(executeOne));
      } else {
        toolResults = [];
        for (const call of toolCalls) {
          toolResults.push(await executeOne(call));
        }
      }

      messages = [...messages, createToolResultMessage(toolResults)];

      const step: RunToolsStep = {
        iteration,
        response,
        toolCalls: toolCalls.map((call) => ({
          id: call.id,
          name: call.name,
          input: call.input,
        })),
        toolResults,
      };
      steps.push(step);
      await options.onStepFinish?.(step);
    }

    throw new AdapterError({
      code: ErrorCode.MAX_TOOL_ITERATIONS_EXCEEDED,
      message: `runTools exceeded ${maxIterations} iterations without a final answer`,
      isRetryable: false,
      provenance: {},
      details: { maxIterations, steps: steps.length },
    });
  };
}

function extractText(response: IRChatResponse): string {
  const content = response.message.content;
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
