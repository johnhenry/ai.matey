import capabilities from "./capabilities.mjs";
const create = (Session) => {
  class LanguageModel {
    constructor(config = {}) {
      this.config = config;
      this.useWindowAI = Object.keys(config).length === 0;
      this.capabilities = capabilities.bind(this);
    }
    async create(options = {}) {
      return new Session(options, this.useWindowAI, this.config);
    }
  }
  return { LanguageModel, Session };
}
export default create;
