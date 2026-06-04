import { run } from "probot";
import app from "./app.js";

/**
 * Production entrypoint. `run` boots Probot's HTTP server, which exposes the
 * webhook endpoint and a /probot health page, then wires in our app.
 *
 * For local development use `npm run dev` (tsx watch), which does the same
 * thing with hot reload.
 */
run(app);
