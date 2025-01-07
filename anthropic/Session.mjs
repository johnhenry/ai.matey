import SharedSession from "../shared/Session.mjs";
class Session extends SharedSession {

  async prompt(prompt, options = {}) {
    // Use Anthropic API endpoint
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    options.max_tokens = options.maxTokens ?? this.ai.languageModel._capabilities.maxTokens ?? 4096;
    const response = await fetch(`${this.config.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.credentials?.apiKey || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.config.model || "claude-3-opus-20240229",
        system: this.options.systemPrompt,
        messages: [
          ...(this.options.initialPrompts || []).filter(
            (msg) => msg.role === "user" || msg.role === "assistant"
          ),
          { role: "user", content: prompt },
        ],
        ...options
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Anthropic API Error: ${data.error.message}`);
    }
    return data.content[0].text;
  }

  async promptStreaming(prompt, options = {}) {
    // Use Anthropic API endpoint with streaming
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    options.max_tokens = options.maxTokens ?? this.ai.languageModel._capabilities.maxTokens;
    const response = await fetch(`${this.config.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.credentials?.apiKey || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({
        model: this.config.model || "claude-3-opus-20240229",
        system: this.options.systemPrompt,
        messages: [
          ...(this.options.initialPrompts || []).filter(
            (msg) => msg.role === "user" || msg.role === "assistant"
          ),
          { role: "user", content: prompt },
        ],
        ...options,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }

    return (async function* () {
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";
      let currentEvent = null;
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("event: ")) {
              currentEvent = trimmedLine.slice(7);
              continue;
            }

            if (trimmedLine.startsWith("data: ")) {
              const data = trimmedLine.slice(6);
              
              if (data === "[DONE]") {
                return;
              }

              try {
                const parsed = JSON.parse(data);

                // Handle different event types
                switch (currentEvent) {
                  case "message_start":
                    // Message started, nothing to yield yet
                    break;
                  case "content_block_start":
                    // Content block started, nothing to yield yet
                    break;
                  case "content_block_delta":
                    if (parsed.delta?.text) {
                      yield parsed.delta.text;
                    }
                    break;
                  case "message_delta":
                    if (parsed.delta?.content?.[0]?.text) {
                      yield parsed.delta.content[0].text;
                    }
                    break;
                  default:
                    // For any other event, try to extract content if available
                    if (parsed.content?.[0]?.text) {
                      yield parsed.content[0].text;
                    }
                }
              } catch (error) {
                console.error("Failed to parse SSE message:", trimmedLine);
                console.error("Parse error:", error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }
}

export default Session;
