const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ENSResolverExtension", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const node = ethers.id("weather-api.eth");

    const MockENSRegistry = await ethers.getContractFactory("MockENSRegistry");
    const registry = await MockENSRegistry.deploy();
    await registry.setOwner(node, owner.address);

    const ENSResolverExtension = await ethers.getContractFactory("ENSResolverExtension");
    const resolver = await ENSResolverExtension.deploy(await registry.getAddress());

    return { owner, other, node, registry, resolver };
  }

  it("stores metadata when ENS node owner sets endpoint", async function () {
    const { owner, node, resolver } = await deployFixture();

    await resolver.connect(owner).setX402Endpoint(
      node,
      "https://api.example.com/weather",
      "exact",
      "eip155:8453",
      "Weather service",
      "{\"capabilities\":[\"current_weather\"]}"
    );

    const stored = await resolver.getX402Endpoint(node);
    expect(stored.endpoint).to.equal("https://api.example.com/weather");
    expect(stored.paymentScheme).to.equal("exact");
    expect(stored.network).to.equal("eip155:8453");
    expect(stored.description).to.equal("Weather service");
    expect(stored.capabilitiesJson).to.equal("{\"capabilities\":[\"current_weather\"]}");
    expect(stored.updatedAt).to.be.gt(0);
  });

  it("reverts when non-owner tries to set endpoint", async function () {
    const { other, node, resolver } = await deployFixture();

    await expect(
      resolver.connect(other).setX402Endpoint(
        node,
        "https://api.example.com/weather",
        "exact",
        "eip155:8453",
        "Weather service",
        "{}"
      )
    )
      .to.be.revertedWithCustomError(resolver, "NotNodeOwner")
      .withArgs(node, other.address);
  });

  it("reverts when endpoint is empty", async function () {
    const { owner, node, resolver } = await deployFixture();

    await expect(
      resolver.connect(owner).setX402Endpoint(node, "", "exact", "eip155:8453", "Weather service", "{}")
    ).to.be.revertedWithCustomError(resolver, "EmptyEndpoint");
  });

  it("clears metadata for ENS owner", async function () {
    const { owner, node, resolver } = await deployFixture();

    await resolver.connect(owner).setX402Endpoint(
      node,
      "https://api.example.com/weather",
      "exact",
      "eip155:8453",
      "Weather service",
      "{}"
    );

    await resolver.connect(owner).clearX402Endpoint(node);
    const stored = await resolver.getX402Endpoint(node);
    expect(stored.endpoint).to.equal("");
    expect(stored.updatedAt).to.equal(0n);
  });
});
