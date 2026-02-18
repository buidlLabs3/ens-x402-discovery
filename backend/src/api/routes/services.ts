import { Router } from "express";
import type { Dependencies } from "../../dependencies";
import { AppError } from "../../errors";
import type { ServiceRegistrationInput } from "../../types/service";
import { validateRegisterServiceRequest } from "../../middleware/validate-register-service";

export function createServicesRouter(dependencies: Dependencies): Router {
  const router = Router();

  router.get("/api/services/search", (req, res, next) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      if (query.trim().length === 0) {
        throw new AppError(400, "invalid_search_query", "Query parameter 'q' is required");
      }

      const items = dependencies.serviceRegistryService.searchServices(query);
      res.status(200).json({
        items,
        total: items.length,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/services", (req, res, next) => {
    try {
      const activeQuery = typeof req.query.active === "string" ? req.query.active : undefined;
      const active =
        activeQuery === undefined ? undefined : activeQuery.toLowerCase() === "true";

      const items = dependencies.serviceRegistryService.listServices({
        network: typeof req.query.network === "string" ? req.query.network : undefined,
        paymentScheme:
          typeof req.query.paymentScheme === "string" ? req.query.paymentScheme : undefined,
        owner: typeof req.query.owner === "string" ? req.query.owner : undefined,
        active,
      });

      res.status(200).json({
        items,
        total: items.length,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/services", validateRegisterServiceRequest, (req, res, next) => {
    try {
      const service = dependencies.serviceRegistryService.registerService(
        req.body as ServiceRegistrationInput
      );
      res.status(201).json({ service });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/services/:ensName", async (req, res, next) => {
    try {
      const service = await dependencies.serviceRegistryService.getOrHydrateServiceByEnsName(
        req.params.ensName
      );
      if (!service) {
        throw new AppError(404, "service_not_found", "Service not found", {
          ensName: req.params.ensName,
        });
      }
      res.status(200).json({ service });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/services/:ensName/payments/verify", async (req, res, next) => {
    try {
      if (!isRecord(req.body)) {
        throw new AppError(400, "invalid_request_body", "Request body must be a JSON object");
      }
      if (!isRecord(req.body.paymentPayload) || !isRecord(req.body.paymentRequirements)) {
        throw new AppError(
          400,
          "invalid_request_field",
          "Fields 'paymentPayload' and 'paymentRequirements' are required"
        );
      }

      const service = await dependencies.serviceRegistryService.getOrHydrateServiceByEnsName(
        req.params.ensName
      );
      if (!service) {
        throw new AppError(404, "service_not_found", "Service not found", {
          ensName: req.params.ensName,
        });
      }

      dependencies.serviceRegistryService.assertPaymentRequirementsMatchService(
        service,
        req.body.paymentRequirements
      );

      const verification = await dependencies.x402Service.verifyPayment({
        facilitatorUrl:
          typeof req.body.facilitatorUrl === "string"
            ? req.body.facilitatorUrl
            : service.facilitatorUrl,
        paymentPayload: req.body.paymentPayload,
        paymentRequirements: req.body.paymentRequirements,
        x402Version: typeof req.body.x402Version === "number" ? req.body.x402Version : undefined,
      });

      const statusCode = verification.isValid ? 200 : 402;
      res.status(statusCode).json({
        ensName: service.ensName,
        verification,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
