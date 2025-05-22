export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {}; // Safely access apiKey

  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("Qwen API key is required");
    }

    // Construct the models URL
    const url = `${endpoint}/v1/models`;

    // Make a GET request with headers
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // Handle unsuccessful request
    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
        const error = await response.json();
        if (error && error.error && error.error.message) {
          errorDetails = error.error.message;
        } else if (error && error.message) { 
          errorDetails = error.message;
        }
      } catch (e) {
        // If parsing JSON fails, stick with response.statusText
        console.error("Failed to parse error response from Qwen API:", e);
      }
      throw new Error(`Qwen API error: ${errorDetails}`);
    }

    // Parse successful JSON response
    const data = await response.json();

    // Filter and map models
    // Ensure data.data exists and is an array before trying to filter/map
    if (!data || !Array.isArray(data.data)) {
        console.warn("Qwen API response format unexpected: 'data' array not found or not an array.", data);
        return []; // Return empty if format is not as expected
    }
    
    const chatModels = data.data
      .filter((model) => {
        if (!model || typeof model.id !== 'string') return false;
        const modelIdLower = model.id.toLowerCase();
        return (modelIdLower.includes("qwen") || modelIdLower.includes("chat")) &&
               !modelIdLower.includes("instruct") &&
               !modelIdLower.includes("vision") && 
               !modelIdLower.includes("embedding") &&
               !modelIdLower.includes("search");
      })
      .map((model) => model.id);

    return chatModels;
  } catch (error) {
    // Log and re-throw error
    console.error("Error fetching Qwen models:", error.message); // Log only message
    throw error; // Re-throw the original error
  }
};
