import { namehash } from "ethers";
import { AppError } from "../errors";

export interface EnsResolverRecord {
  ensName: string;
  ensNode: string;
  owner: string;
  endpoint?: string;
  paymentScheme?: string;
  network?: string;
  description?: string;
  capabilities?: string[];
}

interface CacheEntry {
  record: EnsResolverRecord | null;
  expiresAt: number;
}

export type EnsResolverReader = (
  ensName: string,
  ensNode: string
) => Promise<EnsResolverRecord | null>;

export class EnsService {
  private readonly resolverRecords = new Map<string, EnsResolverRecord>();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly cacheTtlMs: number,
    private readonly resolverReader?: EnsResolverReader
  ) {}

  normalizeEnsName(ensName: string): string {
    return ensName.trim().toLowerCase();
  }

  validateEnsName(ensName: string): boolean {
    const normalized = this.normalizeEnsName(ensName);
    const ensPattern = /^(?=.{3,255}$)([a-z0-9-]+\.)+eth$/;
    return ensPattern.test(normalized);
  }

  computeEnsNode(ensName: string): string {
    const normalized = this.normalizeEnsName(ensName);
    return namehash(normalized);
  }

  upsertResolverRecord(input: Omit<EnsResolverRecord, "ensNode"> & { ensNode?: string }): EnsResolverRecord {
    if (!this.validateEnsName(input.ensName)) {
      throw new AppError(400, "invalid_ens_name", "Invalid ENS name format", {
        ensName: input.ensName,
      });
    }

    const normalized = this.normalizeEnsName(input.ensName);
    const record: EnsResolverRecord = {
      ...input,
      ensName: normalized,
      ensNode: input.ensNode ?? this.computeEnsNode(normalized),
    };

    this.resolverRecords.set(normalized, record);
    this.cacheRecord(normalized, record);

    return record;
  }

  resolveEnsName(ensName: string): EnsResolverRecord | null {
    const normalized = this.normalizeEnsName(ensName);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.record;
    }

    const record = this.resolverRecords.get(normalized) ?? null;
    this.cacheRecord(normalized, record);

    return record;
  }

  async readResolverExtension(ensName: string): Promise<EnsResolverRecord | null> {
    const normalized = this.normalizeEnsName(ensName);
    if (!this.validateEnsName(normalized)) {
      throw new AppError(400, "invalid_ens_name", "Invalid ENS name format", {
        ensName,
      });
    }

    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now() && cached.record) {
      return cached.record;
    }

    const local = this.resolverRecords.get(normalized);
    if (local) {
      this.cacheRecord(normalized, local);
      return local;
    }

    if (!this.resolverReader) {
      this.cacheRecord(normalized, null);
      return null;
    }

    try {
      const ensNode = this.computeEnsNode(normalized);
      const remoteRecord = await this.resolverReader(normalized, ensNode);
      if (!remoteRecord) {
        this.cacheRecord(normalized, null);
        return null;
      }

      const normalizedRecord: EnsResolverRecord = {
        ...remoteRecord,
        ensName: normalized,
        ensNode,
      };

      this.resolverRecords.set(normalized, normalizedRecord);
      this.cacheRecord(normalized, normalizedRecord);
      return normalizedRecord;
    } catch (error) {
      throw new AppError(
        502,
        "resolver_extension_read_failed",
        "Failed to read ENS resolver extension",
        {
          ensName: normalized,
          reason: error instanceof Error ? error.message : "unknown_error",
        }
      );
    }
  }

  async resolveEnsNameWithFallback(ensName: string): Promise<EnsResolverRecord | null> {
    const local = this.resolveEnsName(ensName);
    if (local) {
      return local;
    }
    return this.readResolverExtension(ensName);
  }

  verifyOwnership(ensName: string, ownerAddress: string): boolean {
    const resolved = this.resolveEnsName(ensName);
    if (!resolved) {
      return false;
    }
    return resolved.owner.toLowerCase() === ownerAddress.toLowerCase();
  }

  private cacheRecord(ensName: string, record: EnsResolverRecord | null): void {
    this.cache.set(ensName, {
      record,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}
