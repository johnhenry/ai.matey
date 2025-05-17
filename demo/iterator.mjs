import createClient from "../index.mjs";
const { api_keys } = await import("../web.env.local.mjs")
  .then((response) => response.default)
  .catch((e) => {
    console.error(
      "Error loading environment variables from web.env.local.mjs:",
      e
    );
    return {};
  });
export default (async function* () {
  for (const [name, apiKey] of Object.entries(api_keys)) {
    try {
      yield `${name}`;
      // Use the language model
      const ai = createClient(name, { credentials: { apiKey } });
      if (ai.modelFetcher) {
        yield `Models:`;
        yield ai.modelFetcher();
      } else {
        yield "Model fetcher not available.";
      }
      const model = await ai.languageModel.create();
      // const response = await model.prompt("Tell me a story");
      const responses = model.$$.tell_a_me_story({
        subject: "Apples",
      });
      for await (const response of responses) {
        yield response;
      }
      // const response = await model.$.tell_a_me_story({ subject: "Apples" });
      // yield response;
      // // Use the writer
      // const writer = await ai.writer.create();
      // const text = await writer.write("Write a blog post about AI", {
      //   tone: "casual",
      // });
      // yield text;
      // // Use the summarizer
      // const summarizer = await ai.summarizer.create();
      // const summary = await summarizer.summarize(text, { type: "table" });
      // yield summary;
    } catch (e) {
      console.error(`Error using ${name}:${e.message}`);
    } finally {
      yield `Finished using ${name}`;
    }
  }
})();
