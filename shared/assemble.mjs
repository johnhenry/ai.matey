import createLanguageModel from "./LanguageModel.mjs";
import createSummarizer from "./Summarizer.mjs";
import createWriter from "./Writer.mjs";
import createReWriter from "./ReWriter.mjs";
// TODO: Should Capabilities be different per model?
const Capabilities = {
  available: "readily",
  defaultTopK: 3,
  maxTopK: 8,
  defaultTemperature: 1.0,
};
const assemble = (Session, initialConfig = {}) => {
  const { LanguageModel } = createLanguageModel(
    Session, Capabilities);
  const { Summarizer } = createSummarizer(Session, Capabilities);
  const { Writer } = createWriter(Session, Capabilities);
  const { ReWriter } = createReWriter(Session, Capabilities);
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
      this.#languageModel = new LanguageModel(this.#config);
      this.#summarizer = new Summarizer(this.#config);
      this.#writer = new Writer(this.#config);
      this.#rewriter = new ReWriter(this.#config);
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
  return { AI, LanguageModel, Summarizer, Writer, ReWriter };
};
export { assemble };
export default assemble;
