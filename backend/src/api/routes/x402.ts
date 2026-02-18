import { Router } from "express";
import type { Dependencies } from "../../dependencies";
import { AppError } from "../../errors";

export function createX402Router(dependencies: Dependencies): Router {
  const router = Router();

  router.get("/api/x402/discovery/resources", async (req, res, next) => {
    try {
      const limit = toOptionalPositiveInt(req.query.limit);
      const offset = toOptionalPositiveInt(req.query.offset);
      if (
        (req.query.limit !== undefined && limit === undefined) ||
        (req.query.offset !== undefined && offset === undefined)
      ) {
        throw new AppError(
          400,
          "invalid_query_param",
          "Query params 'limit' and 'offset' must be positive integers"
        );
      }

      const facilitatorUrl =
        typeof req.query.facilitatorUrl === "string"
          ? req.query.facilitatorUrl
          : dependencies.serviceRegistryService.getDefaultFacilitatorUrl();

      const result = await dependencies.x402Service.listBazaarResources({
        facilitatorUrl,
        type: typeof req.query.type === "string" ? req.query.type : "http",
        limit,
        offset,
      });

      res.status(200).json({
        facilitatorUrl,
        items: result.items,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function toOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}
