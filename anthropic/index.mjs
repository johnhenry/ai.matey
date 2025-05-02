import { assemble } from "../shared/assemble.mjs";
import Session from "./Session.mjs";
import config from "./config.mjs";
import createModelFetcher from "./createModelFetcher.mjs";

const AI = assemble(Session, config, createModelFetcher);
export default AI;
