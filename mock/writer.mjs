import { languageModel } from './languageModel.mjs';

// Mock session class implementing Writer Session
class MockWriterSession {
  #session;

  constructor(options = {}) {
    // Add default system prompt for writing if not provided
    const systemPrompt = options.systemPrompt || 
      "You are a skilled writer. Provide ONLY the requested content without any introductions or conclusions.";
    
    this.#session = languageModel.create({ ...options, systemPrompt });
  }

  #generateMockContent(task, tone, length) {
    const tones = {
      formal: {
        short: 'This is a brief, formal mock response.',
        medium: 'This is a moderately detailed, formal mock response that maintains professional language throughout.',
        long: 'This is an extensive, formal mock response that thoroughly addresses the topic while maintaining professional language and proper structure throughout the entire content.'
      },
      casual: {
        short: 'Hey! Here\'s a quick mock response.',
        medium: 'Hey there! Here\'s a friendly mock response that keeps things casual and easy to read.',
        long: 'Hey everyone! Here\'s a detailed but casual mock response that keeps the friendly tone while giving you all the info you need in an easy-to-read format.'
      },
      neutral: {
        short: 'This is a short mock response.',
        medium: 'This is a medium-length mock response with balanced and neutral language.',
        long: 'This is a comprehensive mock response that maintains a balanced and neutral tone throughout while providing detailed information about the requested topic.'
      }
    };

    const toneGroup = tones[tone] || tones.neutral;
    return toneGroup[length] || toneGroup.medium;
  }

  async write(task, options = {}) {
    const tone = options.tone || 'neutral';
    const length = options.length || 'medium';
    
    // Use the mock content instead of actual language model response
    return this.#generateMockContent(task, tone, length);
  }

  async writeStreaming(task, options = {}) {
    const content = await this.write(task, options);
    return new ReadableStream({
      start(controller) {
        // Split the content into chunks to simulate streaming
        const chunks = content.split(' ');
        chunks.forEach(chunk => {
          controller.enqueue(chunk + ' ');
        });
        controller.close();
      }
    });
  }
  destroy() {
    // No-op for mock implementation
  }
}

// Mock implementation of writer namespace
const writer = {
  async capabilities() {
    return await languageModel.capabilities();
  },

  async create(options = {}) {
    return new MockWriterSession(options);
  }
};

export { writer };
export default writer;
