class Session {
    #ai;
    #options;
    #conversationHistory = [];
    #maxHistorySize;
    #tokensSoFar = 0;
    #maxTokens;

    constructor(options = {}, ai) {
      this.#options = options;
      this.#ai = ai;
      this.#maxHistorySize = options.maxHistorySize ?? 0; // -1 means unlimited
      this.#maxTokens = options.maxTokens ?? -1; // -1 means unlimited
    }

    _addToHistory(userMessage, assistantMessage) {
      if(this.#maxHistorySize === 0) {
        return;
      }
      this.#conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage }
      );

      // Update token count for the new messages
      this._updateTokenCount([
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage }
      ]);

      // Trim history if needed and maxHistorySize is not unlimited (-1)
      if (this.#maxHistorySize > 0 && this.#conversationHistory.length > this.#maxHistorySize * 2) {
        // Before removing messages, subtract their tokens
        const removedMessages = this.#conversationHistory.slice(0, -this.#maxHistorySize * 2);
        this._updateTokenCount(removedMessages, true);
        
        this.#conversationHistory = this.#conversationHistory.slice(-this.#maxHistorySize * 2);
      }
    }

    async _updateTokenCount(messages, subtract = false) {
      try {
        const tokensInMessages = await this._countTokensInMessages(messages);
        this.#tokensSoFar = Math.max(0, 
          this.#tokensSoFar + (subtract ? -tokensInMessages : tokensInMessages)
        );
      } catch (error) {
        console.warn('Failed to count tokens:', error);
      }
    }

    _countTokens(text) {
      if (!text) return 0;
      
      // Split on whitespace and punctuation
      const words = text.trim().split(/[\s\p{P}]+/u).filter(Boolean);
      
      // Count subwords based on common patterns
      let tokenCount = 0;
      for (const word of words) {
        // Handle common patterns that might split into multiple tokens:
        // 1. CamelCase or PascalCase: thisIsAWord -> [this, Is, A, Word]
        // 2. snake_case or kebab-case: this_is_a_word -> [this, is, a, word]
        // 3. Numbers and special characters
        
        const subwords = word
          // Split on camelCase and PascalCase
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          // Split on snake_case and kebab-case
          .replace(/[_-]/g, ' ')
          // Split numbers from text
          .replace(/(\d+)/g, ' $1 ')
          .trim()
          .split(/\s+/);
        
        tokenCount += subwords.length;
        
        // Add extra tokens for very long words (assuming they might be split further)
        for (const subword of subwords) {
          if (subword.length > 12) {
            tokenCount += Math.floor(subword.length / 12);
          }
        }
      }
      
      return Math.max(1, tokenCount);
    }

    _countTokensInMessages(messages) {
      if (!Array.isArray(messages) || messages.length === 0) return 0;
      
      return messages.reduce((total, msg) => {
        // Count tokens in the message content
        const contentTokens = this._countTokens(msg.content || '');
        
        // Add tokens for message structure (role, formatting)
        const structureTokens = 3; // Approximate tokens for message structure
        
        return total + contentTokens + structureTokens;
      }, 0);
    }
    /*
    # chat -- simulates a Open AI chat.completions.create
    */
    async chat({messages, stream, ...options}) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from user');
      }

      // Set conversation history to all messages except the last one
      this._setConversationHistory(messages.slice(0, -1));

      // Generate a unique ID for this conversation
      const id = `${Math.random().toString(36).slice(2)}`;
      const created = Math.floor(Date.now() / 1000);
      if (stream) {
        const streamer = await this.promptStreaming(lastMessage.content, options)
        // Transform the stream to emit properly formatted chunks
        return (async function* (){
          for await (const chunk of streamer) {
            yield {
              id,
              created,
              model: this.config.model,
              endpoint: this.config.endpoint,
              object: "chat.completion.chunk",
              system_fingerprint: null,
              choices: [{
                finish_reason: null,
                index: 0,
                delta: {
                  content: chunk,
                  role: "assistant",
                  function_call: null,
                  tool_calls: null,
                  audio: null
                },
                logprobs: null
              }]
            };
          }

        }).call(this);
      } else {
        const content = await this.prompt(lastMessage.content, options);
        // Format the response according to the example
        return {
          id,
          created,
          model: this.config.model,
          endpoint: this.config.endpoint,
          object: "chat.completion",
          system_fingerprint: null,
          choices: [{
            finish_reason: "stop",
            index: 0,
            message: {
              content,
              role: "assistant",
              tool_calls: null,
              function_call: null
            }
          }],
          usage: {
            completion_tokens: this._countTokens(content),
            prompt_tokens: this._countTokens(lastMessage.content),
            total_tokens: this._countTokens(content) + this._countTokens(lastMessage.content),
            completion_tokens_details: null,
            prompt_tokens_details: {
              audio_tokens: null,
              cached_tokens: 0
            },
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        };
      }
    }
    _getConversationHistory() {
      return this.#conversationHistory;
    }
    _setConversationHistory(messages) {
      return this.#conversationHistory = messages;
    }
    destroy() {
      this.#conversationHistory = [];
      this.#tokensSoFar = 0;
    }
    clone() {
      const Session = Reflect.getPrototypeOf(this);
      const clonedSession = new Session(this.options, this.ai);
      clonedSession._setConversationHistory([...this._getConversationHistory()]);
      return clonedSession;
    }
    prompt() {
      throw new Error("Abstract method not implemented");
    }
    promptStreaming() {
      throw new Error("Abstract method not implemented");
    }
    get config() {
        return this.#ai.config;
    }
    get ai() {
        return this.#ai;
    }
    get options() {
        return this.#options;
    }
    get tokensSoFar() {
        return this.#tokensSoFar;
    }
    get maxTokens() {
        return this.#maxTokens;
    }
    get tokensLeft() {
        if (this.#maxTokens === -1) return Infinity;
        return Math.max(0, this.#maxTokens - this.#tokensSoFar);
    }
}

export default Session;
