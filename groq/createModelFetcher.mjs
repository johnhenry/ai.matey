import createGenericModelFetcher from "../shared/createGenericModelFetcher.mjs";

// Specific configuration for Groq
const groqOptions = {
  providerName: "Groq",
  modelsPath: "/v1/models",
  modelIdExtractor: (model) => model.id,
  responseDataPath: "data", // Access models via response.data
  // No specific modelFilterPredicate needed if Groq returns only usable models
  // or if we want to list all of them. The default predicate is `() => true`.
};

export default (providerConfig) => {
  // providerConfig will be passed from the assemble function, containing endpoint & credentials
  return createGenericModelFetcher(providerConfig, groqOptions);
};
