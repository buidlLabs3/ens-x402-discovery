import type { EnvConfig } from "./config/env";
import { Contract, JsonRpcProvider } from "ethers";
import { type EnsResolverReader, EnsService } from "./services/ens-service";
import { ServiceRegistryService } from "./services/service-registry-service";
import { X402Service } from "./services/x402-service";

export interface Dependencies {
  ensService: EnsService;
  x402Service: X402Service;
  serviceRegistryService: ServiceRegistryService;
}

const ENS_RESOLVER_EXTENSION_ABI = [
  "function getX402Endpoint(bytes32 node) view returns ((string endpoint,string paymentScheme,string network,string description,string capabilitiesJson,uint256 updatedAt))",
  "function ensRegistry() view returns (address)",
];

const ENS_REGISTRY_ABI = ["function owner(bytes32 node) view returns (address)"];

interface ResolverMetadataResult {
  endpoint: string;
  paymentScheme: string;
  network: string;
  description: string;
  capabilitiesJson: string;
}

function parseCapabilitiesJson(value: string): string[] {
  if (value.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch {
    return [];
  }
}

function createResolverReader(env: EnvConfig): EnsResolverReader | undefined {
  if (!env.rpcUrl || !env.ensResolverExtensionAddress) {
    return undefined;
  }

  const provider = new JsonRpcProvider(env.rpcUrl);
  const resolverExtension = new Contract(
    env.ensResolverExtensionAddress,
    ENS_RESOLVER_EXTENSION_ABI,
    provider
  );
  const configuredEnsRegistry =
    env.ensRegistryAddress === undefined
      ? undefined
      : new Contract(env.ensRegistryAddress, ENS_REGISTRY_ABI, provider);

  let discoveredEnsRegistry: Contract | undefined;
  const getEnsRegistryContract = async (): Promise<Contract> => {
    if (configuredEnsRegistry) {
      return configuredEnsRegistry;
    }
    if (!discoveredEnsRegistry) {
      const discoveredAddress = (await resolverExtension.ensRegistry()) as string;
      discoveredEnsRegistry = new Contract(discoveredAddress, ENS_REGISTRY_ABI, provider);
    }
    return discoveredEnsRegistry;
  };

  return async (ensName, ensNode) => {
    const metadata = (await resolverExtension.getX402Endpoint(ensNode)) as ResolverMetadataResult;
    if (metadata.endpoint.trim().length === 0) {
      return null;
    }

    const ensRegistry = await getEnsRegistryContract();
    const owner = (await ensRegistry.owner(ensNode)) as string;

    return {
      ensName,
      ensNode,
      owner,
      endpoint: metadata.endpoint,
      paymentScheme: metadata.paymentScheme,
      network: metadata.network,
      description: metadata.description,
      capabilities: parseCapabilitiesJson(metadata.capabilitiesJson),
    };
  };
}

export function createDependencies(env: EnvConfig): Dependencies {
  const resolverReader = createResolverReader(env);
  const ensService = new EnsService(env.cacheTtlMs, resolverReader);
  const x402Service = new X402Service();
  const serviceRegistryService = new ServiceRegistryService(
    ensService,
    x402Service,
    env.defaultFacilitatorUrl
  );

  return {
    ensService,
    x402Service,
    serviceRegistryService,
  };
}
