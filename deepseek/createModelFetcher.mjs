import createGenericModelFetcher from "../shared/createGenericModelFetcher.mjs";

// Specific configuration for DeepSeek
const deepSeekOptions = {
  providerName: "DeepSeek",
  modelsPath: "/v1/models",
  modelIdExtractor: (model) => model.id,
  responseDataPath: "data", // Access models via response.data
  modelFilterPredicate: (modelId) => {
    const modelIdLower = modelId.toLowerCase();
    return (
      (modelIdLower.includes("deepseek") || modelIdLower.includes("chat")) &&
      !modelIdLower.includes("instruct") &&
      !modelIdLower.includes("coder") &&
      !modelIdLower.includes("vision") &&
      !modelIdLower.includes("embedding") &&
      !modelIdLower.includes("search")
    );
  },
};

export default (providerConfig) => {
  // providerConfig will be passed from the assemble function, containing endpoint & credentials
  return createGenericModelFetcher(providerConfig, deepSeekOptions);
};
