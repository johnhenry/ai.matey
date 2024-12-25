import { LanguageModel, Session, Capabilities } from "./LanguageModel.mjs";
import { assemble } from "../shared/assemble.mjs";
const { AI, Summarizer, Writer, ReWriter } = assemble(
  Session,
  Capabilities,
  LanguageModel,
  {
    endpoint: "https://generativelanguage.googleapis.com",
    model: "llama3.2:latest",
  }
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
