import createSummarizer from "./Summarizer.mjs";
import createWriter from "./Writer.mjs";
import createReWriter from "./ReWriter.mjs";
const assemble = (Session, Capabilities, LanguageModel) => {
  const { Summarizer } = createSummarizer(Session, Capabilities);
  const {Writer} = createWriter(Session, Capabilities);
  const {ReWriter} = createReWriter(Session, Capabilities);
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
  return { AI, LanguageModel, Summarizer, Writer, ReWriter };
};
export { assemble };
export default assemble;