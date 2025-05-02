export default (config) => async () => {
  const { endpoint } = config;
  const { apiKey } = config.credentials || {};
  try {
    // Validate API key
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    // Fetch models from the OpenAI API
    // Construct the full URL to the OpenAI API models endpoint
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
        `OpenAI API error: ${error.error?.message || response.statusText}`
      );
    }

    // Parse the response
    const data = await response.json();

    // Filter for chat models only (gpt models that support chat)
    // The API returns a data array with model objects containing 'id' property
    const chatModels = data.data
      .filter((model) => model.id.includes("gpt"))
      .filter((model) => !model.id.includes("instruct"))
      .filter((model) => !model.id.includes("-vision-"))
      .filter((model) => !model.id.includes("embedding"))
      .filter((model) => !model.id.includes("search"))
      .map((model) => model.id);

    // Return the list of models
    return chatModels;
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
    throw error;
  }
};
