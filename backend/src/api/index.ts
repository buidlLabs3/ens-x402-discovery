import type { Express } from "express";
import { healthRouter } from "./routes/health";
import { openApiRouter } from "./routes/openapi";
import { createServicesRouter } from "./routes/services";
import { createX402Router } from "./routes/x402";
import type { Dependencies } from "../dependencies";

export function registerApiRoutes(app: Express, dependencies: Dependencies): void {
  app.use(healthRouter);
  app.use(openApiRouter);
  app.use(createServicesRouter(dependencies));
  app.use(createX402Router(dependencies));
}
