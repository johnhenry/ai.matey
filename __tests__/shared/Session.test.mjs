// Simple Test Runner and Mocking Setup
const tests = [];
let originalFetch;
let mockFetchResponses = [];
let fetchCallArgs = [];

async function mockFetch(url, options) {
  fetchCallArgs.push({ url, options });
  if (mockFetchResponses.length === 0) {
    throw new Error('Mock fetch called but no response was queued.');
  }
  const mockResponse = mockFetchResponses.shift();
  if (mockResponse.error) {
    return Promise.resolve({
      ok: false,
      status: mockResponse.status || 500,
      statusText: mockResponse.statusText || 'Internal Server Error',
      text: () => Promise.resolve(mockResponse.error),
      json: () => Promise.resolve(mockResponse.error), // if error is JSON
    });
  }
  return Promise.resolve({
    ok: true,
    status: mockResponse.status || 200,
    statusText: mockResponse.statusText || 'OK',
    json: () => Promise.resolve(mockResponse.json),
    text: () => Promise.resolve(mockResponse.text),
    body: mockResponse.body, // For streaming
  });
}

function setupTests() {
  originalFetch = global.fetch;
  global.fetch = mockFetch;
}

function teardownTests() {
  global.fetch = originalFetch;
}

function queueMockResponse(response) {
  mockFetchResponses.push(response);
}

function clearFetchCalls() {
  fetchCallArgs = [];
  mockFetchResponses = [];
}

function test(description, fn) {
  tests.push({ description, fn });
}

async function runTests() {
  setupTests();
  for (const t of tests) {
    clearFetchCalls(); // Clear mocks for each test
    try {
      await t.fn();
      console.log(`✅ PASS: ${t.description}`);
    } catch (e) {
      console.error(`❌ FAIL: ${t.description}`);
      console.error(e);
    }
  }
  teardownTests();
}

// --- End of Simple Test Runner ---

// Import the class to be tested
import SharedSession from '../../shared/Session.mjs';

// Mock AI interface for Session constructor
const mockAi = {
  config: { model: 'test-model', endpoint: 'http://localhost:1234/api' },
  languageModel: { _capabilities: { defaultTemperature: 0.7, maxTokens: 100 } }
};

test('_countTokensInMessages: string content', async () => {
  const session = new SharedSession({}, mockAi);
  const messages = [{ role: 'user', content: 'Hello world' }];
  // "Hello" -> 1, "world" -> 1. Total 2. Plus 3 for structure. = 5
  const count = session._countTokensInMessages(messages);
  console.assert(count === 5, `Expected 5, got ${count}`);
});

test('_countTokensInMessages: array of text parts', async () => {
  const session = new SharedSession({}, mockAi);
  const messages = [
    { role: 'user', content: [{ type: 'text', value: 'Hello' }, { type: 'text', value: 'World' }] }
  ];
  // "Hello" -> 1, "World" -> 1. Total 2. Plus 3 for structure. = 5
  const count = session._countTokensInMessages(messages);
  console.assert(count === 5, `Expected 5, got ${count}`);
});

test('_countTokensInMessages: mixed content (text and image)', async () => {
  const session = new SharedSession({}, mockAi);
  const messages = [
    { role: 'user', content: [{ type: 'text', value: 'Describe:' }, { type: 'image', value: 'placeholder_image_data' }] }
  ];
  // "Describe:" -> 1. Image placeholder -> 75. Total 76. Plus 3 for structure. = 79
  const count = session._countTokensInMessages(messages);
  console.assert(count === 79, `Expected 79, got ${count}`);
});

test('_countTokensInMessages: empty messages array', async () => {
  const session = new SharedSession({}, mockAi);
  const messages = [];
  const count = session._countTokensInMessages(messages);
  console.assert(count === 0, `Expected 0, got ${count}`);
});

test('_countTokensInMessages: message with empty string content', async () => {
  const session = new SharedSession({}, mockAi);
  const messages = [{ role: 'user', content: '' }];
  // "" -> 1 (Math.max(1, tokenCount) in _countTokens). Plus 3 for structure. = 4
  const count = session._countTokensInMessages(messages);
  console.assert(count === 4, `Expected 4, got ${count}`);
});

test('_countTokensInMessages: message with empty array content', async () => {
  const session = new SharedSession({}, mockAi);
  const messages = [{ role: 'user', content: [] }];
  // Empty array content -> 0. Plus 3 for structure. = 3
  const count = session._countTokensInMessages(messages);
  console.assert(count === 3, `Expected 3, got ${count}`);
});


// --- Tests for chat() ---

class TestSession extends SharedSession {
  // Mock prompt and promptStreaming for chat() tests
  async prompt(input, options) {
    fetchCallArgs.push({ type: 'prompt', input, options }); // Log call
    return "Mocked prompt response";
  }
  async *promptStreaming(input, options) {
    fetchCallArgs.push({ type: 'promptStreaming', input, options }); // Log call
    yield "Mocked ";
    yield "streamed ";
    yield "response";
  }
}


test('chat(): stream: false - basic functionality', async () => {
  const session = new TestSession({}, mockAi);
  const messages = [
    { role: 'system', content: 'System prompt.' },
    { role: 'user', content: 'User message 1.' },
    { role: 'assistant', content: 'Assistant message 1.' },
    { role: 'user', content: 'Last user message.' },
  ];

  const chatOptions = { messages, stream: false, temperature: 0.5 };
  
  // Mock _countTokensInMessages for predictable usage data
  const originalCountTokens = session._countTokensInMessages;
  session._countTokensInMessages = (msgs) => {
    if (msgs.length === 1 && msgs[0].role === 'user') return 10; // prompt_tokens
    if (msgs.length === 1 && msgs[0].role === 'assistant') return 20; // completion_tokens
    return 0;
  };

  const response = await session.chat(chatOptions);

  // Verify _setConversationHistory call (indirectly by checking history state if possible, or by spying if framework allows)
  // For now, check that _getConversationHistory inside prompt/promptStreaming would receive the correct slice.
  // The TestSession's mock prompt/promptStreaming doesn't use _getConversationHistory, so we check the call args.
  const promptCall = fetchCallArgs.find(call => call.type === 'prompt');
  console.assert(promptCall, "session.prompt was not called");
  console.assert(promptCall.input === 'Last user message.', "session.prompt called with wrong input");
  
  // Check that _setConversationHistory was effectively called by chat()
  // We can verify this by checking the history state *during* the mocked prompt call.
  // This requires a more sophisticated spy or temporarily overriding _getConversationHistory.
  // For this simple runner, we'll trust the implementation detail that _setConversationHistory is called.
  // A more direct way:
  let historyDuringPromptCall;
  session.prompt = async (input, options) => { // Override again to capture history
    historyDuringPromptCall = session._getConversationHistory();
    fetchCallArgs.push({ type: 'prompt', input, options });
    return "Mocked prompt response";
  };
  await session.chat(chatOptions); // Call again with the spy
  
  const expectedHistory = messages.slice(0, -1);
  console.assert(JSON.stringify(historyDuringPromptCall) === JSON.stringify(expectedHistory), 
    `_setConversationHistory not called correctly. Expected ${JSON.stringify(expectedHistory)}, got ${JSON.stringify(historyDuringPromptCall)}`);


  // Verify response structure
  console.assert(response.id, "Response missing id");
  console.assert(response.object === "chat.completion", "Response object type incorrect");
  console.assert(response.choices[0].message.content === "Mocked prompt response", "Response content incorrect");
  console.assert(response.choices[0].message.role === "assistant", "Response role incorrect");
  
  // Verify usage
  console.assert(response.usage.prompt_tokens === 10, "Prompt tokens incorrect");
  console.assert(response.usage.completion_tokens === 20, "Completion tokens incorrect");
  console.assert(response.usage.total_tokens === 30, "Total tokens incorrect");

  session._countTokensInMessages = originalCountTokens; // Restore
});


test('chat(): stream: true - basic functionality', async () => {
  const session = new TestSession({}, mockAi);
   const messages = [
    { role: 'system', content: 'System prompt.' },
    { role: 'user', content: 'User message 1.' },
    { role: 'assistant', content: 'Assistant message 1.' },
    { role: 'user', content: 'Last user message for stream.' },
  ];
  const chatOptions = { messages, stream: true, temperature: 0.6 };

  const stream = await session.chat(chatOptions);
  
  let streamedContent = "";
  let count = 0;
  for await (const chunk of stream) {
    count++;
    console.assert(chunk.id, `Stream chunk ${count} missing id`);
    console.assert(chunk.object === "chat.completion.chunk", `Stream chunk ${count} object type incorrect`);
    console.assert(chunk.choices[0].delta.content, `Stream chunk ${count} delta content missing`);
    streamedContent += chunk.choices[0].delta.content;
  }

  console.assert(streamedContent === "Mocked streamed response", "Full streamed content incorrect");

  // Verify _setConversationHistory call (indirectly)
  const streamCall = fetchCallArgs.find(call => call.type === 'promptStreaming');
  console.assert(streamCall, "session.promptStreaming was not called");
  console.assert(streamCall.input === 'Last user message for stream.', "session.promptStreaming called with wrong input");
  
  // Similar to non-streaming, check history state during the call
  let historyDuringStreamCall;
  session.promptStreaming = async function* (input, options) { // Override to capture
    historyDuringStreamCall = session._getConversationHistory();
    fetchCallArgs.push({ type: 'promptStreaming', input, options });
    yield "TestChunk";
  };
  const testStream = await session.chat(chatOptions); // Call again
  for await (const _ of testStream) {} // Consume stream

  const expectedHistory = messages.slice(0, -1);
   console.assert(JSON.stringify(historyDuringStreamCall) === JSON.stringify(expectedHistory), 
    `_setConversationHistory not called correctly for stream. Expected ${JSON.stringify(expectedHistory)}, got ${JSON.stringify(historyDuringStreamCall)}`);
});


// Run all tests
runTests();

// To execute this file: node __tests__/shared/Session.test.mjs
// Ensure shared/Session.mjs path is correct relative to this test file.
// And that Session.mjs can be imported in a Node environment (e.g. uses ES module syntax correctly).
// If Session.mjs uses browser-specific things not available in Node (like native Blob for image processing without polyfill),
// those parts might need specific mocks or adjustments when testing in Node.
// For now, _countTokensInMessages and chat() structure are the focus.
// The placeholder for image data ('placeholder_image_data') in _countTokensInMessages test is fine as it's just a string.
// The `Blob` and `ArrayBuffer` image handling in provider-specific classes will need more careful mocking if tested in Node.
// For `shared/Session.mjs` itself, string and text array content is sufficient.
