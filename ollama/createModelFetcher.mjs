import createGenericModelFetcher from "../shared/createGenericModelFetcher.mjs";

// Specific configuration for Ollama
const ollamaOptions = {
  providerName: "Ollama",
  modelsPath: "/api/tags", // Different path
  modelIdExtractor: (model) => model.name, // Extracts 'name'
  responseDataPath: "models", // Access models via response.models
  apiKeyOptional: true, // API key is not strictly required for local Ollama
  // No specific modelFilterPredicate needed if we want to list all models.
  // The generic fetcher also doesn't add Authorization header if apiKey is not present.
};

export default (providerConfig) => {
  // providerConfig will be passed from the assemble function, containing endpoint & credentials
  return createGenericModelFetcher(providerConfig, ollamaOptions);
};
