import Ollama from "./ollama/index.mjs";
const ai = new Ollama();
if (ai.modelFetcher) {
  console.log("Models:", await ai.modelFetcher());
} else {
  console.log("Model fetcher not available.");
}
