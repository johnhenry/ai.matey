import {
  LanguageModel,
  Session,
  Capabilities,
} from "../openai/LanguageModel.mjs";
import { assemble } from "../shared/assemble.mjs";
const { AI, Summarizer, Writer, ReWriter } = assemble(
  Session,
  Capabilities,
  LanguageModel,
  {
    endpoint: "https://api.groq.com/openai",
    model: "llama3-8b-8192",
  }
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
