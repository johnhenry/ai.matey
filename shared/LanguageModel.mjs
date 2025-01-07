const CAPIBILITIES_DEFAULT = {
  available: "readily",
  defaultTopK: 3,
  maxTopK: 8,
  defaultTemperature: 1.0,
};

const LanguageModel =  class {
  #capabilities;
  constructor(Session, config = {}) {
    this.session = Session;
    this.config = config;
    this.#capabilities = {available: "readily", ...(this.config.capabilities || CAPIBILITIES_DEFAULT)};
    if(typeof AIAssistantCapabilities !== "undefined") {
      Reflect.setPrototypeOf(this.#capabilities, AIAssistantCapabilities.prototype);
    }
  }
  get endpoint() {
    return this.config.endpoint;
  }
  get model() {
    return this.config.model;
  }
  async create(options = {}) {
    return new this.session(options, this.config);
  }
  capabilities() {
    return this.#capabilities;
  }
  get _capabilities() {
    return this.#capabilities;
  }
}
export default LanguageModel;