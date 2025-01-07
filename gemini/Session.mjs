import SharedSession from "../shared/Session.mjs";
class Session extends SharedSession {

  async prompt(prompt, options = {}) {
    // Use Gemini API endpoint
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    options.topK = options.topK ?? this.ai.languageModel._capabilities.defaultTopK;
    options.topP = options.topP ?? this.ai.languageModel._capabilities.topP;
    options.maxOutputTokens = options.maxTokens ?? this.ai.languageModel._capabilities.maxTokens;
    const response = await fetch(
      `${
        this.config.endpoint
      }/v1beta/models/gemini-1.5-flash:generateContent?key=${
        this.config.credentials?.apiKey || ""
      }`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...(this.options.systemPrompt
                  ? [{ text: this.options.systemPrompt }]
                  : []),
                ...(this.options.initialPrompts || []).map((p) => ({
                  text: p.content,
                })),
                { text: prompt },
              ],
            },
          ],
          generationConfig: options,
        }),
      }
    );

    const data = await response.json();
    if (data.error) {
      throw new Error(`Gemini API Error: ${data.error.message}`);
    }
    return data.candidates[0].content.parts[0].text;
  }

  async promptStreaming(prompt, options = {}) {
    // Use Gemini API endpoint with streaming
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    options.topK = options.topK ?? this.ai.languageModel._capabilities.defaultTopK;
    options.topP = options.topP ?? this.ai.languageModel._capabilities.topP;
    options.maxOutputTokens = options.maxTokens ?? this.ai.languageModel._capabilities.maxTokens;
    const response = await fetch(
      `${
        this.config.endpoint
      }/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${
        this.config.credentials?.apiKey || ""
      }`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...(this.options.systemPrompt
                  ? [{ text: this.options.systemPrompt }]
                  : []),
                ...(this.options.initialPrompts || []).map((p) => ({
                  text: p.content,
                })),
                { text: prompt },
              ],
            },
          ],
          generationConfig: options,
        }),
      }
    );

    return (async function* () {
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        const text = decoder.decode(new Uint8Array(chunk));
        // Split into separate messages
        const messages = text.split("\n");

        for (const message of messages) {
          // Skip empty messages
          if (!message.trim()) continue;

          // Extract the JSON data after "data: "
          const jsonStr = message.replace("data: ", "").trim();
          if (jsonStr === "[DONE]") {
            return;
          }

          try {
            const data = JSON.parse(jsonStr);
            const content = data.candidates[0]?.content?.parts[0]?.text;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip parsing errors for empty or incomplete messages
            if (message.trim() && !message.includes("data: ")) {
              throw new Error("Failed to parse JSON stream: " + e?.message);
            }
          }
        }
      }
    })();
  }
}
export default Session;
