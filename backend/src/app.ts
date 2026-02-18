import express, { type Express } from "express";
import { registerApiRoutes } from "./api";
import { type EnvConfig, loadEnv } from "./config/env";
import { createDependencies } from "./dependencies";
import { errorHandler } from "./middleware/error-handler";

export function createApp(envConfig: EnvConfig = loadEnv()): Express {
  const app = express();
  const dependencies = createDependencies(envConfig);

  app.use(express.json());
  registerApiRoutes(app, dependencies);
  app.use(errorHandler);

  return app;
}
