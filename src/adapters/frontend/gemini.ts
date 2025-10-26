/** Gemini Frontend Adapter */
import type { FrontendAdapter, AdapterMetadata } from '../../types/adapters.js';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRMessage } from '../../types/ir.js';
import type { StreamConversionOptions } from '../../types/streaming.js';
import type { GeminiRequest, GeminiResponse } from '../backend/gemini.js';

export class GeminiFrontendAdapter implements FrontendAdapter<GeminiRequest, GeminiResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'gemini-frontend',
    version: '1.0.0',
    provider: 'Google Gemini',
    capabilities: { streaming: true, multiModal: true, tools: true, systemMessageStrategy: 'separate-parameter', supportsMultipleSystemMessages: false },
  };

  async toIR(request: GeminiRequest): Promise<IRChatRequest> {
    const messages: IRMessage[] = request.contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => ('text' in p ? p.text : '')).join('') }));
    if (request.systemInstruction) messages.unshift({ role: 'system', content: request.systemInstruction.parts.map((p) => p.text).join('') });
    return { messages, parameters: { temperature: request.generationConfig?.temperature ? request.generationConfig.temperature * 2 : undefined, topP: request.generationConfig?.topP, topK: request.generationConfig?.topK, maxTokens: request.generationConfig?.maxOutputTokens, stopSequences: request.generationConfig?.stopSequences }, metadata: { requestId: 'gemini-' + Date.now(), timestamp: Date.now(), provenance: { frontend: this.metadata.name } } };
  }

  async fromIR(response: IRChatResponse): Promise<GeminiResponse> {
    return { candidates: [{ content: { role: 'model', parts: [{ text: typeof response.message.content === 'string' ? response.message.content : '' }] }, finishReason: response.finishReason === 'stop' ? 'STOP' : response.finishReason === 'length' ? 'MAX_TOKENS' : 'OTHER' }], usageMetadata: response.usage ? { promptTokenCount: response.usage.promptTokens, candidatesTokenCount: response.usage.completionTokens, totalTokenCount: response.usage.totalTokens } : undefined };
  }

  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    _options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of stream) if (chunk.type === 'content') yield 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: chunk.delta }] } }] }) + '\n\n';
  }
}
