class Session {
    #ai;
    #options;
    #conversationHistory = [];
    #maxHistorySize;

    constructor(options = {}, ai) {
      this.#options = options;
      this.#ai = ai;
      this.#maxHistorySize = options.maxHistorySize ?? 0; // -1 means unlimited
    }

    _addToHistory(userMessage, assistantMessage) {
      if(this.#maxHistorySize === 0) {
        return;
      }
      this.#conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage }
      );

      // Trim history if needed and maxHistorySize is not unlimited (-1)
      if (this.#maxHistorySize > 0 && this.#conversationHistory.length > this.#maxHistorySize * 2) {
        this.#conversationHistory = this.#conversationHistory.slice(-this.#maxHistorySize * 2);
      }
    }

    _getConversationHistory() {
      return this.#conversationHistory;
    }

    destroy() {
      this.#conversationHistory = [];
    }

    clone() {
      const clonedSession = new Session(this.#options, this.#ai);
      clonedSession.#conversationHistory = [...this.#conversationHistory];
      clonedSession.#maxHistorySize = this.#maxHistorySize;
      return clonedSession;
    }

    prompt() {
        throw new Error("Not implemented");
    }

    promptStreaming() {
        throw new Error("Not implemented");
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
}

export default Session;
