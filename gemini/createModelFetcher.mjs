export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("Google API key is required for Gemini");
    }

    // For Gemini models, we'll fetch from Google AI API
    const url = `${endpoint}/v1/models`;

    const response = await fetch(`${url}?key=${apiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Check if the request was successful
    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Gemini API error: ${error.error?.message || response.statusText}`
      );
    }

    // Parse the response
    const data = await response.json();

    // Filter for Gemini models only
    // The API returns a models array with objects containing 'name' property
    const models = data.models
      .filter((model) => model.name.includes("gemini"))
      .map((model) => model.name.split("/").pop());

    // Return the list of models
    return models;
  } catch (error) {
    console.error("Error fetching Gemini models:", error);
    // If API fails, return some default models
    throw error;
  }
};
