const ENDPOINT = "https://huggingface.co/api";

export default (config) => async () => {
  const endpoint = ENDPOINT;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key if required
    if (!apiKey) {
      throw new Error("Hugging Face API key is required");
    }
    // For Hugging Face, we might need to query available models
    // This endpoint may vary based on HF's API structure
    const url = `${endpoint}/models?filter=text-generation`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : "",
        "Content-Type": "application/json",
      },
    });

    // Check if the request was successful
    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Hugging Face API error: ${error.error?.message || response.statusText}`
      );
    }

    // Parse the response
    const data = await response.json();

    // Extract model names
    // Note: The actual structure of the response may need adjustment
    // based on Hugging Face's API
    const models = data.map((model) => model.id || model.name);

    // Return the list of models
    return models;
  } catch (error) {
    console.error("Error fetching Hugging Face models:", error);
    // If API fails, return some default models that we know are available
    return [];
  }
};
