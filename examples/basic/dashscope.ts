/**
 * DashScope (Alibaba Cloud Model Studio) Example
 *
 * DashScope's OpenAI-compatible mode fronts the Qwen model family. This uses
 * the international (Singapore) endpoint by default; override `baseURL` for
 * a mainland China deployment.
 *
 * Auth: a Model Studio API key.
 * https://www.alibabacloud.com/help/en/model-studio/get-api-key
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { DashScopeBackendAdapter } from 'ai.matey.backend/dashscope';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new DashScopeBackendAdapter({
      apiKey: process.env.DASHSCOPE_API_KEY || 'sk-...',
    })
  );

  const response = await bridge.chat({
    // The OpenAI frontend forwards `model` verbatim, so pass a real Qwen
    // model ID directly rather than relying on the adapter's defaultModel.
    model: 'qwen3.7-plus',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log('Response:', response);
}

main().catch(console.error);
