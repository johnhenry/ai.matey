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

  // For Gemini, streaming response is a series of JSON objects, not SSE formatted text
  if (mockResponse.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const item of mockResponse.jsonArray) {
          // Gemini with alt=sse streams SSE events
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`)); 
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
      headers: new Headers({'Content-Type': 'application/json'}) // Or appropriate for Gemini stream
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

import GeminiSession from '../../gemini/Session.mjs'; 

// Mock AI interface for Session constructor
const mockAiConfig = {
  model: 'gemini-1.5-flash-latest', // or 'gemini-pro-vision' for multimodal
  endpoint: 'https://generativelanguage.googleapis.com', 
  credentials: { apiKey: 'test-api-key' }
};
const mockAiInterface = {
  config: mockAiConfig,
  languageModel: { _capabilities: { defaultTemperature: 0.7, maxTokens: 2048, defaultTopK: 3, defaultTopP: 0.9 } }
};

// Helper to create a simple Blob in Node.js
async function createTestBlob(content, type) {
  if (typeof Blob === 'undefined') {
    const { Blob } = await import('node:buffer');
    return new Blob([content], { type });
  }
  return new Blob([content], { type });
}


// --- Tests for Gemini Session ---

test('Gemini: promptStreaming - string input (text-only)', async () => {
  const session = new GeminiSession({ systemPrompt: "Be concise" }, mockAiInterface);
  session._addToHistory("Old question", "Old answer");

  queueMockResponse({
    stream: true,
    jsonArray: [ // Gemini streams an array of JSON objects
      { candidates: [{ content: { parts: [{ text: "Response " }] } }] },
      { candidates: [{ content: { parts: [{ text: "part 2" }] } }] }
    ]
  });

  const input = "New question";
  let responseText = "";
  for await (const chunk of session.promptStreaming(input, { temperature: 0.6, topK: 5 })) {
    responseText += chunk;
  }

  console.assert(responseText === "Response part 2", `Expected "Response part 2", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  console.assert(requestPayload.systemInstruction.parts[0].text === "Be concise", "System prompt mismatch");
  console.assert(requestPayload.contents.length === 3, `Expected 3 contents, got ${requestPayload.contents.length}`); // History (user, model) + current input
  console.assert(requestPayload.contents[0].role === "user", "History message 1 role mismatch");
  console.assert(requestPayload.contents[1].role === "model", "History message 2 role mismatch");
  console.assert(requestPayload.contents[2].role === "user", "Current message role mismatch");
  console.assert(requestPayload.contents[2].parts[0].text === "New question", "Current message content mismatch");
  
  console.assert(requestPayload.generationConfig.temperature === 0.6, "Temperature option mismatch");
  console.assert(requestPayload.generationConfig.topK === 5, "topK option mismatch");

  const history = session._getConversationHistory();
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(history[3].role === "assistant" && history[3].content === "Response part 2", "History not updated correctly");
});

test('Gemini: promptStreaming - array input (text-only, simulating chat last message)', async () => {
  const session = new GeminiSession({}, mockAiInterface);
   // History before the last user message (which will be the array input)
  session._setConversationHistory([
    { role: "user", content: "Initial query" },
    { role: "assistant", content: "Initial response" }
  ]);

  queueMockResponse({
    stream: true,
    jsonArray: [
      { candidates: [{ content: { parts: [{ text: "Array input " }] } }] },
      { candidates: [{ content: { parts: [{ text: "response." }] } }] }
    ]
  });

  const lastUserMessageContent = [ // This is LanguageModelMessageContent[]
    { type: 'text', value: 'This is the first part of the last user message.' },
    { type: 'text', value: 'This is the second part.' }
  ];

  let responseText = "";
  // `input` to promptStreaming is the LanguageModelMessageContent[] for the last user message
  for await (const chunk of session.promptStreaming(lastUserMessageContent, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Array input response.", `Expected "Array input response.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  // Expected contents: history (user, model) + current user message (built from lastUserMessageContent)
  console.assert(requestPayload.contents.length === 3, `Expected 3 contents, got ${requestPayload.contents.length}`);
  const lastApiMessage = requestPayload.contents[2];
  console.assert(lastApiMessage.role === "user", "Last message role mismatch");
  console.assert(lastApiMessage.parts.length === 2, "Last message parts count mismatch");
  console.assert(lastApiMessage.parts[0].text === "This is the first part of the last user message.", "Last message part 1 text mismatch");
  console.assert(lastApiMessage.parts[1].text === "This is the second part.", "Last message part 2 text mismatch");
  
  const history = session._getConversationHistory();
  // Expected history: old_history + last_user_message (as array of LanguageModelMessageContent) + assistant_response
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(JSON.stringify(history[2].content) === JSON.stringify(lastUserMessageContent), "User message in history mismatch");
  console.assert(history[3].content === "Array input response.", "Assistant response in history mismatch");
});


test('Gemini: promptStreaming - multimodal input (text + image Blob)', async () => {
  // Ensure model in config supports vision, e.g. by setting it if default is non-vision
  const visionMockAiInterface = { ...mockAiInterface, config: {...mockAiConfig, model: 'gemini-pro-vision'} };
  const session = new GeminiSession({}, visionMockAiInterface);
  const imageBlob = await createTestBlob(["dummy image data"], "image/png");
  
  const input = [ // LanguageModelMessageContent[]
    { type: 'text', value: 'Describe this image:' },
    { type: 'image', value: imageBlob, mimeType: 'image/png' }
  ];

  queueMockResponse({
    stream: true,
    jsonArray: [
      { candidates: [{ content: { parts: [{ text: "It is a PNG image." }] } }] }
    ]
  });

  let responseText = "";
  for await (const chunk of session.promptStreaming(input, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "It is a PNG image.", `Expected "It is a PNG image.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const userMessageParts = requestPayload.contents[0].parts; // Assuming no prior history for simplicity here
  console.assert(userMessageParts.length === 2, "Expected 2 parts in user message content");
  console.assert(userMessageParts[0].text === "Describe this image:", "Text part mismatch");
  console.assert(userMessageParts[1].inlineData, "Image part should have inlineData");
  console.assert(userMessageParts[1].inlineData.mimeType === "image/png", "Image mimeType mismatch");
  console.assert(userMessageParts[1].inlineData.data.length > 0, "Image data missing");

  const history = session._getConversationHistory();
  console.assert(history.length === 2, "History length mismatch");
  console.assert(JSON.stringify(history[0].content) === JSON.stringify(input), "Multimodal user input not stored correctly in history");
});

test('Gemini: promptStreaming - multimodal input (text + base64 image string)', async () => {
  const visionMockAiInterface = { ...mockAiInterface, config: {...mockAiConfig, model: 'gemini-pro-vision'} };
  const session = new GeminiSession({}, visionMockAiInterface);
  const base64ImageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  const input = [ // LanguageModelMessageContent[]
    { type: 'text', value: 'Analyze base64:' },
    { type: 'image', value: base64ImageData, mimeType: 'image/png' }
  ];

  queueMockResponse({
    stream: true,
    jsonArray: [
        { candidates: [{ content: { parts: [{ text: "Analyzed base64 image." }] } }] }
    ]
  });

  let responseText = "";
  for await (const chunk of session.promptStreaming(input, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Analyzed base64 image.", `Expected "Analyzed base64 image.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const userMessageParts = requestPayload.contents[0].parts;
  console.assert(userMessageParts[1].inlineData.mimeType === "image/png", "Image mimeType mismatch for base64");
  console.assert(userMessageParts[1].inlineData.data === base64ImageData, "Image base64 data mismatch");
});


test('Gemini: promptStreaming - API error handling', async () => {
  const session = new GeminiSession({}, mockAiInterface);
  queueMockResponse({
    error: { error: { code: 400, message: 'Invalid request', status: 'INVALID_ARGUMENT' } }, // Gemini error structure
    status: 400
  });

  let errorThrown = false;
  try {
    for await (const chunk of session.promptStreaming("test error", {})) {
      // Should not yield
    }
  } catch (e) {
    errorThrown = true;
    console.assert(e.message.includes("Gemini API Error") && (e.message.includes("Invalid request") || e.message.includes("400")), `Error message mismatch: ${e.message}`);
  }
  console.assert(errorThrown, "API error did not throw an exception");
});

test('Gemini: promptStreaming - options passthrough (maxOutputTokens, topP, topK)', async () => {
    const session = new GeminiSession({}, mockAiInterface);
    queueMockResponse({
        stream: true,
        jsonArray: [{ candidates: [{ content: { parts: [{ text: "Test" }] } }] }]
    });

    // Consume one item to trigger fetch
    await session.promptStreaming("Test options", { temperature: 0.8, maxTokens: 200, topP: 0.85, topK: 7 }).next(); 

    const requestPayload = fetchCallArgs[0].options;
    const genConfig = requestPayload.generationConfig;
    console.assert(genConfig.temperature === 0.8, "Temperature not passed through");
    console.assert(genConfig.maxOutputTokens === 200, "maxOutputTokens (from maxTokens) not passed through");
    console.assert(genConfig.topP === 0.85, "topP not passed through");
    console.assert(genConfig.topK === 7, "topK not passed through");
});

// Run all tests when the file is executed
runAllTests();
// To run: node __tests__/gemini/Session.test.mjs
// Ensure Blob polyfill or Node version for Blob is available.
