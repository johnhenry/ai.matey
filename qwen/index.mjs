import { assemble } from "../shared/assemble.mjs";
import Session from "../openai/Session.mjs"; // Uses OpenAI's session
import config from "./config.mjs";
import createModelFetcher from "./createModelFetcher.mjs";

const AI = assemble(Session, config, createModelFetcher);

export default AI;
