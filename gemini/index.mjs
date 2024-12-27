import { assemble } from "../shared/assemble.mjs";
import Session from "./Session.mjs";
import config from "./config.mjs";
const { LanguageModel, AI, Summarizer, Writer, ReWriter } = assemble(
  Session,
  config
);
export { AI, LanguageModel, Summarizer, Writer, ReWriter };
export default AI;
