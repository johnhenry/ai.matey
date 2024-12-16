import { languageModel } from './languageModel.mjs';

// Mock session class implementing Summarizer Session
class MockSummarizerSession {
  #session;

  constructor(options = {}) {
    // Add default system prompt for summarization if not provided
    const systemPrompt = options.systemPrompt || 
      "You are a highly skilled summarizer. Provide ONLY the summary without any introductions, explanations, or conclusions.";
    
    this.#session = new languageModel.create({ ...options, systemPrompt });
  }

  #generateMockSummary(text, type, length) {
    switch (type) {
      case 'headline':
        return 'Mock: Breaking News About Important Topic';
      case 'tl;dr':
        return 'Mock TL;DR: Key points about the topic in a brief format.';
      case 'bullet-points':
        return '• Mock Point 1\n• Mock Point 2\n• Mock Point 3';
      default: // paragraph
        const lengths = {
          short: 'This is a short mock summary.',
          medium: 'This is a medium-length mock summary that contains more details about the topic.',
          long: 'This is a long mock summary that contains extensive details about the topic. It includes multiple sentences and covers various aspects of the content in a comprehensive manner while maintaining clarity and conciseness.',
        };
        return lengths[length] || lengths.medium;
    }
  }

  async summarize(text, options = {}) {
    const type = options.type || 'paragraph';
    const length = options.length || 'medium';
    
    // Use the mock summary instead of actual language model response
    return this.#generateMockSummary(text, type, length);
  }

  async summarizeStreaming(text, options = {}) {
    const summary = await this.summarize(text, options);
    return new ReadableStream({
      start(controller) {
        // Split the summary into chunks to simulate streaming
        const chunks = summary.split(' ');
        chunks.forEach(chunk => {
          controller.enqueue(chunk + ' ');
        });
        controller.close();
      }
    });
  }
}

// Mock implementation of summarizer namespace
const summarizer = {
  async capabilities() {
    return await languageModel.capabilities();
  },

  async create(options = {}) {
    return new MockSummarizerSession(options);
  }
};

export { summarizer };
export default summarizer;
