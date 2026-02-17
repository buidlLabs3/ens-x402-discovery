import type { Express } from "express";
import { healthRouter } from "./routes/health";

export function registerApiRoutes(app: Express): void {
  app.use(healthRouter);
}
