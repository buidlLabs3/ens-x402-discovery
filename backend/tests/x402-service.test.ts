import { X402Service } from "../src/services/x402-service";

describe("X402Service", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("lists bazaar resources from facilitator discovery endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      buildJsonResponse(
        {
          items: [
            {
              resource: "https://api.example.com/weather",
              accepts: [{ scheme: "exact", network: "eip155:8453" }],
            },
          ],
          total: 1,
        },
        200
      )
    ) as typeof fetch;

    const service = new X402Service();
    const result = await service.listBazaarResources({
      facilitatorUrl: "https://x402.org/facilitator",
      type: "http",
      limit: 5,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.resource).toBe("https://api.example.com/weather");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://x402.org/facilitator/discovery/resources?type=http&limit=5&offset=0",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("returns invalid payment result on non-200 facilitator verify response", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      buildJsonResponse(
        {
          isValid: false,
          invalidReason: "insufficient_funds",
        },
        402
      )
    ) as typeof fetch;

    const service = new X402Service();
    const result = await service.verifyPayment({
      facilitatorUrl: "https://x402.org/facilitator",
      paymentPayload: { x402Version: 2 },
      paymentRequirements: {
        scheme: "exact",
        network: "eip155:8453",
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe("insufficient_funds");
  });

  it("surfaces facilitator connectivity issues as AppError", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as typeof fetch;
    const service = new X402Service();

    await expect(
      service.verifyPayment({
        facilitatorUrl: "https://x402.org/facilitator",
        paymentPayload: {},
        paymentRequirements: {},
      })
    ).rejects.toMatchObject({
      code: "x402_facilitator_unreachable",
      statusCode: 502,
    });
  });
});

function buildJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
