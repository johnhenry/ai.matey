import { assemble } from "../shared/assemble.mjs";
import Session from "./Session.mjs";
import config from "./config.mjs";
const AI = assemble(
  Session,
  config
);

export default AI;
