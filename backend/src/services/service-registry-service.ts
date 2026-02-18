import { AppError } from "../errors";
import { type EnsResolverRecord, EnsService } from "./ens-service";
import { X402Service } from "./x402-service";
import {
  type RegisteredService,
  type ServiceListFilters,
  type ServiceRegistrationInput,
} from "../types/service";

const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export class ServiceRegistryService {
  private readonly services = new Map<string, RegisteredService>();

  constructor(
    private readonly ensService: EnsService,
    private readonly x402Service: X402Service,
    private readonly defaultFacilitatorUrl: string
  ) {}

  registerService(input: ServiceRegistrationInput): RegisteredService {
    const normalizedEnsName = this.ensService.normalizeEnsName(input.ensName);
    if (!this.ensService.validateEnsName(normalizedEnsName)) {
      throw new AppError(400, "invalid_ens_name", "Invalid ENS name format", {
        ensName: input.ensName,
      });
    }

    if (!ETH_ADDRESS_PATTERN.test(input.owner)) {
      throw new AppError(400, "invalid_owner_address", "Owner must be a valid EVM address", {
        owner: input.owner,
      });
    }

    const facilitatorUrl = input.facilitatorUrl ?? this.defaultFacilitatorUrl;
    this.x402Service.validate({
      endpoint: input.endpoint,
      paymentScheme: input.paymentScheme,
      network: input.network,
      facilitatorUrl,
    });

    const existing = this.services.get(normalizedEnsName);
    if (existing && existing.owner.toLowerCase() !== input.owner.toLowerCase()) {
      throw new AppError(403, "ownership_mismatch", "Existing service can only be updated by owner", {
        ensName: normalizedEnsName,
      });
    }

    const now = new Date().toISOString();
    const service: RegisteredService = {
      ensName: normalizedEnsName,
      ensNode: this.ensService.computeEnsNode(normalizedEnsName),
      owner: input.owner,
      endpoint: input.endpoint,
      paymentScheme: input.paymentScheme,
      network: input.network,
      description: input.description ?? "",
      capabilities: input.capabilities ?? [],
      facilitatorUrl,
      active: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.services.set(normalizedEnsName, service);
    this.ensService.upsertResolverRecord(this.toResolverRecord(service));
    return service;
  }

  getServiceByEnsName(ensName: string): RegisteredService | null {
    return this.services.get(this.ensService.normalizeEnsName(ensName)) ?? null;
  }

  listServices(filters: ServiceListFilters = {}): RegisteredService[] {
    let results = Array.from(this.services.values());

    if (filters.network) {
      results = results.filter((item) => item.network === filters.network);
    }
    if (filters.paymentScheme) {
      results = results.filter((item) => item.paymentScheme === filters.paymentScheme);
    }
    if (filters.owner) {
      const ownerLower = filters.owner.toLowerCase();
      results = results.filter((item) => item.owner.toLowerCase() === ownerLower);
    }
    if (filters.active !== undefined) {
      results = results.filter((item) => item.active === filters.active);
    }

    return results;
  }

  searchServices(query: string): RegisteredService[] {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return [];
    }

    return this.listServices().filter((item) => {
      if (item.ensName.includes(needle) || item.description.toLowerCase().includes(needle)) {
        return true;
      }
      return item.capabilities.some((capability) => capability.toLowerCase().includes(needle));
    });
  }

  private toResolverRecord(service: RegisteredService): EnsResolverRecord {
    return {
      ensName: service.ensName,
      ensNode: service.ensNode,
      owner: service.owner,
      endpoint: service.endpoint,
      paymentScheme: service.paymentScheme,
      network: service.network,
      description: service.description,
      capabilities: service.capabilities,
    };
  }
}
