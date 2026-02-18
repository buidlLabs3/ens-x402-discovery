import { createHash } from "node:crypto";
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

export class EnsService {
  private readonly resolverRecords = new Map<string, EnsResolverRecord>();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly cacheTtlMs: number) {}

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
    return `0x${createHash("sha256").update(normalized).digest("hex")}`;
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
    this.cache.set(normalized, {
      record,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return record;
  }

  resolveEnsName(ensName: string): EnsResolverRecord | null {
    const normalized = this.normalizeEnsName(ensName);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.record;
    }

    const record = this.resolverRecords.get(normalized) ?? null;
    this.cache.set(normalized, {
      record,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return record;
  }

  verifyOwnership(ensName: string, ownerAddress: string): boolean {
    const resolved = this.resolveEnsName(ensName);
    if (!resolved) {
      return false;
    }
    return resolved.owner.toLowerCase() === ownerAddress.toLowerCase();
  }
}
