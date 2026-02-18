import { namehash } from "ethers";
import { EnsService } from "../src/services/ens-service";
import { ServiceRegistryService } from "../src/services/service-registry-service";
import { X402Service } from "../src/services/x402-service";

describe("ServiceRegistryService", () => {
  it("hydrates services from ENS resolver extension when not in local registry", async () => {
    const ensService = new EnsService(60_000, async (ensName, ensNode) => ({
      ensName,
      ensNode,
      owner: "0x2222222222222222222222222222222222222222",
      endpoint: "https://api.example.com/chat",
      paymentScheme: "exact",
      network: "eip155:8453",
      description: "Chat API",
      capabilities: ["chat"],
    }));
    const service = new ServiceRegistryService(
      ensService,
      new X402Service(),
      "https://x402.org/facilitator"
    );

    const hydrated = await service.getOrHydrateServiceByEnsName("chat-agent.eth");

    expect(hydrated).not.toBeNull();
    expect(hydrated?.ensName).toBe("chat-agent.eth");
    expect(hydrated?.ensNode).toBe(namehash("chat-agent.eth"));
    expect(hydrated?.facilitatorUrl).toBe("https://x402.org/facilitator");
  });

  it("rejects mismatched payment requirements", () => {
    const ensService = new EnsService(60_000);
    const service = new ServiceRegistryService(
      ensService,
      new X402Service(),
      "https://x402.org/facilitator"
    );

    const registered = service.registerService({
      ensName: "weather-api.eth",
      owner: "0x3333333333333333333333333333333333333333",
      endpoint: "https://api.example.com/weather",
      paymentScheme: "exact",
      network: "eip155:8453",
    });

    expect(() =>
      service.assertPaymentRequirementsMatchService(registered, {
        scheme: "exact",
        network: "eip155:1",
      })
    ).toThrow("Payment network does not match service registration");
  });
});
