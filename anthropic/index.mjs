import { LanguageModel, Session, Capabilities } from "./LanguageModel.mjs";
import { assemble } from "../shared/assemble.mjs";
const { AI, Summarizer, Writer, ReWriter } = assemble(
  Session,
  Capabilities,
  LanguageModel,
  {
    endpoint: "https://api.anthropic.com",
    model: "claude-3-5-haiku-latest",
  }
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;