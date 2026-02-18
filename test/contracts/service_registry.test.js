const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ServiceRegistry", function () {
  async function deployFixture() {
    const [ownerA, ownerB, other] = await ethers.getSigners();
    const nodeA = ethers.id("weather-api.eth");
    const nodeB = ethers.id("news-api.eth");

    const MockENSRegistry = await ethers.getContractFactory("MockENSRegistry");
    const registry = await MockENSRegistry.deploy();
    await registry.setOwner(nodeA, ownerA.address);
    await registry.setOwner(nodeB, ownerB.address);

    const ServiceRegistry = await ethers.getContractFactory("ServiceRegistry");
    const serviceRegistry = await ServiceRegistry.deploy(await registry.getAddress());

    return { ownerA, ownerB, other, nodeA, nodeB, registry, serviceRegistry };
  }

  async function registerService(serviceRegistry, caller, node, ensName, endpoint) {
    await serviceRegistry.connect(caller).registerService(
      node,
      ensName,
      endpoint,
      "exact",
      "eip155:8453",
      "API description",
      "{\"capabilities\":[\"query\"]}"
    );
  }

  it("registers service for ENS owner", async function () {
    const { ownerA, nodeA, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather"
    );

    const service = await serviceRegistry.getService(nodeA);
    expect(service.ensName).to.equal("weather-api.eth");
    expect(service.endpoint).to.equal("https://api.example.com/weather");
    expect(service.owner).to.equal(ownerA.address);
    expect(service.active).to.equal(true);
  });

  it("reverts when caller does not own ENS node", async function () {
    const { other, nodeA, serviceRegistry } = await deployFixture();

    await expect(
      registerService(
        serviceRegistry,
        other,
        nodeA,
        "weather-api.eth",
        "https://api.example.com/weather"
      )
    )
      .to.be.revertedWithCustomError(serviceRegistry, "NotNodeOwner")
      .withArgs(nodeA, other.address);
  });

  it("updates existing service and supports ENS ownership transfer", async function () {
    const { ownerA, ownerB, nodeA, registry, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather/v1"
    );

    await registry.setOwner(nodeA, ownerB.address);

    await registerService(
      serviceRegistry,
      ownerB,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather/v2"
    );

    const service = await serviceRegistry.getService(nodeA);
    expect(service.endpoint).to.equal("https://api.example.com/weather/v2");
    expect(service.owner).to.equal(ownerB.address);
  });

  it("deactivates only if ENS owner calls", async function () {
    const { ownerA, other, nodeA, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather"
    );

    await expect(serviceRegistry.connect(other).deactivateService(nodeA))
      .to.be.revertedWithCustomError(serviceRegistry, "NotNodeOwner")
      .withArgs(nodeA, other.address);

    await serviceRegistry.connect(ownerA).deactivateService(nodeA);
    const service = await serviceRegistry.getService(nodeA);
    expect(service.active).to.equal(false);
  });

  it("lists only active services with pagination", async function () {
    const { ownerA, ownerB, nodeA, nodeB, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather"
    );
    await registerService(serviceRegistry, ownerB, nodeB, "news-api.eth", "https://api.example.com/news");

    await serviceRegistry.connect(ownerA).deactivateService(nodeA);

    const [items, total] = await serviceRegistry.listServices(0, 10);
    expect(total).to.equal(1n);
    expect(items.length).to.equal(1);
    expect(items[0].ensName).to.equal("news-api.eth");

    const [paged, pagedTotal] = await serviceRegistry.listServices(1, 10);
    expect(pagedTotal).to.equal(1n);
    expect(paged.length).to.equal(0);
  });

  it("supports one rating per rater and computes average bps", async function () {
    const { ownerA, ownerB, other, nodeA, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather"
    );

    await serviceRegistry.connect(ownerB).rateService(nodeA, 5);
    await serviceRegistry.connect(other).rateService(nodeA, 3);

    await expect(serviceRegistry.connect(other).rateService(nodeA, 4))
      .to.be.revertedWithCustomError(serviceRegistry, "AlreadyRated")
      .withArgs(nodeA, other.address);

    const service = await serviceRegistry.getService(nodeA);
    expect(service.ratingCount).to.equal(2n);
    expect(service.totalRating).to.equal(8n);

    const avgBps = await serviceRegistry.getAverageRatingBps(nodeA);
    expect(avgBps).to.equal(8000n);
  });

  it("rejects invalid rating values", async function () {
    const { ownerA, ownerB, nodeA, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather"
    );

    await expect(serviceRegistry.connect(ownerB).rateService(nodeA, 0))
      .to.be.revertedWithCustomError(serviceRegistry, "InvalidRating")
      .withArgs(0);

    await expect(serviceRegistry.connect(ownerB).rateService(nodeA, 6))
      .to.be.revertedWithCustomError(serviceRegistry, "InvalidRating")
      .withArgs(6);
  });

  it("tracks active service count through register/deactivate/reactivate", async function () {
    const { ownerA, nodeA, serviceRegistry } = await deployFixture();

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather"
    );
    expect(await serviceRegistry.getActiveServiceCount()).to.equal(1n);

    await serviceRegistry.connect(ownerA).deactivateService(nodeA);
    expect(await serviceRegistry.getActiveServiceCount()).to.equal(0n);

    await registerService(
      serviceRegistry,
      ownerA,
      nodeA,
      "weather-api.eth",
      "https://api.example.com/weather-v2"
    );
    expect(await serviceRegistry.getActiveServiceCount()).to.equal(1n);
  });
});
