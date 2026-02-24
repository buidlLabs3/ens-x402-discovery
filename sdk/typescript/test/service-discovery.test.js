const assert = require("node:assert/strict");
const test = require("node:test");
const { namehash } = require("ethers");
const { EnsX402DiscoveryClient } = require("../dist/index.js");

function buildService(overrides = {}) {
  const ensName = overrides.ensName ?? "weather-api.eth";
  return {
    ensName,
    ensNode: overrides.ensNode ?? namehash(ensName),
    owner: overrides.owner ?? "0x1111111111111111111111111111111111111111",
    endpoint: overrides.endpoint ?? "https://api.example.com/weather",
    paymentScheme: overrides.paymentScheme ?? "exact",
    network: overrides.network ?? "eip155:8453",
    description: overrides.description ?? "Weather API",
    capabilities: overrides.capabilities ?? ["forecast"],
    facilitatorUrl: overrides.facilitatorUrl ?? "https://x402.org/facilitator",
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

test("listServices calls API with filters and returns items", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(
      url,
      "http://localhost:3000/api/services?network=eip155%3A8453&paymentScheme=exact&owner=0x1111111111111111111111111111111111111111&active=true"
    );
    return new Response(
      JSON.stringify({
        items: [buildService()],
        total: 1,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const result = await client.listServices({
      network: "eip155:8453",
      paymentScheme: "exact",
      owner: "0x1111111111111111111111111111111111111111",
      active: true,
    });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].ensName, "weather-api.eth");
  } finally {
    global.fetch = originalFetch;
  }
});

test("listServices rejects invalid filter input before API call", async () => {
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
        await client.listServices({ network: "bad-network" });
      },
      /Invalid CAIP-2 network/
    );
    await assert.rejects(
      async () => {
        await client.listServices({ owner: "0x1234" });
      },
      /Invalid owner address/
    );
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("searchServices calls search API and returns results", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(url, "http://localhost:3000/api/services/search?q=weather");
    return new Response(
      JSON.stringify({
        items: [buildService()],
        total: 1,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const result = await client.searchServices(" weather ");
    assert.equal(result.total, 1);
    assert.equal(result.items[0].ensName, "weather-api.eth");
  } finally {
    global.fetch = originalFetch;
  }
});

test("searchServices rejects empty query", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });
  await assert.rejects(
    async () => {
      await client.searchServices("   ");
    },
    /Search query must be non-empty/
  );
});
