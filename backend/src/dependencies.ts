import type { EnvConfig } from "./config/env";
import { EnsService } from "./services/ens-service";
import { ServiceRegistryService } from "./services/service-registry-service";
import { X402Service } from "./services/x402-service";

export interface Dependencies {
  ensService: EnsService;
  x402Service: X402Service;
  serviceRegistryService: ServiceRegistryService;
}

export function createDependencies(env: EnvConfig): Dependencies {
  const ensService = new EnsService(env.cacheTtlMs);
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
