export interface EnvConfig {
  port: number;
  cacheTtlMs: number;
  defaultFacilitatorUrl: string;
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

export function loadEnv(source: NodeJS.ProcessEnv = process.env): EnvConfig {
  return {
    port: toPositiveNumber(source.PORT, 3000),
    cacheTtlMs: toPositiveNumber(source.CACHE_TTL_MS, 60_000),
    defaultFacilitatorUrl: source.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
  };
}
