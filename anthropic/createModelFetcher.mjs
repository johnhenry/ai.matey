export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }

    // Fetch models from the Anthropic API
    // Construct the full URL to the Anthropic API models endpoint
    const url = `${endpoint}/v1/models`;
    console.log(`Fetching Anthropic models from absolute URL: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    });

    // Check if the request was successful
    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Anthropic API error: ${error.error?.message || response.statusText}`
      );
    }

    // Parse the response
    const data = await response.json();

    // Extract model names from the API response
    // The API returns a data object with a 'models' array, each model having an 'id' property
    const models = data.data.map((model) => model.id);

    // Return the list of models
    return models;
  } catch (error) {
    console.error("Error fetching Anthropic models:", error);
    throw error;
  }
};
