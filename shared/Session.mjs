class Session {
    #ai;
    #options;
    constructor(options = {}, ai) {
      this.#options = options;
      this.#ai = ai;
    }
    destroy() {
        throw new Error("Not implemented");
    }
    clone() {
        throw new Error("Not implemented");
    }
    prompt() {
        throw new Error("Not implemented");
    }
    promptStreaming() {
        throw new Error("Not implemented");
    }
    get config (){
        return this.#ai.config;
    }
    get ai(){
        return this.#ai;
    }
    get options(){
        return this.#options;
    }
}

export default Session;
