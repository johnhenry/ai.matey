
const create = (Session, Capabilities) => {
  class LanguageModel {
    constructor(config = {}) {
      this.config = config;
      this.useWindowAI = Object.keys(config).length === 0;
    }
    async capabilities() {
      if (this.useWindowAI) {
        return await window.ai.languageModel.capabilities();
      }
      // For OpenAI endpoints, return default capabilities
      return Capabilities;
    }
    async create(options = {}) {
      return new Session(options, this.useWindowAI, this.config);
    }
  }
  return { LanguageModel, Session };
}
export default create;
