import { LanguageModel } from "./LanguageModel.mjs";

const AI = class {
    #languageModel;
    constructor(config) {
        this.#languageModel = new LanguageModel(config);
    }
    get languageModel() {
        return this.#languageModel;
    }
}



export { AI, LanguageModel }
/**
 * The default export of the AI module, a class representing an AI model.
 * @class
 */
export default AI;