import Anthropic from "./anthropic/index.mjs";
import DeepSeek from "./deepseek/index.mjs"; // Added
import Gemini from "./gemini/index.mjs";
import Groq from "./groq/index.mjs";
import HuggingFace from "./huggingface/index.mjs";
import lmstudio from "./lmstudio/index.mjs";
import Mistral from "./mistral/index.mjs";
import Nvidia from "./nvidia/index.mjs";
import Ollama from "./ollama/index.mjs";
import OpenAI from "./openai/index.mjs";

const clients = {
  anthropic: Anthropic,
  deepseek: DeepSeek,
  gemini: Gemini,
  groq: Groq,
  huggingface: HuggingFace,
  lmstudio: lmstudio,
  mistral: Mistral,
  nvidia: Nvidia,
  ollama: Ollama,
  openai: OpenAI,
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
  Anthropic,
  DeepSeek,
  Gemini,
  Groq,
  HuggingFace,
  lmstudio,
  Mistral,
  Nvidia,
  Ollama,
  OpenAI,
  createClient,
  clients,
};
