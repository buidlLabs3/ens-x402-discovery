import type { Express } from "express";
import { healthRouter } from "./routes/health";
import { createServicesRouter } from "./routes/services";
import type { Dependencies } from "../dependencies";

export function registerApiRoutes(app: Express, dependencies: Dependencies): void {
  app.use(healthRouter);
  app.use(createServicesRouter(dependencies));
}
