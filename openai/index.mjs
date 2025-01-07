import { assemble } from "../shared/assemble.mjs";
import Session from "./Session.mjs";
import config from "./configs.mjs";
const AI = assemble(
  Session,
  config
);

export default AI;
