const assert = require("node:assert/strict");
const test = require("node:test");
const { namehash } = require("ethers");
const { EnsX402DiscoveryClient } = require("../dist/index.js");

test("normalizes, validates, and computes ENS node", () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  const normalized = client.normalizeEnsName(" Weather-API.ETH ");
  assert.equal(normalized, "weather-api.eth");
  assert.equal(client.validateEnsName(normalized), true);
  assert.equal(client.computeEnsNode(normalized), namehash(normalized));
  assert.equal(client.validateEnsName("not-an-ens-name"), false);
});

test("resolves ENS name via API and verifies ENS node", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  const ensName = "weather-api.eth";
  const ensNode = namehash(ensName);
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(url, `http://localhost:3000/api/services/${encodeURIComponent(ensName)}`);
    return new Response(
      JSON.stringify({
        service: {
          ensName,
          ensNode,
          owner: "0x1111111111111111111111111111111111111111",
          endpoint: "https://api.example.com/weather",
          paymentScheme: "exact",
          network: "eip155:8453",
          description: "Weather API",
          capabilities: ["forecast"],
          facilitatorUrl: "https://x402.org/facilitator",
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const resolved = await client.resolveEnsName(" Weather-API.eth ");
    assert.equal(resolved.ensName, ensName);
    assert.equal(resolved.ensNode, ensNode);
    assert.equal(resolved.service.endpoint, "https://api.example.com/weather");
  } finally {
    global.fetch = originalFetch;
  }
});

test("throws when ENS name is invalid", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  await assert.rejects(
    async () => {
      await client.resolveEnsName("invalid-name");
    },
    /Invalid ENS name/
  );
});

test("throws when API returns mismatched ENS node", async () => {
  const client = new EnsX402DiscoveryClient({
    apiBaseUrl: "http://localhost:3000/",
  });

  const ensName = "weather-api.eth";
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        service: {
          ensName,
          ensNode: namehash("other.eth"),
          owner: "0x1111111111111111111111111111111111111111",
          endpoint: "https://api.example.com/weather",
          paymentScheme: "exact",
          network: "eip155:8453",
          description: "Weather API",
          capabilities: [],
          facilitatorUrl: "https://x402.org/facilitator",
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );

  try {
    await assert.rejects(
      async () => {
        await client.resolveEnsName(ensName);
      },
      /Resolver mismatch: expected ensNode/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
