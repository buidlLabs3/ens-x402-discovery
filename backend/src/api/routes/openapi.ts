import { Router } from "express";

const OPEN_API_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "ENS x402 Discovery API",
    version: "0.1.0",
    description: "Service discovery API integrating ENS identity with x402 payment flows.",
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "API is healthy",
          },
        },
      },
    },
    "/api/services": {
      get: {
        summary: "List services",
      },
      post: {
        summary: "Register service",
      },
    },
    "/api/services/search": {
      get: {
        summary: "Search services",
      },
    },
    "/api/services/{ensName}": {
      get: {
        summary: "Fetch service by ENS name",
        parameters: [
          {
            in: "path",
            name: "ensName",
            required: true,
            schema: { type: "string" },
          },
        ],
      },
    },
    "/api/services/{ensName}/payments/verify": {
      post: {
        summary: "Verify x402 payment for a service",
        parameters: [
          {
            in: "path",
            name: "ensName",
            required: true,
            schema: { type: "string" },
          },
        ],
      },
    },
    "/api/x402/discovery/resources": {
      get: {
        summary: "List discoverable x402 bazaar resources from facilitator",
      },
    },
  },
} as const;

export const openApiRouter = Router();

openApiRouter.get("/api/openapi.json", (_req, res) => {
  res.status(200).json(OPEN_API_SPEC);
});
