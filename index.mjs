import Ollama from "./ollama/index.mjs";
import OpenAI from "./openai/index.mjs";
import Gemini from "./gemini/index.mjs";
import Anthropic from "./anthropic/index.mjs";
import Mistral from "./mistral/index.mjs";
import Groq from "./groq/index.mjs";
import Nvidia from "./nvidia/index.mjs";
import HuggingFace from "./huggingface/index.mjs";
const clients = {
  ollama: Ollama,
  openai: OpenAI,
  gemini: Gemini,
  anthropic: Anthropic,
  mistral: Mistral,
  groq: Groq,
  nvidia: Nvidia,
  huggingface: HuggingFace,
};
const createClient = (name = "ollama", ...rest) => {
  const Client = clients[name?.toLowerCase()];
  if (!Client) {
    throw new Error(`Client ${name} not found`);
  }
  return new Client(...rest);
};
export default createClient;
export {
  Ollama,
  OpenAI,
  Gemini,
  Anthropic,
  Mistral,
  Groq,
  Nvidia,
  HuggingFace,
  createClient,
};
