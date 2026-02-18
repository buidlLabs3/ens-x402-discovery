/**
 * ENS x402 Discovery - Backend API
 *
 * Main entry point for the discovery API server
 */

import { createApp } from "./app";
import { loadEnv } from "./config/env";

const env = loadEnv();
const app = createApp(env);

app.listen(env.port, () => {
  console.log(`ENS x402 Discovery API running on port ${env.port}`);
});
