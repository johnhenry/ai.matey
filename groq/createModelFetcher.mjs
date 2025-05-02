export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("Groq API key is required");
    }

    // Fetch models from the Groq API
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
      const error = await response.json();
      throw new Error(
        `Groq API error: ${error.error?.message || response.statusText}`
      );
    }

    // Parse the response
    const data = await response.json();

    // Extract model names from the Groq API response
    // The API typically returns a data object with a 'data' array of models
    const models = data.data.map((model) => model.id);

    // Return the list of models
    return models;
  } catch (error) {
    console.error("Error fetching Groq models:", error);
    // If API fails, return default models
    throw error;
  }
};
