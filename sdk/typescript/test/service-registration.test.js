const assert = require("node:assert/strict");
const test = require("node:test");
const { namehash } = require("ethers");
const { EnsX402DiscoveryClient } = require("../dist/index.js");

test("registerService sends normalized payload and returns service", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;

  global.fetch = async (url, init) => {
    assert.equal(url, "http://localhost:3000/api/services");
    assert.equal(init.method, "POST");

    const body = JSON.parse(init.body);
    assert.equal(body.ensName, "weather-api.eth");
    assert.equal(body.owner, "0x1111111111111111111111111111111111111111");
    assert.equal(body.endpoint, "https://api.example.com/weather");
    assert.equal(body.paymentScheme, "exact");
    assert.equal(body.network, "eip155:8453");
    assert.deepEqual(body.capabilities, ["forecast", "current_weather"]);
    assert.equal(body.description, "Weather API");
    assert.equal(body.facilitatorUrl, "https://x402.org/facilitator");

    return new Response(
      JSON.stringify({
        service: {
          ensName: "weather-api.eth",
          ensNode: namehash("weather-api.eth"),
          owner: "0x1111111111111111111111111111111111111111",
          endpoint: "https://api.example.com/weather",
          paymentScheme: "exact",
          network: "eip155:8453",
          description: "Weather API",
          capabilities: ["forecast", "current_weather"],
          facilitatorUrl: "https://x402.org/facilitator",
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 201,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const service = await client.registerService({
      ensName: " Weather-API.ETH ",
      owner: "0x1111111111111111111111111111111111111111",
      endpoint: "https://api.example.com/weather",
      paymentScheme: " exact ",
      network: " eip155:8453 ",
      description: " Weather API ",
      capabilities: [" forecast", "current_weather "],
      facilitatorUrl: "https://x402.org/facilitator",
    });

    assert.equal(service.ensName, "weather-api.eth");
  } finally {
    global.fetch = originalFetch;
  }
});

test("registerService rejects invalid ENS name before API call", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("should not call fetch");
  };

  try {
    await assert.rejects(
      async () => {
        await client.registerService({
          ensName: "invalid-name",
          owner: "0x1111111111111111111111111111111111111111",
          endpoint: "https://api.example.com/weather",
          paymentScheme: "exact",
          network: "eip155:8453",
        });
      },
      /Invalid ENS name/
    );
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("registerService rejects invalid owner and endpoint protocol", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  await assert.rejects(
    async () => {
      await client.registerService({
        ensName: "weather-api.eth",
        owner: "0x1234",
        endpoint: "https://api.example.com/weather",
        paymentScheme: "exact",
        network: "eip155:8453",
      });
    },
    /Invalid owner address/
  );

  await assert.rejects(
    async () => {
      await client.registerService({
        ensName: "weather-api.eth",
        owner: "0x1111111111111111111111111111111111111111",
        endpoint: "http://api.example.com/weather",
        paymentScheme: "exact",
        network: "eip155:8453",
      });
    },
    /Invalid endpoint protocol/
  );
});

test("registerService propagates API error payload message", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: "owner is not authorized",
        },
      }),
      {
        status: 403,
        headers: { "content-type": "application/json" },
      }
    );

  try {
    await assert.rejects(
      async () => {
        await client.registerService({
          ensName: "weather-api.eth",
          owner: "0x1111111111111111111111111111111111111111",
          endpoint: "https://api.example.com/weather",
          paymentScheme: "exact",
          network: "eip155:8453",
        });
      },
      /owner is not authorized/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
