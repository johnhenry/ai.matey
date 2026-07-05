/**
 * Tests for multimodal content types: AudioContent, DocumentContent, VideoContent
 *
 * Tests cover:
 * - IR type construction and structure
 * - Frontend adapter serialization (OpenAI, Anthropic, Gemini)
 * - Backend adapter deserialization (OpenAI, Anthropic, Gemini)
 * - Edge cases and fallback behaviors
 */

import { describe, it, expect } from 'vitest';
import type {
  AudioContent,
  DocumentContent,
  VideoContent,
  MessageContent,
  IRMessage,
  IRChatRequest,
} from 'ai.matey.types';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend';
import { GeminiFrontendAdapter } from 'ai.matey.frontend';
import { OpenAIBackendAdapter } from 'ai.matey.backend';
import { AnthropicBackendAdapter } from 'ai.matey.backend';
import { GeminiBackendAdapter } from 'ai.matey.backend';

// ============================================================================
// IR Type Construction Tests
// ============================================================================

describe('IR Multimodal Content Types', () => {
  describe('AudioContent', () => {
    it('should construct audio content with URL source', () => {
      const audio: AudioContent = {
        type: 'audio',
        source: {
          type: 'url',
          url: 'https://example.com/recording.mp3',
        },
      };
      expect(audio.type).toBe('audio');
      expect(audio.source.type).toBe('url');
      if (audio.source.type === 'url') {
        expect(audio.source.url).toBe('https://example.com/recording.mp3');
      }
    });

    it('should construct audio content with base64 source', () => {
      const audio: AudioContent = {
        type: 'audio',
        source: {
          type: 'base64',
          mediaType: 'audio/mp3',
          data: 'SGVsbG8gd29ybGQ=',
        },
      };
      expect(audio.type).toBe('audio');
      expect(audio.source.type).toBe('base64');
      if (audio.source.type === 'base64') {
        expect(audio.source.mediaType).toBe('audio/mp3');
        expect(audio.source.data).toBe('SGVsbG8gd29ybGQ=');
      }
    });

    it('should support optional transcript', () => {
      const audio: AudioContent = {
        type: 'audio',
        source: {
          type: 'base64',
          mediaType: 'audio/wav',
          data: 'AAAA',
        },
        transcript: 'Hello world',
      };
      expect(audio.transcript).toBe('Hello world');
    });

    it('should allow undefined transcript', () => {
      const audio: AudioContent = {
        type: 'audio',
        source: { type: 'url', url: 'https://example.com/audio.mp3' },
      };
      expect(audio.transcript).toBeUndefined();
    });
  });

  describe('DocumentContent', () => {
    it('should construct document content with URL source', () => {
      const doc: DocumentContent = {
        type: 'document',
        source: {
          type: 'url',
          url: 'https://example.com/report.pdf',
        },
      };
      expect(doc.type).toBe('document');
      expect(doc.source.type).toBe('url');
      if (doc.source.type === 'url') {
        expect(doc.source.url).toBe('https://example.com/report.pdf');
      }
    });

    it('should construct document content with base64 source', () => {
      const doc: DocumentContent = {
        type: 'document',
        source: {
          type: 'base64',
          mediaType: 'application/pdf',
          data: 'JVBERi0xLjQ=',
        },
      };
      expect(doc.type).toBe('document');
      expect(doc.source.type).toBe('base64');
      if (doc.source.type === 'base64') {
        expect(doc.source.mediaType).toBe('application/pdf');
      }
    });

    it('should support optional filename', () => {
      const doc: DocumentContent = {
        type: 'document',
        source: {
          type: 'base64',
          mediaType: 'application/pdf',
          data: 'JVBERi0xLjQ=',
        },
        filename: 'invoice.pdf',
      };
      expect(doc.filename).toBe('invoice.pdf');
    });

    it('should allow undefined filename', () => {
      const doc: DocumentContent = {
        type: 'document',
        source: { type: 'url', url: 'https://example.com/doc.pdf' },
      };
      expect(doc.filename).toBeUndefined();
    });
  });

  describe('VideoContent', () => {
    it('should construct video content with URL source', () => {
      const video: VideoContent = {
        type: 'video',
        source: {
          type: 'url',
          url: 'https://example.com/clip.mp4',
        },
      };
      expect(video.type).toBe('video');
      expect(video.source.type).toBe('url');
      if (video.source.type === 'url') {
        expect(video.source.url).toBe('https://example.com/clip.mp4');
      }
    });

    it('should construct video content with base64 source', () => {
      const video: VideoContent = {
        type: 'video',
        source: {
          type: 'base64',
          mediaType: 'video/mp4',
          data: 'AAAAIGZ0eXBpc29t',
        },
      };
      expect(video.type).toBe('video');
      expect(video.source.type).toBe('base64');
      if (video.source.type === 'base64') {
        expect(video.source.mediaType).toBe('video/mp4');
      }
    });

    it('should support optional poster', () => {
      const video: VideoContent = {
        type: 'video',
        source: { type: 'url', url: 'https://example.com/clip.mp4' },
        poster: 'https://example.com/thumb.jpg',
      };
      expect(video.poster).toBe('https://example.com/thumb.jpg');
    });

    it('should allow undefined poster', () => {
      const video: VideoContent = {
        type: 'video',
        source: { type: 'url', url: 'https://example.com/clip.mp4' },
      };
      expect(video.poster).toBeUndefined();
    });
  });

  describe('MessageContent union', () => {
    it('should accept AudioContent in the union', () => {
      const content: MessageContent = {
        type: 'audio',
        source: { type: 'url', url: 'https://example.com/audio.mp3' },
      };
      expect(content.type).toBe('audio');
    });

    it('should accept DocumentContent in the union', () => {
      const content: MessageContent = {
        type: 'document',
        source: { type: 'url', url: 'https://example.com/doc.pdf' },
      };
      expect(content.type).toBe('document');
    });

    it('should accept VideoContent in the union', () => {
      const content: MessageContent = {
        type: 'video',
        source: { type: 'url', url: 'https://example.com/video.mp4' },
      };
      expect(content.type).toBe('video');
    });

    it('should support mixed content arrays', () => {
      const contents: MessageContent[] = [
        { type: 'text', text: 'Check these attachments' },
        { type: 'image', source: { type: 'url', url: 'https://example.com/img.jpg' } },
        { type: 'audio', source: { type: 'url', url: 'https://example.com/audio.mp3' } },
        {
          type: 'document',
          source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
          filename: 'report.pdf',
        },
        { type: 'video', source: { type: 'url', url: 'https://example.com/video.mp4' } },
      ];
      expect(contents).toHaveLength(5);
      expect(contents.map((c) => c.type)).toEqual([
        'text',
        'image',
        'audio',
        'document',
        'video',
      ]);
    });

    it('should work in an IRMessage', () => {
      const message: IRMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this audio' },
          {
            type: 'audio',
            source: { type: 'base64', mediaType: 'audio/mp3', data: 'AAAA' },
            transcript: 'test transcript',
          },
        ],
      };
      expect(message.content).toHaveLength(2);
    });
  });
});

// ============================================================================
// Frontend Adapter Tests
// ============================================================================

describe('Frontend Adapter Multimodal Serialization', () => {
  describe('OpenAI Frontend Adapter', () => {
    const adapter = new OpenAIFrontendAdapter();

    it('should convert OpenAI input_audio to IR AudioContent', async () => {
      const result = await adapter.toIR({
        model: 'gpt-4o-audio-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What do you hear?' },
              {
                type: 'input_audio',
                input_audio: { data: 'SGVsbG8=', format: 'mp3' },
              },
            ],
          },
        ],
      });

      const msg = result.messages[0];
      expect(Array.isArray(msg.content)).toBe(true);
      const blocks = msg.content as MessageContent[];
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('text');
      expect(blocks[1].type).toBe('audio');
      if (blocks[1].type === 'audio' && blocks[1].source.type === 'base64') {
        expect(blocks[1].source.mediaType).toBe('audio/mp3');
        expect(blocks[1].source.data).toBe('SGVsbG8=');
      }
    });

    it('should convert IR AudioContent (base64) to OpenAI input_audio', async () => {
      const irResponse = {
        message: {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: 'Listen' },
            {
              type: 'audio' as const,
              source: {
                type: 'base64' as const,
                mediaType: 'audio/wav',
                data: 'UklGRg==',
              },
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: {
          requestId: 'test-123',
          timestamp: Date.now(),
        },
      };
      const result = await adapter.fromIR(irResponse);
      const content = result.choices[0].message.content;
      expect(Array.isArray(content)).toBe(true);
      if (Array.isArray(content)) {
        const audioBlock = content.find((c: any) => c.type === 'input_audio');
        expect(audioBlock).toBeDefined();
        if (audioBlock && 'input_audio' in audioBlock) {
          expect(audioBlock.input_audio.data).toBe('UklGRg==');
          expect(audioBlock.input_audio.format).toBe('wav');
        }
      }
    });

    it('should convert IR AudioContent (url) to text fallback', async () => {
      const irResponse = {
        message: {
          role: 'user' as const,
          content: [
            {
              type: 'audio' as const,
              source: { type: 'url' as const, url: 'https://example.com/sound.mp3' },
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      const content = result.choices[0].message.content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Audio');
          expect(content[0].text).toContain('https://example.com/sound.mp3');
        }
      }
    });

    it('should convert IR DocumentContent to text fallback', async () => {
      const irResponse = {
        message: {
          role: 'user' as const,
          content: [
            {
              type: 'document' as const,
              source: { type: 'url' as const, url: 'https://example.com/report.pdf' },
              filename: 'report.pdf',
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      const content = result.choices[0].message.content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Document');
          expect(content[0].text).toContain('report.pdf');
        }
      }
    });

    it('should convert IR VideoContent to text fallback', async () => {
      const irResponse = {
        message: {
          role: 'user' as const,
          content: [
            {
              type: 'video' as const,
              source: { type: 'url' as const, url: 'https://example.com/clip.mp4' },
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      const content = result.choices[0].message.content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Video');
          expect(content[0].text).toContain('https://example.com/clip.mp4');
        }
      }
    });
  });

  describe('Anthropic Frontend Adapter', () => {
    const adapter = new AnthropicFrontendAdapter();

    it('should convert Anthropic document block to IR DocumentContent', async () => {
      const result = await adapter.toIR({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read this document' },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: 'JVBERi0xLjQ=',
                },
                filename: 'report.pdf',
              },
            ],
          },
        ],
      });

      const msg = result.messages[0];
      expect(Array.isArray(msg.content)).toBe(true);
      const blocks = msg.content as MessageContent[];
      expect(blocks).toHaveLength(2);
      expect(blocks[1].type).toBe('document');
      if (blocks[1].type === 'document') {
        expect(blocks[1].filename).toBe('report.pdf');
        if (blocks[1].source.type === 'base64') {
          expect(blocks[1].source.mediaType).toBe('application/pdf');
        }
      }
    });

    it('should convert Anthropic document URL block to IR DocumentContent', async () => {
      const result = await adapter.toIR({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'url', url: 'https://example.com/doc.pdf' },
              },
            ],
          },
        ],
      });

      const blocks = result.messages[0].content as MessageContent[];
      expect(blocks[0].type).toBe('document');
      if (blocks[0].type === 'document' && blocks[0].source.type === 'url') {
        expect(blocks[0].source.url).toBe('https://example.com/doc.pdf');
      }
    });

    it('should convert IR DocumentContent back to Anthropic document block', async () => {
      const irResponse = {
        message: {
          role: 'assistant' as const,
          content: [
            { type: 'text' as const, text: 'Here is the document' },
            {
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                mediaType: 'application/pdf',
                data: 'JVBERi0xLjQ=',
              },
              filename: 'result.pdf',
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      expect(result.content).toHaveLength(2);
      expect(result.content[1].type).toBe('document');
      if (result.content[1].type === 'document' && result.content[1].source.type === 'base64') {
        expect(result.content[1].source.media_type).toBe('application/pdf');
        expect(result.content[1].filename).toBe('result.pdf');
      }
    });

    it('should convert IR AudioContent to text fallback in Anthropic', async () => {
      const irResponse = {
        message: {
          role: 'assistant' as const,
          content: [
            {
              type: 'audio' as const,
              source: { type: 'base64' as const, mediaType: 'audio/mp3', data: 'AAAA' },
              transcript: 'Hello world',
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Audio transcript');
        expect(result.content[0].text).toContain('Hello world');
      }
    });

    it('should convert IR AudioContent without transcript to generic fallback', async () => {
      const irResponse = {
        message: {
          role: 'assistant' as const,
          content: [
            {
              type: 'audio' as const,
              source: { type: 'base64' as const, mediaType: 'audio/mp3', data: 'AAAA' },
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Audio attachment');
      }
    });

    it('should convert IR VideoContent to text fallback in Anthropic', async () => {
      const irResponse = {
        message: {
          role: 'assistant' as const,
          content: [
            {
              type: 'video' as const,
              source: { type: 'url' as const, url: 'https://example.com/vid.mp4' },
            },
          ],
        },
        finishReason: 'stop' as const,
        metadata: { requestId: 'test', timestamp: Date.now() },
      };
      const result = await adapter.fromIR(irResponse);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toContain('Video');
        expect(result.content[0].text).toContain('https://example.com/vid.mp4');
      }
    });
  });

  describe('Gemini Frontend Adapter', () => {
    const adapter = new GeminiFrontendAdapter();

    it('should convert Gemini inlineData audio to IR AudioContent', async () => {
      const result = await adapter.toIR({
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'What is this sound?' },
              { inlineData: { mimeType: 'audio/mp3', data: 'AAAA' } },
            ],
          },
        ],
      });

      const msg = result.messages[0];
      expect(Array.isArray(msg.content)).toBe(true);
      const blocks = msg.content as MessageContent[];
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('text');
      expect(blocks[1].type).toBe('audio');
    });

    it('should convert Gemini inlineData video to IR VideoContent', async () => {
      const result = await adapter.toIR({
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: 'video/mp4', data: 'BBBB' } }],
          },
        ],
      });

      const blocks = result.messages[0].content as MessageContent[];
      expect(blocks[0].type).toBe('video');
    });

    it('should convert Gemini inlineData PDF to IR DocumentContent', async () => {
      const result = await adapter.toIR({
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } }],
          },
        ],
      });

      const blocks = result.messages[0].content as MessageContent[];
      expect(blocks[0].type).toBe('document');
    });

    it('should convert Gemini inlineData image to IR ImageContent', async () => {
      const result = await adapter.toIR({
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: 'image/jpeg', data: '/9j/4AAQ' } }],
          },
        ],
      });

      const blocks = result.messages[0].content as MessageContent[];
      expect(blocks[0].type).toBe('image');
    });

    it('should keep text-only parts as simple string', async () => {
      const result = await adapter.toIR({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello' }],
          },
        ],
      });

      expect(typeof result.messages[0].content).toBe('string');
      expect(result.messages[0].content).toBe('Hello');
    });
  });
});

// ============================================================================
// Backend Adapter Tests
// ============================================================================

describe('Backend Adapter Multimodal Deserialization', () => {
  function makeIRRequest(content: MessageContent[]): IRChatRequest {
    return {
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      parameters: {
        model: 'test-model',
        maxTokens: 100,
      },
      metadata: {
        requestId: 'test-123',
        timestamp: Date.now(),
      },
    };
  }

  describe('OpenAI Backend Adapter', () => {
    const adapter = new OpenAIBackendAdapter({ apiKey: 'test-key' });

    it('should convert IR AudioContent (base64) to OpenAI input_audio', () => {
      const request = makeIRRequest([
        { type: 'text', text: 'What is this?' },
        {
          type: 'audio',
          source: { type: 'base64', mediaType: 'audio/mp3', data: 'SGVsbG8=' },
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      expect(Array.isArray(content)).toBe(true);
      if (Array.isArray(content)) {
        expect(content).toHaveLength(2);
        expect(content[1].type).toBe('input_audio');
        if (content[1].type === 'input_audio') {
          expect(content[1].input_audio.data).toBe('SGVsbG8=');
          expect(content[1].input_audio.format).toBe('mp3');
        }
      }
    });

    it('should convert IR AudioContent (url) to text fallback', () => {
      const request = makeIRRequest([
        {
          type: 'audio',
          source: { type: 'url', url: 'https://example.com/audio.mp3' },
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Audio');
        }
      }
    });

    it('should convert IR AudioContent (url with transcript) to transcript fallback', () => {
      const request = makeIRRequest([
        {
          type: 'audio',
          source: { type: 'url', url: 'https://example.com/audio.mp3' },
          transcript: 'Hello world',
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      if (Array.isArray(content)) {
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('transcript');
          expect(content[0].text).toContain('Hello world');
        }
      }
    });

    it('should convert IR DocumentContent to text fallback', () => {
      const request = makeIRRequest([
        {
          type: 'document',
          source: { type: 'url', url: 'https://example.com/report.pdf' },
          filename: 'report.pdf',
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Document');
          expect(content[0].text).toContain('report.pdf');
        }
      }
    });

    it('should convert IR DocumentContent (base64) to text fallback with filename', () => {
      const request = makeIRRequest([
        {
          type: 'document',
          source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
          filename: 'invoice.pdf',
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      if (Array.isArray(content)) {
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('invoice.pdf');
        }
      }
    });

    it('should convert IR VideoContent to text fallback', () => {
      const request = makeIRRequest([
        {
          type: 'video',
          source: { type: 'url', url: 'https://example.com/video.mp4' },
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Video');
        }
      }
    });

    it('should handle mixed content with new types', () => {
      const request = makeIRRequest([
        { type: 'text', text: 'Analyze these' },
        { type: 'image', source: { type: 'url', url: 'https://example.com/img.jpg' } },
        {
          type: 'audio',
          source: { type: 'base64', mediaType: 'audio/mp3', data: 'AAAA' },
        },
        {
          type: 'document',
          source: { type: 'url', url: 'https://example.com/doc.pdf' },
          filename: 'doc.pdf',
        },
        {
          type: 'video',
          source: { type: 'base64', mediaType: 'video/mp4', data: 'BBBB' },
        },
      ]);

      const openaiReq = adapter.fromIR(request);
      const content = openaiReq.messages[0].content;
      expect(Array.isArray(content)).toBe(true);
      if (Array.isArray(content)) {
        expect(content).toHaveLength(5);
        expect(content[0].type).toBe('text');
        expect(content[1].type).toBe('image_url');
        expect(content[2].type).toBe('input_audio');
        expect(content[3].type).toBe('text'); // document fallback
        expect(content[4].type).toBe('text'); // video fallback
      }
    });
  });

  describe('Anthropic Backend Adapter', () => {
    const adapter = new AnthropicBackendAdapter({ apiKey: 'test-key' });

    it('should convert IR DocumentContent (base64) to Anthropic document block', () => {
      const request = makeIRRequest([
        { type: 'text', text: 'Read this' },
        {
          type: 'document',
          source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
          filename: 'report.pdf',
        },
      ]);

      const anthropicReq = adapter.fromIR(request);
      const content = anthropicReq.messages[0].content;
      expect(Array.isArray(content)).toBe(true);
      if (Array.isArray(content)) {
        expect(content).toHaveLength(2);
        expect(content[1].type).toBe('document');
        if (content[1].type === 'document' && content[1].source.type === 'base64') {
          expect(content[1].source.media_type).toBe('application/pdf');
          expect(content[1].source.data).toBe('JVBERi0=');
          expect(content[1].filename).toBe('report.pdf');
        }
      }
    });

    it('should convert IR DocumentContent (url) to Anthropic document block', () => {
      const request = makeIRRequest([
        {
          type: 'document',
          source: { type: 'url', url: 'https://example.com/doc.pdf' },
        },
      ]);

      const anthropicReq = adapter.fromIR(request);
      const content = anthropicReq.messages[0].content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('document');
        if (content[0].type === 'document' && content[0].source.type === 'url') {
          expect(content[0].source.url).toBe('https://example.com/doc.pdf');
        }
      }
    });

    it('should convert IR AudioContent to text fallback in Anthropic', () => {
      const request = makeIRRequest([
        {
          type: 'audio',
          source: { type: 'base64', mediaType: 'audio/mp3', data: 'AAAA' },
          transcript: 'Hello world',
        },
      ]);

      const anthropicReq = adapter.fromIR(request);
      const content = anthropicReq.messages[0].content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Audio transcript');
          expect(content[0].text).toContain('Hello world');
        }
      }
    });

    it('should convert IR VideoContent to text fallback in Anthropic', () => {
      const request = makeIRRequest([
        {
          type: 'video',
          source: { type: 'url', url: 'https://example.com/clip.mp4' },
        },
      ]);

      const anthropicReq = adapter.fromIR(request);
      const content = anthropicReq.messages[0].content;
      if (Array.isArray(content)) {
        expect(content[0].type).toBe('text');
        if (content[0].type === 'text') {
          expect(content[0].text).toContain('Video');
        }
      }
    });
  });

  describe('Gemini Backend Adapter', () => {
    const adapter = new GeminiBackendAdapter({ apiKey: 'test-key' });

    it('should convert IR AudioContent (base64) to Gemini inlineData', () => {
      const request = makeIRRequest([
        { type: 'text', text: 'What is this?' },
        {
          type: 'audio',
          source: { type: 'base64', mediaType: 'audio/mp3', data: 'AAAA' },
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect(parts).toHaveLength(2);
      expect('text' in parts[0]).toBe(true);
      expect('inlineData' in parts[1]).toBe(true);
      if ('inlineData' in parts[1]) {
        expect(parts[1].inlineData.mimeType).toBe('audio/mp3');
        expect(parts[1].inlineData.data).toBe('AAAA');
      }
    });

    it('should convert IR VideoContent (base64) to Gemini inlineData', () => {
      const request = makeIRRequest([
        {
          type: 'video',
          source: { type: 'base64', mediaType: 'video/mp4', data: 'BBBB' },
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect('inlineData' in parts[0]).toBe(true);
      if ('inlineData' in parts[0]) {
        expect(parts[0].inlineData.mimeType).toBe('video/mp4');
        expect(parts[0].inlineData.data).toBe('BBBB');
      }
    });

    it('should convert IR DocumentContent (base64) to Gemini inlineData', () => {
      const request = makeIRRequest([
        {
          type: 'document',
          source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
          filename: 'report.pdf',
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect('inlineData' in parts[0]).toBe(true);
      if ('inlineData' in parts[0]) {
        expect(parts[0].inlineData.mimeType).toBe('application/pdf');
        expect(parts[0].inlineData.data).toBe('JVBERi0=');
      }
    });

    it('should convert IR AudioContent (url) to text fallback', () => {
      const request = makeIRRequest([
        {
          type: 'audio',
          source: { type: 'url', url: 'https://example.com/audio.mp3' },
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect('text' in parts[0]).toBe(true);
      if ('text' in parts[0]) {
        expect(parts[0].text).toContain('Audio');
      }
    });

    it('should convert IR AudioContent (url with transcript) to transcript fallback', () => {
      const request = makeIRRequest([
        {
          type: 'audio',
          source: { type: 'url', url: 'https://example.com/audio.mp3' },
          transcript: 'Hello world',
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect('text' in parts[0]).toBe(true);
      if ('text' in parts[0]) {
        expect(parts[0].text).toContain('transcript');
        expect(parts[0].text).toContain('Hello world');
      }
    });

    it('should convert IR VideoContent (url) to text fallback', () => {
      const request = makeIRRequest([
        {
          type: 'video',
          source: { type: 'url', url: 'https://example.com/video.mp4' },
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect('text' in parts[0]).toBe(true);
      if ('text' in parts[0]) {
        expect(parts[0].text).toContain('Video');
      }
    });

    it('should convert IR DocumentContent (url) to text fallback', () => {
      const request = makeIRRequest([
        {
          type: 'document',
          source: { type: 'url', url: 'https://example.com/doc.pdf' },
          filename: 'doc.pdf',
        },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect('text' in parts[0]).toBe(true);
      if ('text' in parts[0]) {
        expect(parts[0].text).toContain('Document');
        expect(parts[0].text).toContain('doc.pdf');
      }
    });

    it('should handle mixed multimodal content', () => {
      const request = makeIRRequest([
        { type: 'text', text: 'Process these' },
        { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'iVBOR' } },
        { type: 'audio', source: { type: 'base64', mediaType: 'audio/wav', data: 'UklGR' } },
        {
          type: 'document',
          source: { type: 'base64', mediaType: 'application/pdf', data: 'JVBERi0=' },
        },
        { type: 'video', source: { type: 'base64', mediaType: 'video/mp4', data: 'AAAAI' } },
      ]);

      const geminiReq = adapter.fromIR(request);
      const parts = geminiReq.contents[0].parts;
      expect(parts).toHaveLength(5);

      // text part
      expect('text' in parts[0]).toBe(true);
      // image inlineData
      expect('inlineData' in parts[1]).toBe(true);
      // audio inlineData
      expect('inlineData' in parts[2]).toBe(true);
      // document inlineData
      expect('inlineData' in parts[3]).toBe(true);
      // video inlineData
      expect('inlineData' in parts[4]).toBe(true);

      if ('inlineData' in parts[1]) expect(parts[1].inlineData.mimeType).toBe('image/png');
      if ('inlineData' in parts[2]) expect(parts[2].inlineData.mimeType).toBe('audio/wav');
      if ('inlineData' in parts[3]) expect(parts[3].inlineData.mimeType).toBe('application/pdf');
      if ('inlineData' in parts[4]) expect(parts[4].inlineData.mimeType).toBe('video/mp4');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Multimodal Edge Cases', () => {
  it('should handle empty data in base64 sources', () => {
    const audio: AudioContent = {
      type: 'audio',
      source: { type: 'base64', mediaType: 'audio/mp3', data: '' },
    };
    expect(audio.source.type).toBe('base64');
    if (audio.source.type === 'base64') {
      expect(audio.source.data).toBe('');
    }
  });

  it('should handle unusual mediaTypes', () => {
    const doc: DocumentContent = {
      type: 'document',
      source: {
        type: 'base64',
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: 'UEsDBBQ=',
      },
      filename: 'document.docx',
    };
    if (doc.source.type === 'base64') {
      expect(doc.source.mediaType).toContain('openxmlformats');
    }
  });

  it('should handle very long URLs', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2000) + '.mp4';
    const video: VideoContent = {
      type: 'video',
      source: { type: 'url', url: longUrl },
    };
    if (video.source.type === 'url') {
      expect(video.source.url.length).toBeGreaterThan(2000);
    }
  });

  it('should preserve all fields through OpenAI roundtrip for audio', async () => {
    const adapter = new OpenAIFrontendAdapter();

    // OpenAI request with input_audio -> IR -> OpenAI response
    const irRequest = await adapter.toIR({
      model: 'gpt-4o-audio-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: 'SGVsbG8=', format: 'wav' } },
          ],
        },
      ],
    });

    const blocks = irRequest.messages[0].content as MessageContent[];
    expect(blocks[0].type).toBe('audio');
    if (blocks[0].type === 'audio' && blocks[0].source.type === 'base64') {
      expect(blocks[0].source.mediaType).toBe('audio/wav');
      expect(blocks[0].source.data).toBe('SGVsbG8=');
    }
  });

  it('should preserve document fields through Anthropic roundtrip', async () => {
    const adapter = new AnthropicFrontendAdapter();

    const irRequest = await adapter.toIR({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: 'JVBERi0xLjQ=',
              },
              filename: 'test.pdf',
            },
          ],
        },
      ],
    });

    const blocks = irRequest.messages[0].content as MessageContent[];
    expect(blocks[0].type).toBe('document');
    if (blocks[0].type === 'document') {
      expect(blocks[0].filename).toBe('test.pdf');
      if (blocks[0].source.type === 'base64') {
        expect(blocks[0].source.mediaType).toBe('application/pdf');
        expect(blocks[0].source.data).toBe('JVBERi0xLjQ=');
      }
    }

    // Now convert back to Anthropic format
    const irResponse = {
      message: {
        role: 'assistant' as const,
        content: blocks,
      },
      finishReason: 'stop' as const,
      metadata: { requestId: 'test', timestamp: Date.now() },
    };
    const anthropicResp = await adapter.fromIR(irResponse);
    const docBlock = anthropicResp.content[0];
    expect(docBlock.type).toBe('document');
    if (docBlock.type === 'document') {
      expect(docBlock.filename).toBe('test.pdf');
      if (docBlock.source.type === 'base64') {
        expect(docBlock.source.media_type).toBe('application/pdf');
        expect(docBlock.source.data).toBe('JVBERi0xLjQ=');
      }
    }
  });
});
