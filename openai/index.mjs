import { LanguageModel, Session, Capabilities } from "./LanguageModel.mjs";
import { assemble } from "../shared/assemble.mjs";
const { AI, Summarizer, Writer, ReWriter } = assemble(
  Session,
  Capabilities,
  LanguageModel,
  {
    endpoint: "https://api.openai.com",
    model: "gpt-4o-mini",
  }
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
