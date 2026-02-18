import type { Router } from "express";
import { createServicesRouter } from "../src/api/routes/services";
import { openApiRouter } from "../src/api/routes/openapi";
import { createX402Router } from "../src/api/routes/x402";
import { createDependencies } from "../src/dependencies";

type RouteMethod = "get" | "post";
type RouteHandler = (req: any, res: any, next: (error?: unknown) => void) => unknown;

describe("API routes", () => {
  const originalFetch = global.fetch;
  const dependencies = createDependencies({
    port: 3000,
    cacheTtlMs: 60_000,
    defaultFacilitatorUrl: "https://x402.org/facilitator",
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("search route returns matching services", async () => {
    dependencies.serviceRegistryService.registerService({
      ensName: "weather-api.eth",
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      endpoint: "https://api.example.com/weather",
      paymentScheme: "exact",
      network: "eip155:8453",
      description: "Weather endpoint",
      capabilities: ["weather"],
    });

    const router = createServicesRouter(dependencies);
    const handler = getRouteHandler(router, "/api/services/search", "get");
    const req = { query: { q: "weather" } };
    const res = createMockResponse();
    const next = jest.fn();

    await Promise.resolve(handler(req, res, next));

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.payload as { total: number }).total).toBeGreaterThanOrEqual(1);
  });

  it("verify payment route maps invalid facilitator response to HTTP 402 payload", async () => {
    dependencies.serviceRegistryService.registerService({
      ensName: "chat-agent.eth",
      owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      endpoint: "https://api.example.com/chat",
      paymentScheme: "exact",
      network: "eip155:8453",
    });

    global.fetch = jest.fn().mockResolvedValue(
      buildJsonResponse(
        {
          isValid: false,
          invalidReason: "signature_invalid",
        },
        402
      )
    ) as typeof fetch;

    const router = createServicesRouter(dependencies);
    const handler = getRouteHandler(router, "/api/services/:ensName/payments/verify", "post");
    const req = {
      params: { ensName: "chat-agent.eth" },
      body: {
        paymentPayload: { x402Version: 2, signature: "0xdeadbeef" },
        paymentRequirements: {
          scheme: "exact",
          network: "eip155:8453",
          resource: "https://api.example.com/chat",
        },
      },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await Promise.resolve(handler(req, res, next));

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect((res.payload as { verification: { isValid: boolean } }).verification.isValid).toBe(
      false
    );
  });

  it("x402 discovery route returns facilitator resources", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      buildJsonResponse(
        {
          items: [{ resource: "https://api.example.com/summary" }],
          total: 1,
        },
        200
      )
    ) as typeof fetch;

    const router = createX402Router(dependencies);
    const handler = getRouteHandler(router, "/api/x402/discovery/resources", "get");
    const req = {
      query: {
        facilitatorUrl: "https://x402.org/facilitator",
        type: "http",
      },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await Promise.resolve(handler(req, res, next));

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.payload as { total: number }).total).toBe(1);
  });

  it("openapi route returns API spec", async () => {
    const handler = getRouteHandler(openApiRouter, "/api/openapi.json", "get");
    const req = {};
    const res = createMockResponse();
    const next = jest.fn();

    await Promise.resolve(handler(req, res, next));

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect((res.payload as { openapi: string }).openapi).toBe("3.0.3");
  });
});

function getRouteHandler(
  router: Router,
  path: string,
  method: RouteMethod,
  index = 0
): RouteHandler {
  const layer = (router as unknown as { stack: Array<{ route?: any }> }).stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );
  if (!layer?.route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }
  const routeLayer = layer.route.stack[index];
  if (!routeLayer) {
    throw new Error(`Route handler not found: ${method.toUpperCase()} ${path}`);
  }
  return routeLayer.handle as RouteHandler;
}

function createMockResponse(): {
  statusCode: number;
  payload: unknown;
  status: (code: number) => any;
  json: (body: unknown) => any;
} {
  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.payload = body;
      return response;
    },
  };

  return response;
}

function buildJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
