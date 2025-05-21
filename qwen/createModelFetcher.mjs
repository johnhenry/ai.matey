export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("Qwen API key is required");
    }

    // Fetch models from the Qwen API
    // Construct the full URL to the Qwen API models endpoint
    const url = `${endpoint}/v1/models`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // Check if the request was successful
    if (!response.ok) {
      // Try to parse the error response, but default to statusText if parsing fails or error format is unexpected
      let errorDetails = response.statusText;
      try {
        const error = await response.json();
        if (error && error.error && error.error.message) {
          errorDetails = error.error.message;
        } else if (error && error.message) { // Some APIs might return error directly in message
          errorDetails = error.message;
        }
      } catch (e) {
        // If parsing JSON fails, stick with response.statusText
        console.error("Failed to parse error response from Qwen API:", e);
      }
      throw new Error(`Qwen API error: ${errorDetails}`);
    }

    // Parse the response
    const data = await response.json();

    // Filter for chat models only
    // This filtering logic is an educated guess and might need adjustment
    // based on actual Qwen API model naming conventions.
    const chatModels = data.data
      .filter((model) => model.id.toLowerCase().includes("qwen") || model.id.toLowerCase().includes("chat"))
      .filter((model) => !model.id.toLowerCase().includes("instruct"))
      .filter((model) => !model.id.toLowerCase().includes("-vision")) // often vision models have this
      .filter((model) => !model.id.toLowerCase().includes("embedding"))
      .filter((model) => !model.id.toLowerCase().includes("search"))
      .map((model) => model.id);

    // Return the list of models
    return chatModels;
  } catch (error) {
    console.error("Error fetching Qwen models:", error.message); // Log only message to avoid verbose object logging
    throw error; // Re-throw the original error for further handling upstream
  }
};
