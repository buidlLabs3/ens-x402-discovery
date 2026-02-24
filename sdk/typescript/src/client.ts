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
    const normalizedInput = this.normalizeServiceRegistrationInput(input);
    const response = await fetch(`${this.apiBaseUrl}/api/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedInput),
    });

    const payload = (await response.json()) as ServiceResponsePayload;
    if (!response.ok || !payload.service) {
      throw new Error(payload.error?.message ?? "Failed to register service");
    }

    if (this.normalizeEnsName(payload.service.ensName) !== normalizedInput.ensName) {
      throw new Error(
        `Registration mismatch: expected ensName '${normalizedInput.ensName}', received '${payload.service.ensName}'`
      );
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

  private normalizeServiceRegistrationInput(
    input: ServiceRegistrationRequest
  ): ServiceRegistrationRequest {
    const ensName = this.normalizeEnsName(input.ensName);
    if (!this.validateEnsName(ensName)) {
      throw new Error(`Invalid ENS name: ${input.ensName}`);
    }

    const owner = input.owner.trim();
    if (!ETH_ADDRESS_PATTERN.test(owner)) {
      throw new Error(`Invalid owner address: ${input.owner}`);
    }

    const endpoint = this.normalizeEndpoint(input.endpoint);

    const paymentScheme = input.paymentScheme.trim();
    if (paymentScheme.length === 0) {
      throw new Error("paymentScheme is required");
    }

    const network = input.network.trim();
    if (!CAIP2_PATTERN.test(network)) {
      throw new Error(`Invalid CAIP-2 network: ${input.network}`);
    }

    let capabilities: string[] | undefined;
    if (input.capabilities !== undefined) {
      capabilities = input.capabilities.map((item) => item.trim());
      const hasInvalidCapability = capabilities.some((item) => item.length === 0);
      if (hasInvalidCapability) {
        throw new Error("capabilities must contain non-empty strings");
      }
    }

    let facilitatorUrl: string | undefined;
    if (input.facilitatorUrl !== undefined) {
      facilitatorUrl = this.normalizeUrl(input.facilitatorUrl, "facilitatorUrl");
    }

    return {
      ensName,
      owner,
      endpoint,
      paymentScheme,
      network,
      description: input.description?.trim(),
      capabilities,
      facilitatorUrl,
    };
  }

  private normalizeEndpoint(endpoint: string): string {
    const normalized = endpoint.trim();
    const parsed = this.parseUrl(normalized, "endpoint");
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !isLocal) {
      throw new Error(`Invalid endpoint protocol (https required): ${endpoint}`);
    }
    return parsed.toString();
  }

  private normalizeUrl(value: string, field: string): string {
    const normalized = value.trim();
    const parsed = this.parseUrl(normalized, field);
    return parsed.toString();
  }

  private parseUrl(value: string, field: string): URL {
    try {
      return new URL(value);
    } catch {
      throw new Error(`${field} must be a valid URL`);
    }
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const ENS_NAME_PATTERN = /^(?=.{3,255}$)([a-z0-9-]+\.)+eth$/;
const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const CAIP2_PATTERN = /^[a-z0-9]+:[A-Za-z0-9]+$/;

interface ServiceResponsePayload {
  service?: RegisteredService;
  error?: {
    message?: string;
  };
}
