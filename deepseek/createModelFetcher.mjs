export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {}; // Safely access apiKey

  try {
    // 1. Validate API key
    if (!apiKey) {
      throw new Error("DeepSeek API key is required");
    }

    // 2. Construct the models URL
    const url = `${endpoint}/v1/models`;

    // 3. & 4. Make a GET request with headers
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 5. Handle unsuccessful request
    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
        const error = await response.json();
        // Use the error structure if available, otherwise default to statusText
        if (error && error.error && error.error.message) {
          errorDetails = error.error.message;
        } else if (error && error.message) { 
          errorDetails = error.message;
        }
      } catch (e) {
        // If parsing JSON fails, stick with response.statusText
        console.error("Failed to parse error response from DeepSeek API:", e);
      }
      throw new Error(`DeepSeek API error: ${errorDetails}`);
    }

    // 6. Parse successful JSON response
    const data = await response.json();

    // 7. & 8. Filter and map models
    // Assuming the response structure has a 'data' array of model objects
    if (!data || !Array.isArray(data.data)) {
        console.warn("DeepSeek API response format unexpected: 'data' array not found or not an array.", data);
        return []; // Return empty if format is not as expected
    }
    
    const chatModels = data.data
      .filter((model) => model.id && model.id.toLowerCase().includes("chat")) // Include models with "chat"
      .filter((model) => model.id && !model.id.toLowerCase().includes("instruct"))
      .filter((model) => model.id && !model.id.toLowerCase().includes("vision"))
      .filter((model) => model.id && !model.id.toLowerCase().includes("embedding"))
      .filter((model) => model.id && !model.id.toLowerCase().includes("search"))
      .map((model) => model.id);

    return chatModels;
  } catch (error) {
    // 9. Log and re-throw error
    console.error("Error fetching DeepSeek models:", error.message);
    throw error; // Re-throw the original error
  }
};
