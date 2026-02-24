import type {
  DiscoverySdkConfig,
  EnsResolutionResult,
  RegisteredService,
  ServiceRegistrationRequest,
} from "./types";
import { namehash } from "ethers";

export class EnsX402DiscoveryClient {
  private readonly apiBaseUrl: string;

  constructor(config: DiscoverySdkConfig) {
    this.apiBaseUrl = stripTrailingSlash(config.apiBaseUrl);
  }

  normalizeEnsName(ensName: string): string {
    return ensName.trim().toLowerCase();
  }

  validateEnsName(ensName: string): boolean {
    const normalized = this.normalizeEnsName(ensName);
    return ENS_NAME_PATTERN.test(normalized);
  }

  computeEnsNode(ensName: string): string {
    const normalized = this.normalizeEnsName(ensName);
    if (!this.validateEnsName(normalized)) {
      throw new Error(`Invalid ENS name: ${ensName}`);
    }
    return namehash(normalized);
  }

  async resolveEnsName(ensName: string): Promise<EnsResolutionResult> {
    const normalized = this.normalizeEnsName(ensName);
    if (!this.validateEnsName(normalized)) {
      throw new Error(`Invalid ENS name: ${ensName}`);
    }

    const expectedNode = this.computeEnsNode(normalized);
    const service = await this.fetchServiceByEnsName(normalized);

    if (this.normalizeEnsName(service.ensName) !== normalized) {
      throw new Error(
        `Resolver mismatch: expected ensName '${normalized}', received '${service.ensName}'`
      );
    }
    if (service.ensNode.toLowerCase() !== expectedNode.toLowerCase()) {
      throw new Error(
        `Resolver mismatch: expected ensNode '${expectedNode}', received '${service.ensNode}'`
      );
    }

    return {
      ensName: normalized,
      ensNode: expectedNode,
      service,
    };
  }

  async getServiceByEnsName(ensName: string): Promise<RegisteredService> {
    const resolved = await this.resolveEnsName(ensName);
    return resolved.service;
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

  private async fetchServiceByEnsName(ensName: string): Promise<RegisteredService> {
    const response = await fetch(`${this.apiBaseUrl}/api/services/${encodeURIComponent(ensName)}`);
    const payload = (await response.json()) as ServiceResponsePayload;

    if (!response.ok || !payload.service) {
      throw new Error(payload.error?.message ?? `Failed to fetch service for ENS name: ${ensName}`);
    }

    return payload.service;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const ENS_NAME_PATTERN = /^(?=.{3,255}$)([a-z0-9-]+\.)+eth$/;

interface ServiceResponsePayload {
  service?: RegisteredService;
  error?: {
    message?: string;
  };
}
