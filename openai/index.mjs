import { LanguageModel } from "./LanguageModel.mjs";
import { Summarizer } from "./Summarizer.mjs";
import { Writer } from "./Writer.mjs";
import { ReWriter } from "./ReWriter.mjs";
const AI = class {
  #languageModel;
  #summarizer;
  #writer;
  #rewriter;
  constructor(config) {
    this.#languageModel = new LanguageModel(config);
    this.#summarizer = new Summarizer(config);
    this.#writer = new Writer(config);
    this.#rewriter = new ReWriter(config);
  }
  get languageModel() {
    return this.#languageModel;
  }
  get summarizer() {
    return this.#summarizer;
  }
  get writer() {
    return this.#writer;
  }
  get rewriter() {
    return this.#rewriter;
  }
};

export { AI, LanguageModel, Summarizer, Writer, Rewriter };
/**
 * The default export of the AI module, a class representing an AI model.
 * @class
 */
export default AI;
