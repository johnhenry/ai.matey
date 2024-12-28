import { assemble } from "../shared/assemble.mjs";
import Session from "../openai/Session.mjs";
import { groq as config } from "../openai/configs.mjs";
const { LanguageModel, AI, Summarizer, Writer, ReWriter } = assemble(
  Session,
  config
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
