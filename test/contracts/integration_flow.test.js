const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ENS x402 integration flow", function () {
  it("supports resolver + registry flow with ENS ownership transfer", async function () {
    const [ownerA, ownerB] = await ethers.getSigners();
    const node = ethers.id("weather-api.eth");

    const MockENSRegistry = await ethers.getContractFactory("MockENSRegistry");
    const ensRegistry = await MockENSRegistry.deploy();
    await ensRegistry.setOwner(node, ownerA.address);

    const ENSResolverExtension = await ethers.getContractFactory("ENSResolverExtension");
    const resolver = await ENSResolverExtension.deploy(await ensRegistry.getAddress());

    const ServiceRegistry = await ethers.getContractFactory("ServiceRegistry");
    const registry = await ServiceRegistry.deploy(await ensRegistry.getAddress());

    await resolver.connect(ownerA).setX402Endpoint(
      node,
      "https://api.example.com/weather/v1",
      "exact",
      "eip155:8453",
      "Weather API v1",
      "{\"capabilities\":[\"current_weather\"]}"
    );

    await registry.connect(ownerA).registerService(
      node,
      "weather-api.eth",
      "https://api.example.com/weather/v1",
      "exact",
      "eip155:8453",
      "Weather API v1",
      "{\"capabilities\":[\"current_weather\"]}"
    );

    const resolverDataV1 = await resolver.getX402Endpoint(node);
    const registryDataV1 = await registry.getService(node);
    expect(resolverDataV1.endpoint).to.equal(registryDataV1.endpoint);
    expect(registryDataV1.owner).to.equal(ownerA.address);

    await ensRegistry.setOwner(node, ownerB.address);

    await expect(
      resolver.connect(ownerA).setX402Endpoint(
        node,
        "https://api.example.com/weather/v2",
        "exact",
        "eip155:8453",
        "Weather API v2",
        "{}"
      )
    )
      .to.be.revertedWithCustomError(resolver, "NotNodeOwner")
      .withArgs(node, ownerA.address);

    await expect(
      registry.connect(ownerA).registerService(
        node,
        "weather-api.eth",
        "https://api.example.com/weather/v2",
        "exact",
        "eip155:8453",
        "Weather API v2",
        "{}"
      )
    )
      .to.be.revertedWithCustomError(registry, "NotNodeOwner")
      .withArgs(node, ownerA.address);

    await resolver.connect(ownerB).setX402Endpoint(
      node,
      "https://api.example.com/weather/v2",
      "exact",
      "eip155:8453",
      "Weather API v2",
      "{\"capabilities\":[\"current_weather\",\"forecast\"]}"
    );

    await registry.connect(ownerB).registerService(
      node,
      "weather-api.eth",
      "https://api.example.com/weather/v2",
      "exact",
      "eip155:8453",
      "Weather API v2",
      "{\"capabilities\":[\"current_weather\",\"forecast\"]}"
    );

    const resolverDataV2 = await resolver.getX402Endpoint(node);
    const registryDataV2 = await registry.getService(node);
    expect(resolverDataV2.endpoint).to.equal("https://api.example.com/weather/v2");
    expect(registryDataV2.endpoint).to.equal("https://api.example.com/weather/v2");
    expect(registryDataV2.owner).to.equal(ownerB.address);
  });
});
