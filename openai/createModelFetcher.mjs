import createGenericModelFetcher from "../shared/createGenericModelFetcher.mjs";

// Specific configuration for OpenAI
const openAIOptions = {
  providerName: "OpenAI",
  modelsPath: "/v1/models",
  modelIdExtractor: (model) => model.id,
  responseDataPath: "data", // Access models via response.data
  modelFilterPredicate: (modelId) =>
    modelId.includes("gpt") &&
    !modelId.includes("instruct") &&
    !modelId.includes("-vision-") &&
    !modelId.includes("embedding") &&
    !modelId.includes("search"),
};

export default (providerConfig) => {
  // providerConfig will be passed from the assemble function, containing endpoint & credentials
  return createGenericModelFetcher(providerConfig, openAIOptions);
};
