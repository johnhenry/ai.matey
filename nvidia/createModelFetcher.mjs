export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("NVIDIA API key is required");
    }

    // Fetch models from the NVIDIA API
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
        `NVIDIA API error: ${error.error?.message || response.statusText}`
      );
    }

    // Parse the response
    const { data } = await response.json();
    // Extract model names from the NVIDIA API response
    // The actual structure may vary based on NVIDIA's API
    const models = Array.isArray(data)
      ? data.map((model) => model.id || model.name)
      : (data.models || []).map((model) => model.id || model.name);

    // Return the list of models
    return models;
  } catch (error) {
    console.error("Error fetching NVIDIA models:", error);
    // If API fails, return default models
    return [];
  }
};
