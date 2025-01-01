import createClient from "./index.mjs";
const { api_keys } = await import("./web.env.local.mjs")
  .then((response) => response.default)
  .catch((e) => {
    console.error(
      "Error loading environment variables from web.env.local.mjs:",
      e
    );
    return {};
  });
const ais = {};
for (const [name, value] of Object.entries(api_keys)) {
  if (value === null) {
    continue;
  }
  try {
    ais[name] = createClient(name, { credentials: { apiKey: value } });
  } catch (e) {
    console.error(`Error creating client ${name}: ${e.message}`);
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
