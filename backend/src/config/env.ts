export interface EnvConfig {
  port: number;
  cacheTtlMs: number;
  defaultFacilitatorUrl: string;
  rpcUrl?: string;
  ensRegistryAddress?: string;
  ensResolverExtensionAddress?: string;
}

function toPositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): EnvConfig {
  return {
    port: toPositiveNumber(source.PORT, 3000),
    cacheTtlMs: toPositiveNumber(source.CACHE_TTL_MS, 60_000),
    defaultFacilitatorUrl: source.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    rpcUrl: toOptionalString(source.JSON_RPC_URL ?? source.SEPOLIA_RPC_URL ?? source.MAINNET_RPC_URL),
    ensRegistryAddress: toOptionalString(source.ENS_REGISTRY_ADDRESS),
    ensResolverExtensionAddress: toOptionalString(source.ENS_RESOLVER_EXTENSION_ADDRESS),
  };
}
