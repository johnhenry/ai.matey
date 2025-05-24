// Simple Test Runner and Mocking Setup (similar to shared/Session.test.mjs)
const tests = [];
let originalFetch;
let mockFetchResponses = [];
let fetchCallArgs = []; // To store arguments of fetch calls

async function mockFetch(url, options) {
  fetchCallArgs.push({ url, options: JSON.parse(options.body) }); // Store parsed body
  if (mockFetchResponses.length === 0) {
    throw new Error('Mock fetch called but no response was queued.');
  }
  const mockResponse = mockFetchResponses.shift();
  if (mockResponse.error) {
    return Promise.resolve({
      ok: false,
      status: mockResponse.status || 500,
      statusText: mockResponse.statusText || 'Internal Server Error',
      text: () => Promise.resolve(typeof mockResponse.error === 'string' ? mockResponse.error : JSON.stringify(mockResponse.error)),
      json: () => Promise.resolve(mockResponse.error),
    });
  }

  if (mockResponse.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockResponse.chunks) {
          controller.enqueue(encoder.encode(chunk)); // OpenAI streams SSE
          await new Promise(resolve => setTimeout(resolve, 10)); 
        }
        controller.close();
      }
    });
    return Promise.resolve({
      ok: true,
      status: mockResponse.status || 200,
      statusText: mockResponse.statusText || 'OK',
      body: stream,
      headers: new Headers({'Content-Type': 'text/event-stream'})
    });
  }

  return Promise.resolve({
    ok: true,
    status: mockResponse.status || 200,
    statusText: mockResponse.statusText || 'OK',
    json: () => Promise.resolve(mockResponse.json),
    text: () => Promise.resolve(JSON.stringify(mockResponse.json)),
  });
}

function setupGlobalFetchMock() {
  originalFetch = global.fetch;
  global.fetch = mockFetch;
}

function teardownGlobalFetchMock() {
  global.fetch = originalFetch;
}

function queueMockResponse(response) {
  mockFetchResponses.push(response);
}

function clearFetchCallLog() {
  fetchCallArgs = [];
  mockFetchResponses = [];
}

function test(description, fn) {
  tests.push({ description, fn });
}

async function runAllTests() {
  setupGlobalFetchMock();
  for (const t of tests) {
    clearFetchCallLog(); 
    try {
      await t.fn();
      console.log(`✅ PASS: ${t.description}`);
    } catch (e) {
      console.error(`❌ FAIL: ${t.description}`);
      console.error(e.stack); 
    }
  }
  teardownGlobalFetchMock();
}

// --- End of Simple Test Runner ---

import OpenAISession from '../../openai/Session.mjs'; 

// Mock AI interface for Session constructor
const mockAiConfig = {
  model: 'gpt-4-turbo', 
  endpoint: 'https://api.openai.com', 
  credentials: { apiKey: 'test-api-key' }
};
const mockAiInterface = {
  config: mockAiConfig,
  languageModel: { _capabilities: { defaultTemperature: 0.7, maxTokens: 4096 } }
};

// Helper to create a simple Blob in Node.js
async function createTestBlob(content, type) {
  if (typeof Blob === 'undefined') {
    const { Blob } = await import('node:buffer');
    return new Blob([content], { type });
  }
  return new Blob([content], { type });
}


// --- Tests for OpenAI Session ---

test('OpenAI: promptStreaming - string input (text-only)', async () => {
  const session = new OpenAISession({ systemPrompt: "Be witty" }, mockAiInterface);
  session._addToHistory("Old user joke", "Old AI punchline");

  queueMockResponse({
    stream: true,
    chunks: [
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4-turbo","choices":[{"index":0,"delta":{"content":"Why "},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4-turbo","choices":[{"index":0,"delta":{"content":"did "},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4-turbo","choices":[{"index":0,"delta":{"content":"the chicken..."},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ]
  });

  const input = "Tell me a joke.";
  let responseText = "";
  for await (const chunk of session.promptStreaming(input, { temperature: 0.8, maxTokens: 50 })) {
    responseText += chunk;
  }

  console.assert(responseText === "Why did the chicken...", `Expected "Why did the chicken...", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  console.assert(requestPayload.messages[0].role === "system" && requestPayload.messages[0].content === "Be witty", "System prompt mismatch");
  console.assert(requestPayload.messages.length === 4, `Expected 4 messages, got ${requestPayload.messages.length}`); // system + history (user, assistant) + current input
  console.assert(requestPayload.messages[1].role === "user", "History message 1 role mismatch");
  console.assert(requestPayload.messages[2].role === "assistant", "History message 2 role mismatch");
  console.assert(requestPayload.messages[3].role === "user", "Current message role mismatch");
  console.assert(requestPayload.messages[3].content === "Tell me a joke.", "Current message content mismatch");
  
  console.assert(requestPayload.temperature === 0.8, "Temperature option mismatch");
  console.assert(requestPayload.max_tokens === 50, "max_tokens option mismatch");

  const history = session._getConversationHistory();
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(history[3].role === "assistant" && history[3].content === "Why did the chicken...", "History not updated correctly");
});


test('OpenAI: promptStreaming - array input (text-only, simulating chat last message)', async () => {
  const session = new OpenAISession({}, mockAiInterface);
  session._setConversationHistory([
    { role: "user", content: "First question" },
    { role: "assistant", content: "First answer" }
  ]);

  queueMockResponse({
    stream: true,
    chunks: [
      'data: {"choices":[{"delta":{"content":"Response "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"to array."}}]}\n\n',
      'data: [DONE]\n\n'
    ]
  });

  const lastUserMessageContent = [ // This is LanguageModelMessageContent[]
    { type: 'text', value: 'This is a follow-up.' },
    { type: 'text', value: 'Split into two parts.' }
  ];

  let responseText = "";
  for await (const chunk of session.promptStreaming(lastUserMessageContent, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Response to array.", `Expected "Response to array.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  // Expected messages: history (user, assistant) + current user message (built from lastUserMessageContent)
  console.assert(requestPayload.messages.length === 3, `Expected 3 messages, got ${requestPayload.messages.length}`);
  const lastApiMessage = requestPayload.messages[2];
  console.assert(lastApiMessage.role === "user", "Last message role mismatch");
  console.assert(Array.isArray(lastApiMessage.content) && lastApiMessage.content.length === 2, "Last message content should be an array of 2 parts");
  console.assert(lastApiMessage.content[0].type === "text" && lastApiMessage.content[0].text === "This is a follow-up.", "Last message part 1 text mismatch");
  console.assert(lastApiMessage.content[1].type === "text" && lastApiMessage.content[1].text === "Split into two parts.", "Last message part 2 text mismatch");
  
  const history = session._getConversationHistory();
  // Expected history: old_history + last_user_message (as original LanguageModelMessage array) + assistant_response
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  // The history should store the input in its original LanguageModelMessage format.
  // The `input` to promptStreaming was LanguageModelMessageContent[], which then gets wrapped into a LanguageModelMessage by chat() or by the test setup.
  // Here, `lastUserMessageContent` *is* the content for the last user message.
  console.assert(JSON.stringify(history[2].content) === JSON.stringify(lastUserMessageContent), "User message content in history mismatch");
  console.assert(history[3].content === "Response to array.", "Assistant response in history mismatch");
});


test('OpenAI: promptStreaming - multimodal input (text + image Blob)', async () => {
  const session = new OpenAISession({}, { ...mockAiInterface, config: { ...mockAiConfig, model: 'gpt-4-vision-preview' }});
  const imageBlob = await createTestBlob(["dummy image data"], "image/png");
  
  const input = [ // LanguageModelMessageContent[]
    { type: 'text', value: 'What is in this Blob image?' },
    { type: 'image', value: imageBlob, mimeType: 'image/png' }
  ];

  queueMockResponse({
    stream: true,
    chunks: [
      'data: {"choices":[{"delta":{"content":"It looks "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"like a Blob."}}]}\n\n',
      'data: [DONE]\n\n'
    ]
  });

  let responseText = "";
  for await (const chunk of session.promptStreaming(input, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "It looks like a Blob.", `Expected "It looks like a Blob.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const userMessageContent = requestPayload.messages[0].content; // Assuming no history for simplicity here
  console.assert(Array.isArray(userMessageContent) && userMessageContent.length === 2, "Expected 2 parts in user message content");
  console.assert(userMessageContent[0].type === "text" && userMessageContent[0].text === "What is in this Blob image?", "Text part mismatch");
  console.assert(userMessageContent[1].type === "image_url", "Image part type mismatch");
  console.assert(userMessageContent[1].image_url.url.startsWith("data:image/png;base64,"), "Image URL should be a data URI for PNG");

  const history = session._getConversationHistory();
  console.assert(history.length === 2, "History length mismatch");
  console.assert(JSON.stringify(history[0].content) === JSON.stringify(input), "Multimodal user input not stored correctly in history");
});

test('OpenAI: promptStreaming - multimodal input (text + base64 image string)', async () => {
  const session = new OpenAISession({}, { ...mockAiInterface, config: { ...mockAiConfig, model: 'gpt-4-vision-preview' }});
  const base64ImageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  const input = [ // LanguageModelMessageContent[]
    { type: 'text', value: 'Image analysis (base64):' },
    { type: 'image', value: base64ImageData, mimeType: 'image/png' }
  ];

  queueMockResponse({
    stream: true,
    chunks: [
        'data: {"choices":[{"delta":{"content":"Tiny "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"black dot."}}]}\n\n',
        'data: [DONE]\n\n'
    ]
  });

  let responseText = "";
  for await (const chunk of session.promptStreaming(input, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Tiny black dot.", `Expected "Tiny black dot.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const userMessageContent = requestPayload.messages[0].content;
  console.assert(userMessageContent[1].type === "image_url", "Image part type mismatch");
  console.assert(userMessageContent[1].image_url.url === `data:image/png;base64,${base64ImageData}`, "Image data URI mismatch for base64");
});


test('OpenAI: promptStreaming - API error handling', async () => {
  const session = new OpenAISession({}, mockAiInterface);
  queueMockResponse({
    error: { error: { message: 'Insufficient quota.', type: 'insufficient_quota', code: 'insufficient_quota' } }, // OpenAI error structure
    status: 429
  });

  let errorThrown = false;
  try {
    for await (const chunk of session.promptStreaming("test quota error", {})) {
      // Should not yield
    }
  } catch (e) {
    errorThrown = true;
    console.assert(e.message.includes("HTTP error! status: 429") && e.message.includes("Insufficient quota"), `Error message mismatch: ${e.message}`);
  }
  console.assert(errorThrown, "API error did not throw an exception");
});


test('OpenAI: promptStreaming - options passthrough (max_tokens, temperature)', async () => {
    const session = new OpenAISession({}, mockAiInterface);
    queueMockResponse({
        stream: true,
        chunks: [
            'data: {"choices":[{"delta":{"content":"Testing "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"options."}}]}\n\n',
            'data: [DONE]\n\n'
        ]
    });

    // Consume one item to trigger fetch
    await session.promptStreaming("Test options passthrough", { temperature: 0.1, maxTokens: 77 }).next(); 

    const requestPayload = fetchCallArgs[0].options;
    console.assert(requestPayload.temperature === 0.1, "Temperature not passed through");
    console.assert(requestPayload.max_tokens === 77, "max_tokens (from maxTokens) not passed through");
});

// Run all tests when the file is executed
runAllTests();
// To run: node __tests__/openai/Session.test.mjs
// Ensure Blob polyfill or Node version for Blob is available.
