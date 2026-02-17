/**
 * ENS x402 Discovery - Backend API
 *
 * Main entry point for the discovery API server
 */

import express from "express";
import { registerApiRoutes } from "./api";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
registerApiRoutes(app);

app.listen(port, () => {
  console.log(`ENS x402 Discovery API running on port ${port}`);
});
