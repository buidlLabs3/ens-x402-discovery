const { EnsX402DiscoveryClient } = require("../dist/index.js");

async function main() {
  const apiBaseUrl = process.env.DISCOVERY_API_URL ?? "http://localhost:3000";
  const client = new EnsX402DiscoveryClient({ apiBaseUrl });

  const x402Resources = await client.getX402DiscoverableResources({
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    type: "http",
    limit: 20,
    offset: 0,
  });
  console.log(`x402 resources discovered: ${x402Resources.total}`);

  const verifyResult = await client.verifyServicePayment("weather-api.eth", {
    paymentPayload: {
      signature: process.env.PAYMENT_SIGNATURE ?? "ok",
    },
    paymentRequirements: {
      scheme: "exact",
      network: "eip155:8453",
      resource: "https://api.example.com/weather",
    },
  });

  console.log("Payment validity:", verifyResult.verification.isValid);
  if (!verifyResult.verification.isValid) {
    console.log("Invalid reason:", verifyResult.verification.invalidReason ?? "unknown");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
