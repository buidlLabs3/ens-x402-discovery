import { namehash } from "ethers";
import { EnsService } from "../src/services/ens-service";

describe("EnsService", () => {
  it("computes ENS nodes using ENS namehash", () => {
    const service = new EnsService(60_000);

    const node = service.computeEnsNode("weather-api.eth");

    expect(node).toBe(namehash("weather-api.eth"));
  });

  it("hydrates missing records via resolver reader fallback", async () => {
    const resolverReader = jest.fn().mockResolvedValue({
      ensName: "weather-api.eth",
      ensNode: namehash("weather-api.eth"),
      owner: "0x1111111111111111111111111111111111111111",
      endpoint: "https://api.example.com/weather",
      paymentScheme: "exact",
      network: "eip155:8453",
      description: "Weather API",
      capabilities: ["forecast"],
    });
    const service = new EnsService(60_000, resolverReader);

    const record = await service.resolveEnsNameWithFallback("Weather-API.eth");

    expect(record).not.toBeNull();
    expect(record?.ensName).toBe("weather-api.eth");
    expect(record?.endpoint).toBe("https://api.example.com/weather");
    expect(resolverReader).toHaveBeenCalledWith("weather-api.eth", namehash("weather-api.eth"));
  });

  it("throws on invalid ENS names during resolver reads", async () => {
    const service = new EnsService(60_000);

    await expect(service.readResolverExtension("invalid")).rejects.toMatchObject({
      code: "invalid_ens_name",
      statusCode: 400,
    });
  });
});
