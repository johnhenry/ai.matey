// Simple Test Runner and Mocking Setup (similar to shared/Session.test.mjs)
const tests = [];
let originalFetch;
let mockFetchResponses = [];
let fetchCallArgs = []; 
let consoleWarnArgs = []; // To store arguments of console.warn calls
let originalConsoleWarn;


async function mockFetch(url, options) {
  fetchCallArgs.push({ url, options: JSON.parse(options.body) }); 
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
          controller.enqueue(encoder.encode(chunk)); // HuggingFace (OpenAI compatible) streams SSE
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

function setupGlobalMocks() {
  originalFetch = global.fetch;
  global.fetch = mockFetch;
  originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    consoleWarnArgs.push(args);
  };
}

function teardownGlobalMocks() {
  global.fetch = originalFetch;
  console.warn = originalConsoleWarn;
}

function queueMockResponse(response) {
  mockFetchResponses.push(response);
}

function clearMockCallLogs() {
  fetchCallArgs = [];
  mockFetchResponses = [];
  consoleWarnArgs = [];
}

function test(description, fn) {
  tests.push({ description, fn });
}

async function runAllTests() {
  setupGlobalMocks();
  for (const t of tests) {
    clearMockCallLogs(); 
    try {
      await t.fn();
      console.log(`✅ PASS: ${t.description}`);
    } catch (e) {
      console.error(`❌ FAIL: ${t.description}`);
      console.error(e.stack); 
    }
  }
  teardownGlobalMocks();
}

// --- End of Simple Test Runner ---

import HuggingFaceSession from '../../huggingface/Session.mjs'; 

// Mock AI interface for Session constructor
const mockAiConfig = {
  model: 'mistralai/Mistral-7B-Instruct-v0.1', // Example model
  endpoint: 'https://api-inference.huggingface.co', 
  credentials: { apiKey: 'hf_test-api-key' }
};
const mockAiInterface = {
  config: mockAiConfig,
  languageModel: { _capabilities: { defaultTemperature: 0.7, defaultTopK: 50, maxTokens: 1024 } }
};

// Helper to create a simple Blob in Node.js
async function createTestBlob(content, type) {
  if (typeof Blob === 'undefined') {
    const { Blob } = await import('node:buffer');
    return new Blob([content], { type });
  }
  return new Blob([content], { type });
}


// --- Tests for HuggingFace Session ---

test('HuggingFace: promptStreaming - string input (text-only)', async () => {
  const session = new HuggingFaceSession({ systemPrompt: "Be direct." }, mockAiInterface);
  session._addToHistory("Previous question", "Previous direct answer");

  queueMockResponse({
    stream: true,
    chunks: [ // Standard OpenAI SSE format, as HF uses TGI which is OpenAI compatible for chat
      'data: {"id":"cmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"current-model","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
      'data: {"id":"cmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"current-model","choices":[{"index":0,"delta":{"content":"Direct "},"finish_reason":null}]}\n\n',
      'data: {"id":"cmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"current-model","choices":[{"index":0,"delta":{"content":"response."},"finish_reason":null}]}\n\n',
      'data: {"id":"cmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"current-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ]
  });

  const input = "A new query.";
  let responseText = "";
  for await (const chunk of session.promptStreaming(input, { temperature: 0.2, maxTokens: 30 })) {
    responseText += chunk;
  }

  console.assert(responseText === "Direct response.", `Expected "Direct response.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  console.assert(requestPayload.messages[0].role === "system" && requestPayload.messages[0].content === "Be direct.", "System prompt mismatch");
  console.assert(requestPayload.messages.length === 4, `Expected 4 messages, got ${requestPayload.messages.length}`);
  console.assert(requestPayload.messages[3].role === "user" && requestPayload.messages[3].content === "A new query.", "Current message content mismatch");
  
  console.assert(requestPayload.temperature === 0.2, "Temperature option mismatch");
  console.assert(requestPayload.max_tokens === 30, "max_tokens option mismatch");

  const history = session._getConversationHistory();
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(history[3].role === "assistant" && history[3].content === "Direct response.", "History not updated correctly");
});


test('HuggingFace: promptStreaming - array input (text parts only, simulating chat last message)', async () => {
  const session = new HuggingFaceSession({}, mockAiInterface);
  session._setConversationHistory([
    { role: "user", content: "Contextual question" },
    { role: "assistant", content: "Contextual answer" }
  ]);

  queueMockResponse({
    stream: true,
    chunks: [
      'data: {"choices":[{"delta":{"content":"Array "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"processed."}}]}\n\n',
      'data: [DONE]\n\n'
    ]
  });

  const lastUserMessageContent = [ // LanguageModelMessageContent[]
    { type: 'text', value: 'First part of array input.' },
    { type: 'text', value: 'Second part of array input.' }
  ];

  let responseText = "";
  for await (const chunk of session.promptStreaming(lastUserMessageContent, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Array processed.", `Expected "Array processed.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  console.assert(requestPayload.messages.length === 3, `Expected 3 messages, got ${requestPayload.messages.length}`);
  const lastApiMessage = requestPayload.messages[2];
  console.assert(lastApiMessage.role === "user", "Last message role mismatch");
  // HuggingFace Session currently concatenates text parts for array input
  console.assert(typeof lastApiMessage.content === 'string', "Last message content should be a string for HF");
  console.assert(lastApiMessage.content === "First part of array input.\nSecond part of array input.", "Last message content mismatch");
  
  const history = session._getConversationHistory();
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(JSON.stringify(history[2].content) === JSON.stringify(lastUserMessageContent), "User message in history mismatch - should be original array");
  console.assert(history[3].content === "Array processed.", "Assistant response in history mismatch");
});

test('HuggingFace: promptStreaming - array input (mixed text/image, image discarded)', async () => {
  const session = new HuggingFaceSession({}, mockAiInterface);
  const imageBlob = await createTestBlob(["dummy image data"], "image/png");

  queueMockResponse({
    stream: true,
    chunks: [
      'data: {"choices":[{"delta":{"content":"Understood: "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Text part."}}]}\n\n',
      'data: [DONE]\n\n'
    ]
  });

  const mixedInput = [ // LanguageModelMessageContent[]
    { type: 'text', value: 'Text part.' },
    { type: 'image', value: imageBlob } // This should be discarded
  ];

  let responseText = "";
  for await (const chunk of session.promptStreaming(mixedInput, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Understood: Text part.", `Expected "Understood: Text part.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const lastApiMessage = requestPayload.messages[0]; // Assuming no prior history for this test
  console.assert(lastApiMessage.content === "Text part.", "Image part not discarded correctly");

  console.assert(consoleWarnArgs.length > 0, "console.warn was not called for discarded image");
  console.assert(consoleWarnArgs[0][0].includes("Non-text part of type 'image' found and will be discarded"), "Warning message mismatch");

  const history = session._getConversationHistory();
  console.assert(history.length === 2, "History length mismatch");
  // History should store the original mixedInput
  console.assert(JSON.stringify(history[0].content) === JSON.stringify(mixedInput), "Original mixed input not stored correctly in history");
});


test('HuggingFace: promptStreaming - API error handling', async () => {
  const session = new HuggingFaceSession({}, mockAiInterface);
  queueMockResponse({
    error: { error: "Model is overloaded", error_type: " सेवा त्रुटि" }, // Example HF error
    status: 503 
  });

  let errorThrown = false;
  try {
    for await (const chunk of session.promptStreaming("test api error", {})) { /* consume */ }
  } catch (e) {
    errorThrown = true;
    console.assert(e.message.includes("HTTP error! status: 503") && e.message.includes("Model is overloaded"), `Error message mismatch: ${e.message}`);
  }
  console.assert(errorThrown, "API error did not throw an exception");
});

test('HuggingFace: promptStreaming - options passthrough (max_tokens, temperature, top_k)', async () => {
    const session = new HuggingFaceSession({}, mockAiInterface);
    queueMockResponse({
        stream: true,
        chunks: ['data: {"choices":[{"delta":{"content":"Options "}}]}\n\n', 'data: [DONE]\n\n']
    });

    await session.promptStreaming("Test HF options", { temperature: 0.11, maxTokens: 99, topK: 11 }).next(); 

    const requestPayload = fetchCallArgs[0].options;
    console.assert(requestPayload.temperature === 0.11, "Temperature not passed through");
    console.assert(requestPayload.max_tokens === 99, "max_tokens (from maxTokens) not passed through");
    console.assert(requestPayload.top_k === 11, "top_k (from topK) not passed through");
});

// Run all tests when the file is executed
runAllTests();
// To run: node __tests__/huggingface/Session.test.mjs
// Ensure Blob polyfill or Node version for Blob is available.
