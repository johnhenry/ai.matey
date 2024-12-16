import { Session as Session_, Capabilities } from "./LanguageModel.mjs";

class Session extends Session_ {
  // TODO: Extend the Session class
}

class ReWriter {
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

export { ReWriter, Session };
export default ReWriter;
