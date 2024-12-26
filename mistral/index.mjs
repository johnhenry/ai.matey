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
    endpoint: "https://api.mistral.ai",
    model: "mistral-small-latest",
  }
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
