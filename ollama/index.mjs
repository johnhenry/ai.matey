import { assemble } from "../shared/assemble.mjs";
import Session from "../openai/Session.mjs";
import { ollama as config } from "../openai/configs.mjs";
import createModelFetcher from "./createModelFetcher.mjs";
const AI = assemble(Session, config, createModelFetcher);

export default AI;
