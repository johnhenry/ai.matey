export default (config = {}) =>
  async () => {
    const { endpoint } = config;
    const { apiKey } = config.credentials || {};
    try {
      // Always use the complete URL with http://localhost:11434 or custom endpoint
      // Make sure we're not using relative URLs
      const url = `${endpoint}/api/tags`;
      // Add optional configurations for dealing with CORS issues
      const fetchOptions = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey ? `Bearer ${apiKey}` : "",
        },
        // You may need to add mode: 'cors' or credentials: 'include'
        // depending on your server configuration
        // mode: 'cors',
        // credentials: 'include',
      };

      // Fetch models from the Ollama API using the absolute URL
      const response = await fetch(url, fetchOptions);

      // Check if the request was successful
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      // Parse the response
      const data = await response.json();

      // Extract model names
      // The API returns a list of model objects with 'name' property
      // which is in the format 'name:tag' (e.g., 'llama3:latest')
      const models = data.models.map((model) => model.name);

      // Return the list of models
      return models;
    } catch (error) {
      console.error("Error fetching Ollama models:", error);
      throw error;
    }
  };
