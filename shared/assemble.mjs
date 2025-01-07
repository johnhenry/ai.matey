import LanguageModel from "./LanguageModel.mjs";
import Summarizer from "./Summarizer.mjs";
import Writer from "./Writer.mjs";
import ReWriter from "./ReWriter.mjs";
const assemble = (Session, initialConfig = {}) => {
  const AI = class {
    #languageModel;
    #summarizer;
    #writer;
    #rewriter;
    #config;
    constructor(config) {
      this.#config = {
        ...initialConfig,
        ...config,
      };
      this.#languageModel = new LanguageModel(Session, this);
      this.#summarizer = new Summarizer(Session, this);
      this.#writer = new Writer(Session, this);
      this.#rewriter = new ReWriter(Session, this);
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
    get config() {
      return this.#config;
    }
  };
  return AI;
};
export { assemble };
export default assemble;
