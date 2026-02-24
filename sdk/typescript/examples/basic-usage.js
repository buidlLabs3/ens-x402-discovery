const { EnsX402DiscoveryClient } = require("../dist/index.js");

async function main() {
  const apiBaseUrl = process.env.DISCOVERY_API_URL ?? "http://localhost:3000";
  const client = new EnsX402DiscoveryClient({ apiBaseUrl });

  const registered = await client.registerService({
    ensName: "weather-api.eth",
    owner: "0x1111111111111111111111111111111111111111",
    endpoint: "https://api.example.com/weather",
    paymentScheme: "exact",
    network: "eip155:8453",
    description: "Weather service",
    capabilities: ["forecast", "current_weather"],
  });

  console.log("Registered ENS service:", registered.ensName);

  const resolved = await client.resolveEnsName("weather-api.eth");
  console.log("Resolved ENS node:", resolved.ensNode);
  console.log("Resolved endpoint:", resolved.service.endpoint);

  const listed = await client.listServices({ network: "eip155:8453", active: true });
  console.log(`Listed services: ${listed.total}`);

  const searched = await client.searchServices("weather");
  console.log(`Search matches: ${searched.total}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
