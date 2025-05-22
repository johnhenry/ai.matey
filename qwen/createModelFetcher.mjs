import createGenericModelFetcher from '../../shared/createGenericModelFetcher.mjs';

// Specific configuration for Qwen
const qwenOptions = {
  providerName: 'Qwen',
  modelsPath: '/v1/models',
  modelIdExtractor: (model) => model.id,
  responseDataPath: 'data', // Access models via response.data
  modelFilterPredicate: (modelId) => {
    const modelIdLower = modelId.toLowerCase();
    return (modelIdLower.includes('qwen') || modelIdLower.includes('chat')) &&
           !modelIdLower.includes('instruct') &&
           !modelIdLower.includes('vision') &&
           !modelIdLower.includes('embedding') &&
           !modelIdLower.includes('search');
  }
};

export default (providerConfig) => {
  // providerConfig will be passed from the assemble function, containing endpoint & credentials
  return createGenericModelFetcher(providerConfig, qwenOptions);
};
