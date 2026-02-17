# ENS x402 Discovery Technical Specification (Phase 1)

Last updated: 2026-02-17

## 1. Scope

This specification defines the Phase 1 baseline for ENS x402 Discovery:

- project setup and scaffolding
- ENS and x402 discovery research outcomes
- initial smart contract architecture
- initial backend API architecture

Out of scope for Phase 1:

- production-ready contract logic
- full ENS on-chain resolver integration
- full x402 payment verification flow

## 2. Research Summary

### 2.1 ENS Resolver and Extension Patterns

Key findings used in this design:

- ENS name resolution follows registry -> resolver indirection. A name (node/namehash) maps to a resolver contract via the ENS registry.
- ENS requires proper name normalization and hashing before on-chain lookup.
- Resolver contracts are interface-driven (EIP-165 style), which enables capability checks before reads/writes.
- Public Resolver supports text records, which are suitable for lightweight service metadata pointers.

Design implication:

- we do not hardcode service metadata only in one place
- we support two data paths:
  - resolver text records for canonical ENS-owned metadata
  - service registry contract for indexed discovery/search and pagination

### 2.2 x402 Bazaar Discovery Review

Key findings used in this design:

- x402 discovery uses facilitator discovery endpoint semantics (`GET /discovery/resources`) with pagination/filtering.
- discovery metadata is extension-based (`bazaar`) and carried as structured `info` + `schema`.
- discovered resources include endpoint, x402 version, accepted payment requirements, metadata, and last-updated time.

Design implication:

- ENS x402 Discovery backend must be able to map ENS identity to x402-compatible discovery records
- API responses should stay compatible with Bazaar-style discovery objects when possible

## 3. Architecture Decisions

## 3.1 On-chain Components

### ENSResolverExtension

Purpose:

- store and read x402 endpoint metadata keyed by ENS node
- enforce write permissions using ENS ownership checks

Core fields:

- endpoint URL
- payment scheme
- network
- description
- capabilities (JSON string in phase 1 scaffold)
- updated timestamp

### ServiceRegistry

Purpose:

- maintain discoverable index for ENS services
- support pagination and filtering patterns needed by API layer
- maintain owner-bound mutable records

Core fields:

- `ensNode`, `ensName`
- endpoint + x402 payment metadata
- owner
- active flag
- updated timestamp

## 3.2 Backend Components

### API Layer

Baseline phase 1 route:

- `GET /health`

Target phase 3 routes (locked in now for structure):

- `GET /api/services/:ensName`
- `GET /api/services`
- `POST /api/services`
- `GET /api/services/search`

### Services Layer

Planned modules:

- `ensService`: normalize names, resolve ownership, read resolver data
- `registryService`: read/write service records
- `x402Service`: validate x402 endpoint compatibility and discovery metadata

### Utils Layer

Planned responsibilities:

- environment loading and validation
- request validation helpers
- error mapping helpers

## 4. Data Model (API-facing)

Phase 1 canonical service model:

```json
{
  "ensName": "weather-api.eth",
  "ensNode": "0x...",
  "owner": "0x...",
  "endpoint": "https://example.com/weather",
  "x402": {
    "scheme": "exact",
    "network": "eip155:8453",
    "facilitator": "https://x402.org/facilitator"
  },
  "description": "Weather API with x402 payments",
  "capabilities": ["current_weather", "forecast"],
  "status": "active",
  "updatedAt": "2026-02-17T00:00:00.000Z"
}
```

Compatibility target:

- keep response shape adaptable to Bazaar discovery list outputs:
  - `resource`
  - `accepts`
  - `metadata`
  - `lastUpdated`

## 5. Security and Validation Baseline

- ENS write operations must validate ownership before mutation.
- ENS names must be normalized before lookup.
- Endpoint URLs must be validated and restricted to safe schemes (`https` by default policy).
- Untrusted metadata must be sanitized before storage and API response.
- Private keys and RPC URLs must be environment-driven only.

## 6. Phase 1 Deliverables

Implemented in this phase:

- repository structure scaffold across backend/contracts/docs/sdk/frontend/tests
- TypeScript + lint baseline
- Hardhat baseline (`hardhat.config.js`, contracts scaffold, contract tests scaffold)
- Jest baseline (`jest.config.cjs`, backend smoke test)
- CI baseline (`.github/workflows/ci.yml`)
- environment template (`.env.example`)

## 7. Open Questions for Phase 2

- Should capabilities be stored as a structured array on-chain or compact JSON string?
- Should ENS resolver text records be treated as source of truth or mirrored-only metadata?
- Should reputation live in `ServiceRegistry` or an external attestations system?
- How strict should x402 endpoint validation be at registration time vs discover time?

## 8. References

- ENS resolution overview: https://docs.ens.domains/resolution/
- ENS name processing: https://docs.ens.domains/resolution/names/
- ENS public resolver docs: https://docs.ens.domains/resolvers/public/
- x402 Bazaar docs: https://docs.cdp.coinbase.com/x402/docs/extensions/bazaar
- x402 v2 discovery spec (local repo): `x402/specs/x402-specification-v2.md`
