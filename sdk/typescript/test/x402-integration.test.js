const assert = require("node:assert/strict");
const test = require("node:test");
const { EnsX402DiscoveryClient } = require("../dist/index.js");

test("getX402DiscoverableResources returns items from x402 discovery endpoint", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(
      url,
      "http://localhost:3000/api/x402/discovery/resources?facilitatorUrl=https%3A%2F%2Fx402.org%2Ffacilitator&type=http&limit=10&offset=0"
    );
    return new Response(
      JSON.stringify({
        facilitatorUrl: "https://x402.org/facilitator",
        items: [{ resource: "https://api.example.com/weather", x402Version: 2 }],
        total: 1,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const result = await client.getX402DiscoverableResources({
      facilitatorUrl: "https://x402.org/facilitator",
      type: "http",
      limit: 10,
      offset: 0,
    });
    assert.equal(result.facilitatorUrl, "https://x402.org/facilitator");
    assert.equal(result.total, 1);
    assert.equal(result.items[0].resource, "https://api.example.com/weather");
  } finally {
    global.fetch = originalFetch;
  }
});

test("getX402DiscoverableResources rejects invalid pagination options", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  await assert.rejects(
    async () => {
      await client.getX402DiscoverableResources({ limit: -1 });
    },
    /limit must be a non-negative integer/
  );
  await assert.rejects(
    async () => {
      await client.getX402DiscoverableResources({ offset: -2 });
    },
    /offset must be a non-negative integer/
  );
});

test("verifyServicePayment returns invalid verification for 402 response", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    assert.equal(
      url,
      "http://localhost:3000/api/services/weather-api.eth/payments/verify"
    );
    assert.equal(init.method, "POST");
    return new Response(
      JSON.stringify({
        ensName: "weather-api.eth",
        verification: {
          isValid: false,
          invalidReason: "signature_invalid",
        },
      }),
      {
        status: 402,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const result = await client.verifyServicePayment("Weather-API.eth", {
      paymentPayload: { signature: "bad" },
      paymentRequirements: {
        scheme: "exact",
        network: "eip155:8453",
        resource: "https://api.example.com/weather",
      },
    });
    assert.equal(result.ensName, "weather-api.eth");
    assert.equal(result.verification.isValid, false);
    assert.equal(result.verification.invalidReason, "signature_invalid");
  } finally {
    global.fetch = originalFetch;
  }
});

test("verifyServicePayment validates inputs", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  await assert.rejects(
    async () => {
      await client.verifyServicePayment("invalid-name", {
        paymentPayload: {},
        paymentRequirements: {},
      });
    },
    /Invalid ENS name/
  );

  await assert.rejects(
    async () => {
      await client.verifyServicePayment("weather-api.eth", {
        paymentPayload: [],
        paymentRequirements: {},
      });
    },
    /paymentPayload must be an object/
  );
});
