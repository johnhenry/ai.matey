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
    endpoint: "http://localhost:11434",
    model: "llama3.2:latest",
  }
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
