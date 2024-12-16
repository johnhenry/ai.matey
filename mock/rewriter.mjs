import { languageModel } from './languageModel.mjs';

// Mock session class implementing ReWriter Session
class MockReWriterSession {
  #session;

  constructor(options = {}) {
    // Add default system prompt for rewriting if not provided
    const systemPrompt = options.systemPrompt ||
      "You are an expert editor. Provide ONLY the rewritten text without any introductions or explanations.";
    
    this.#session = languageModel.create({ ...options, systemPrompt });
  }

  #generateMockRewrite(text, tone, goal) {
    const mockRewrites = {
      simplify: {
        formal: 'This is a simplified, formal version of the text.',
        casual: 'This is a simple, friendly version.',
        neutral: 'This is a simplified version that anyone can understand.'
      },
      formalize: {
        formal: 'This is a highly formal and professional rendition of the original text.',
        casual: 'This is a somewhat more formal version, while keeping some approachability.',
        neutral: 'This is a professionally formatted version of the text.'
      },
      constructive: {
        formal: 'This is a constructive, professional reformulation of the feedback.',
        casual: 'This is a friendly, positive way to say the same thing.',
        neutral: 'This is a balanced, constructive version of the feedback.'
      },
      improve: {
        formal: 'This is an enhanced, professional version with improved clarity.',
        casual: 'This is a better, more readable version.',
        neutral: 'This is an improved version with better clarity and flow.'
      }
    };

    const goalGroup = mockRewrites[goal] || mockRewrites.improve;
    return goalGroup[tone] || goalGroup.neutral;
  }

  async rewrite(text, options = {}) {
    const tone = options.tone || 'neutral';
    const goal = options.goal || 'improve';
    
    // Use the mock rewrite instead of actual language model response
    return this.#generateMockRewrite(text, tone, goal);
  }

  async rewriteStreaming(text, options = {}) {
    const content = await this.rewrite(text, options);
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

// Mock implementation of rewriter namespace
const rewriter = {
  async capabilities() {
    return await languageModel.capabilities();
  },

  async create(options = {}) {
    return new MockReWriterSession(options);
  }
};

export { rewriter };
export default rewriter;
