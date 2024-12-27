const Capabilities = {
    available: "readily",
    defaultTopK: 3,
    maxTopK: 8,
    defaultTemperature: 1.0,
};
const capabilities = function(){
    if(this.useWindowAI){
        return window.ai.languageModel.capabilities();
    }
    return {...Capabilities, "ai.matey": {endpoint: this.config.endpoint, model: this.config.model}};
}

export default capabilities