import Ollama from "./ollama/index.mjs";
import OpenAI from "./openai/index.mjs";
import Gemini from "./gemini/index.mjs";
import Anthropic from "./anthropic/index.mjs";
import Mistral from "./mistral/index.mjs";
import Groq from "./groq/index.mjs";
import Nvidia from "./nvidia/index.mjs";

const ENV = await import("./web.env.local.mjs")
  .then((response) => response.default)
  .catch((e) => {
    console.error(
      "Error loading environment variables from web.env.local.mjs:",
      e
    );
    return {};
  });
console.log(ENV);
const ais = {};
for (const [key, value] of Object.entries(ENV)) {
  if (value === null) {
    continue;
  }
  switch (key) {
    case "OPEN_AI_API_KEY":
      ais.OPENAI = new OpenAI({
        credentials: {
          apiKey: value,
        },
      });
      break;
    case "GEMINI_API_KEY":
      ais.GEMINI = new Gemini({
        credentials: {
          apiKey: value,
        },
      });
      break;
    case "ANTHROPIC_API_KEY":
      ais.ANTHROPIC = new Anthropic({
        credentials: {
          apiKey: value,
        },
      });
      break;
    case "MISTRAL_API_KEY":
      ais.MISTRAL = new Mistral({
        credentials: {
          apiKey: value,
        },
      });
      break;
    case "GROQ_API_KEY":
      ais.GROQ = new Groq({
        credentials: {
          apiKey: value,
        },
      });
      break;
    case "NVIDIA_API_KEY":
      ais.NVIDIA = new Nvidia({
        credentials: {
          apiKey: value,
        },
      });
      break;
    case "OLLAMA_API_KEY":
      ais.OLLAMA = new Ollama({
        credentials: {
          apiKey: value,
        },
      });
      break;
  }
}
// if (window.ai) {
//   ais.CHROME = window.ai;
// }

for (const [name, ai] of Object.entries(ais)) {
  try {
    console.log(`Using ${name}`);
    // Use the language model
    const model = await ai.languageModel.create();
    const response = await model.prompt("Tell me a story");
    console.log(response);

    // Use the writer
    const writer = await ai.writer.create();
    const text = await writer.write("Write a blog post about AI", {
      tone: "casual",
    });
    console.log(text);

    // Use the summarizer
    const summarizer = await ai.summarizer.create();
    const summary = await summarizer.summarize(text, { type: "table" });
    console.log(summary);

  } catch (e) {
    console.error(`Error using ${name}:${e.message}`);
  } finally {
    console.log(`Finished using ${name}`);
  }
}

// for (const [name, ai] of Object.entries(ais)) {
//     try {
//       console.log(`Using ${name}`);
//       // Use the language model
//       const model = await ai.languageModel.create();
//       for await (const value of await model.promptStreaming("Tell me a story")) {
//         console.log(value);
//       }
//     } catch (e) {
//       console.error(`Error using ${name}:${e.message}`);
//     } finally {
//       console.log(`Finished using ${name}`);
//     }
//   }