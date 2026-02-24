import type {
  DiscoverySdkConfig,
  RegisteredService,
  ServiceRegistrationRequest,
} from "./types";

export class EnsX402DiscoveryClient {
  private readonly apiBaseUrl: string;

  constructor(config: DiscoverySdkConfig) {
    this.apiBaseUrl = stripTrailingSlash(config.apiBaseUrl);
  }

  async getServiceByEnsName(ensName: string): Promise<RegisteredService> {
    const response = await fetch(`${this.apiBaseUrl}/api/services/${encodeURIComponent(ensName)}`);
    const payload = (await response.json()) as { service?: RegisteredService; error?: { message?: string } };

    if (!response.ok || !payload.service) {
      throw new Error(payload.error?.message ?? `Failed to fetch service for ENS name: ${ensName}`);
    }

    return payload.service;
  }

  async registerService(input: ServiceRegistrationRequest): Promise<RegisteredService> {
    const response = await fetch(`${this.apiBaseUrl}/api/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as { service?: RegisteredService; error?: { message?: string } };
    if (!response.ok || !payload.service) {
      throw new Error(payload.error?.message ?? "Failed to register service");
    }

    return payload.service;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
