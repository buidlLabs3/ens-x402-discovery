#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const { ContractFactory, JsonRpcProvider, Wallet, NonceManager, namehash } = require("ethers");

const REPO_ROOT = path.resolve(__dirname, "..");
const HARDHAT_HOST = "127.0.0.1";
const HARDHAT_PORT = 8545;
const HARDHAT_RPC_URL = `http://${HARDHAT_HOST}:${HARDHAT_PORT}`;
const BACKEND_PORT = 4010;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FACILITATOR_PORT = 4021;
const FACILITATOR_URL = `http://127.0.0.1:${FACILITATOR_PORT}`;
const HARDHAT_DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DRY_RUN = process.argv.includes("--dry-run");

let hardhatNodeProcess;
let backendProcess;
let facilitatorServer;

main()
  .then(() => {
    log("Local E2E flow completed successfully.");
  })
  .catch((error) => {
    console.error(`[e2e] FAILED: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdown();
  });

async function main() {
  if (DRY_RUN) {
    log("Dry run mode enabled; no servers will be started.");
    return;
  }

  log("Compiling contracts...");
  await runCommand("npx", ["hardhat", "compile"]);

  log("Starting local Hardhat node...");
  hardhatNodeProcess = spawnProcess("npx", [
    "hardhat",
    "node",
    "--hostname",
    HARDHAT_HOST,
    "--port",
    String(HARDHAT_PORT),
  ], {
    stdio: "ignore",
  });
  await waitForJsonRpc(HARDHAT_RPC_URL, 45_000);

  log("Deploying contracts and seeding ENS test record...");
  const deployment = await deployAndSeedContracts();

  log("Starting mock x402 facilitator...");
  facilitatorServer = await startMockFacilitator(FACILITATOR_PORT, deployment.endpoint);

  log("Starting backend API...");
  backendProcess = spawnProcess("npx", ["tsx", "backend/src/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(BACKEND_PORT),
      CACHE_TTL_MS: "60000",
      JSON_RPC_URL: HARDHAT_RPC_URL,
      ENS_REGISTRY_ADDRESS: deployment.ensRegistryAddress,
      ENS_RESOLVER_EXTENSION_ADDRESS: deployment.resolverExtensionAddress,
      X402_FACILITATOR_URL: FACILITATOR_URL,
    },
  });
  await waitForHttpOk(`${BACKEND_URL}/health`, 30_000);

  log("Running end-to-end API checks...");
  await runE2eChecks({
    ensName: deployment.ensName,
    endpoint: deployment.endpoint,
    ownerAddress: deployment.ownerAddress,
  });
}

async function deployAndSeedContracts() {
  const provider = new JsonRpcProvider(HARDHAT_RPC_URL);
  const ownerWallet = new Wallet(HARDHAT_DEFAULT_PRIVATE_KEY, provider);
  const ownerSigner = new NonceManager(ownerWallet);
  const ownerAddress = await ownerSigner.getAddress();

  const mockEnsArtifact = readArtifact(
    "contracts/mocks/MockENSRegistry.sol",
    "MockENSRegistry"
  );
  const resolverArtifact = readArtifact("contracts/ENSResolverExtension.sol", "ENSResolverExtension");
  const serviceRegistryArtifact = readArtifact("contracts/ServiceRegistry.sol", "ServiceRegistry");

  const mockEnsFactory = new ContractFactory(
    mockEnsArtifact.abi,
    mockEnsArtifact.bytecode,
    ownerSigner
  );
  const mockEns = await mockEnsFactory.deploy();
  await mockEns.waitForDeployment();

  const resolverFactory = new ContractFactory(
    resolverArtifact.abi,
    resolverArtifact.bytecode,
    ownerSigner
  );
  const resolver = await resolverFactory.deploy(await mockEns.getAddress());
  await resolver.waitForDeployment();

  const registryFactory = new ContractFactory(
    serviceRegistryArtifact.abi,
    serviceRegistryArtifact.bytecode,
    ownerSigner
  );
  const serviceRegistry = await registryFactory.deploy(await mockEns.getAddress());
  await serviceRegistry.waitForDeployment();

  const ensName = "weather-api.eth";
  const ensNode = namehash(ensName);
  const endpoint = "https://api.example.com/weather/v1";

  await waitForTransaction(mockEns.setOwner(ensNode, ownerAddress));
  await waitForTransaction(
    resolver.setX402Endpoint(
      ensNode,
      endpoint,
      "exact",
      "eip155:8453",
      "Weather API",
      "[\"current_weather\",\"forecast\"]"
    )
  );
  await waitForTransaction(
    serviceRegistry.registerService(
      ensNode,
      ensName,
      endpoint,
      "exact",
      "eip155:8453",
      "Weather API",
      "[\"current_weather\",\"forecast\"]"
    )
  );

    return {
      ensName,
      endpoint,
      ownerAddress,
      ensRegistryAddress: await mockEns.getAddress(),
    resolverExtensionAddress: await resolver.getAddress(),
    serviceRegistryAddress: await serviceRegistry.getAddress(),
  };
}

async function runE2eChecks({ ensName, endpoint, ownerAddress }) {
  const serviceResponse = await requestJson("GET", `${BACKEND_URL}/api/services/${ensName}`);
  assertStatus(serviceResponse, 200, "service lookup by ENS name");
  assert(serviceResponse.body?.service?.ensName === ensName, "ENS lookup returned wrong ensName");
  assert(serviceResponse.body?.service?.endpoint === endpoint, "ENS lookup returned wrong endpoint");
  assert(
    normalizeAddress(serviceResponse.body?.service?.owner) === normalizeAddress(ownerAddress),
    "ENS lookup returned wrong owner"
  );

  const registerResponse = await requestJson("POST", `${BACKEND_URL}/api/services`, {
    ensName: "chat-agent.eth",
    owner: ownerAddress,
    endpoint: "https://api.example.com/chat",
    paymentScheme: "exact",
    network: "eip155:8453",
    description: "Chat API",
    capabilities: ["chat"],
  });
  assertStatus(registerResponse, 201, "service registration");

  const searchResponse = await requestJson("GET", `${BACKEND_URL}/api/services/search?q=chat`);
  assertStatus(searchResponse, 200, "service search");
  const hasChatService = Array.isArray(searchResponse.body?.items)
    ? searchResponse.body.items.some((item) => item?.ensName === "chat-agent.eth")
    : false;
  assert(hasChatService, "search response did not include chat-agent.eth");

  const discoveryResponse = await requestJson(
    "GET",
    `${BACKEND_URL}/api/x402/discovery/resources?facilitatorUrl=${encodeURIComponent(FACILITATOR_URL)}&type=http`
  );
  assertStatus(discoveryResponse, 200, "x402 bazaar discovery");
  assert(
    Array.isArray(discoveryResponse.body?.items) && discoveryResponse.body.items.length > 0,
    "x402 bazaar discovery returned empty items"
  );

  const verifyInvalidResponse = await requestJson(
    "POST",
    `${BACKEND_URL}/api/services/${ensName}/payments/verify`,
    {
      paymentPayload: {
        x402Version: 2,
        signature: "invalid",
      },
      paymentRequirements: {
        scheme: "exact",
        network: "eip155:8453",
        resource: endpoint,
      },
    }
  );
  assertStatus(verifyInvalidResponse, 402, "payment verify (invalid)");
  assert(
    verifyInvalidResponse.body?.verification?.invalidReason === "signature_invalid",
    "invalid payment reason mismatch"
  );

  const verifyValidResponse = await requestJson(
    "POST",
    `${BACKEND_URL}/api/services/${ensName}/payments/verify`,
    {
      paymentPayload: {
        x402Version: 2,
        signature: "ok",
      },
      paymentRequirements: {
        scheme: "exact",
        network: "eip155:8453",
        resource: endpoint,
      },
    }
  );
  assertStatus(verifyValidResponse, 200, "payment verify (valid)");
  assert(verifyValidResponse.body?.verification?.isValid === true, "valid payment check failed");
}

function readArtifact(contractPath, contractName) {
  const artifactPath = path.join(
    REPO_ROOT,
    "artifacts",
    contractPath,
    `${contractName}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && signal === null) {
      console.error(`[e2e] process exited with code ${code}: ${command} ${args.join(" ")}`);
    }
  });

  return child;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}`));
    });
  });
}

async function startMockFacilitator(port, resourceEndpoint) {
  const server = http.createServer(async (req, res) => {
    if (req.url && req.method === "GET" && req.url.startsWith("/discovery/resources")) {
      return sendJson(res, 200, {
        items: [
          {
            resource: resourceEndpoint,
            accepts: [
              {
                scheme: "exact",
                network: "eip155:8453",
                resource: resourceEndpoint,
              },
            ],
            x402Version: 2,
          },
        ],
        total: 1,
      });
    }

    if (req.url === "/verify" && req.method === "POST") {
      const body = await readRequestBody(req);
      const signature = body?.paymentPayload?.signature;
      if (signature === "ok") {
        return sendJson(res, 200, {
          isValid: true,
          payer: "0x0000000000000000000000000000000000000000",
        });
      }
      return sendJson(res, 402, {
        isValid: false,
        invalidReason: "signature_invalid",
      });
    }

    return sendJson(res, 404, {
      error: "not_found",
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return server;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (raw.trim().length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function waitForJsonRpc(rpcUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for JSON-RPC: ${rpcUrl}`);
}

async function waitForHttpOk(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for HTTP endpoint: ${url}`);
}

async function requestJson(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  return {
    status: response.status,
    body: parsed,
    rawText: text,
  };
}

function assertStatus(result, expectedStatus, step) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${step} failed: expected HTTP ${expectedStatus}, got ${result.status}. body=${result.rawText}`
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeAddress(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

async function waitForTransaction(txPromise) {
  const tx = await txPromise;
  await tx.wait();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown() {
  if (facilitatorServer) {
    await new Promise((resolve) => facilitatorServer.close(resolve));
  }
  await stopProcess(backendProcess);
  await stopProcess(hardhatNodeProcess);
}

function stopProcess(proc) {
  if (!proc || proc.killed) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!proc.killed) {
        proc.kill("SIGKILL");
      }
    }, 3_000);

    proc.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    proc.kill("SIGTERM");
  });
}

function log(message) {
  console.log(`[e2e] ${message}`);
}
