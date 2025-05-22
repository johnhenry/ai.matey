export default (providerConfig, options) => async () => {
  // 1. Destructure providerConfig
  const { endpoint, credentials } = providerConfig;

  // 2. Destructure options with defaults
  const {
    providerName = 'API', // Default provider name for errors
    modelsPath, // e.g., "/v1/models"
    authHeaderName = 'Authorization',
    authHeaderValuePrefix = 'Bearer ',
    additionalHeaders = {},
    apiKeyInQuery = false, // false, true (uses 'key'), or string (custom query param name)
    modelIdExtractor, // function e.g., (m) => m.id
    responseDataPath, // string e.g., "data" for response.data.data or null/empty for root
    modelFilterPredicate = () => true, // Default to no filter (accepts all)
    apiKeyOptional = false
  } = options;

  // 3. Get apiKey
  const { apiKey } = credentials || {};

  try {
    // 4. API Key Validation
    if (!apiKeyOptional && !apiKey) {
      throw new Error(`${providerName} API key is required`);
    }

    // 5. URL Construction
    let url = `${endpoint}${modelsPath}`;
    if (apiKeyInQuery && apiKey) {
      const queryParamName = apiKeyInQuery === true ? 'key' : apiKeyInQuery;
      url += `?${queryParamName}=${apiKey}`;
    }

    // 6. Headers Construction
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };
    if (apiKey && !apiKeyInQuery) {
      headers[authHeaderName] = `${authHeaderValuePrefix}${apiKey}`;
    }

    // 7. Fetch Call
    const response = await fetch(url, { method: 'GET', headers });

    // 8. Error Handling (Response not OK)
    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
        const error = await response.json();
        if (error && error.error && error.error.message) {
          errorDetails = error.error.message;
        } else if (error && error.message) {
          errorDetails = error.message;
        }
      } catch (e) {
        // If parsing JSON fails, stick with response.statusText
        console.error(`Failed to parse error response from ${providerName} API:`, e);
      }
      throw new Error(`${providerName} API error: ${errorDetails}`);
    }

    // 9. Success Parsing
    const data = await response.json();

    // 10. Model Extraction
    let modelsList = data;
    if (responseDataPath) {
      modelsList = responseDataPath.split('.').reduce((o, k) => o?.[k], data);
    }

    if (!Array.isArray(modelsList)) {
      console.warn(`${providerName} API response format unexpected: model list not found or not an array at path '${responseDataPath || 'root'}'.`, data);
      return [];
    }

    if (typeof modelIdExtractor !== 'function') {
        console.error(`${providerName} modelIdExtractor is not a function.`);
        throw new Error(`${providerName} modelIdExtractor is not properly configured.`);
    }
    
    return modelsList.map(modelIdExtractor).filter(modelFilterPredicate);

  } catch (error) {
    // 11. Catch Block
    // Ensure error.message is logged, as the original error object might be stringified poorly
    console.error(`Error fetching ${providerName} models:`, error.message);
    throw error;
  }
};
