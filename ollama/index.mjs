import { assemble } from "../shared/assemble.mjs";
import Session from "../openai/Session.mjs";
import { ollama as config } from "../openai/configs.mjs";
const AI = assemble(
  Session,
  config
);

export default AI;
