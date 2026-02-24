import type {
  DiscoverySdkConfig,
  EnsResolutionResult,
  RegisteredService,
  ServiceDiscoveryFilters,
  ServiceListResponse,
  ServicePaymentVerifyRequest,
  ServicePaymentVerifyResponse,
  ServiceRegistrationRequest,
  X402DiscoveryOptions,
  X402DiscoveryResponse,
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

  async listServices(filters: ServiceDiscoveryFilters = {}): Promise<ServiceListResponse> {
    const queryParams = new URLSearchParams();

    if (filters.network !== undefined) {
      const network = filters.network.trim();
      if (!CAIP2_PATTERN.test(network)) {
        throw new Error(`Invalid CAIP-2 network: ${filters.network}`);
      }
      queryParams.set("network", network);
    }
    if (filters.paymentScheme !== undefined) {
      const paymentScheme = filters.paymentScheme.trim();
      if (paymentScheme.length === 0) {
        throw new Error("paymentScheme must be non-empty");
      }
      queryParams.set("paymentScheme", paymentScheme);
    }
    if (filters.owner !== undefined) {
      const owner = filters.owner.trim();
      if (!ETH_ADDRESS_PATTERN.test(owner)) {
        throw new Error(`Invalid owner address: ${filters.owner}`);
      }
      queryParams.set("owner", owner);
    }
    if (filters.active !== undefined) {
      queryParams.set("active", String(filters.active));
    }

    const query = queryParams.toString();
    const response = await fetch(
      `${this.apiBaseUrl}/api/services${query.length > 0 ? `?${query}` : ""}`
    );
    const payload = (await response.json()) as ServiceListPayload;

    if (!response.ok || !Array.isArray(payload.items)) {
      throw new Error(payload.error?.message ?? "Failed to list services");
    }

    return {
      items: payload.items,
      total: typeof payload.total === "number" ? payload.total : payload.items.length,
    };
  }

  async searchServices(query: string): Promise<ServiceListResponse> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      throw new Error("Search query must be non-empty");
    }

    const response = await fetch(
      `${this.apiBaseUrl}/api/services/search?q=${encodeURIComponent(normalizedQuery)}`
    );
    const payload = (await response.json()) as ServiceListPayload;

    if (!response.ok || !Array.isArray(payload.items)) {
      throw new Error(payload.error?.message ?? "Failed to search services");
    }

    return {
      items: payload.items,
      total: typeof payload.total === "number" ? payload.total : payload.items.length,
    };
  }

  async getX402DiscoverableResources(
    options: X402DiscoveryOptions = {}
  ): Promise<X402DiscoveryResponse> {
    const queryParams = new URLSearchParams();

    if (options.facilitatorUrl !== undefined) {
      queryParams.set(
        "facilitatorUrl",
        this.normalizeUrl(options.facilitatorUrl, "facilitatorUrl")
      );
    }
    if (options.type !== undefined) {
      const type = options.type.trim();
      if (type.length === 0) {
        throw new Error("type must be non-empty");
      }
      queryParams.set("type", type);
    }
    if (options.limit !== undefined) {
      if (!Number.isInteger(options.limit) || options.limit < 0) {
        throw new Error("limit must be a non-negative integer");
      }
      queryParams.set("limit", String(options.limit));
    }
    if (options.offset !== undefined) {
      if (!Number.isInteger(options.offset) || options.offset < 0) {
        throw new Error("offset must be a non-negative integer");
      }
      queryParams.set("offset", String(options.offset));
    }

    const query = queryParams.toString();
    const response = await fetch(
      `${this.apiBaseUrl}/api/x402/discovery/resources${query.length > 0 ? `?${query}` : ""}`
    );
    const payload = (await response.json()) as X402DiscoveryPayload;

    if (!response.ok || !Array.isArray(payload.items) || typeof payload.facilitatorUrl !== "string") {
      throw new Error(payload.error?.message ?? "Failed to fetch x402 discovery resources");
    }

    return {
      facilitatorUrl: payload.facilitatorUrl,
      items: payload.items,
      total: typeof payload.total === "number" ? payload.total : payload.items.length,
    };
  }

  async verifyServicePayment(
    ensName: string,
    request: ServicePaymentVerifyRequest
  ): Promise<ServicePaymentVerifyResponse> {
    const normalizedEnsName = this.normalizeEnsName(ensName);
    if (!this.validateEnsName(normalizedEnsName)) {
      throw new Error(`Invalid ENS name: ${ensName}`);
    }
    if (!isRecord(request.paymentPayload)) {
      throw new Error("paymentPayload must be an object");
    }
    if (!isRecord(request.paymentRequirements)) {
      throw new Error("paymentRequirements must be an object");
    }
    if (request.facilitatorUrl !== undefined) {
      this.normalizeUrl(request.facilitatorUrl, "facilitatorUrl");
    }
    if (request.x402Version !== undefined) {
      if (!Number.isInteger(request.x402Version) || request.x402Version <= 0) {
        throw new Error("x402Version must be a positive integer");
      }
    }

    const response = await fetch(
      `${this.apiBaseUrl}/api/services/${encodeURIComponent(normalizedEnsName)}/payments/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    const payload = (await response.json()) as ServicePaymentVerifyPayload;
    if (!isRecord(payload.verification) || typeof payload.ensName !== "string") {
      throw new Error(payload.error?.message ?? "Failed to verify service payment");
    }

    if (response.status !== 200 && response.status !== 402) {
      throw new Error(payload.error?.message ?? "Failed to verify service payment");
    }

    if (this.normalizeEnsName(payload.ensName) !== normalizedEnsName) {
      throw new Error(
        `Payment verify mismatch: expected ensName '${normalizedEnsName}', received '${payload.ensName}'`
      );
    }

    if (typeof payload.verification.isValid !== "boolean") {
      throw new Error("verification.isValid is missing in payment verification response");
    }

    return {
      ensName: payload.ensName,
      verification: {
        isValid: payload.verification.isValid,
        invalidReason:
          typeof payload.verification.invalidReason === "string"
            ? payload.verification.invalidReason
            : undefined,
        invalidMessage:
          typeof payload.verification.invalidMessage === "string"
            ? payload.verification.invalidMessage
            : undefined,
        payer:
          typeof payload.verification.payer === "string" ? payload.verification.payer : undefined,
        extensions: isRecord(payload.verification.extensions)
          ? payload.verification.extensions
          : undefined,
      },
    };
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

interface ServiceListPayload {
  items?: RegisteredService[];
  total?: number;
  error?: {
    message?: string;
  };
}

interface X402DiscoveryPayload {
  facilitatorUrl?: string;
  items?: Array<Record<string, unknown>>;
  total?: number;
  error?: {
    message?: string;
  };
}

interface ServicePaymentVerifyPayload {
  ensName?: string;
  verification?: {
    isValid: boolean;
    invalidReason?: string;
    invalidMessage?: string;
    payer?: string;
    extensions?: Record<string, unknown>;
  };
  error?: {
    message?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
