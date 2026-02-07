# Architecture

## System Overview

ENS x402 Discovery integrates ENS identity with x402 agentic payments to create a discoverable, identity-verified service marketplace.

## Components

### 1. Smart Contracts

#### ENSResolverExtension
- Extends ENS resolver to store x402 service metadata
- Stores: endpoint URL, payment scheme, network, description, capabilities
- Uses ENS resolver's text record system

#### ServiceRegistry
- On-chain registry mapping ENS names to services
- Stores verification proofs
- Enables fast lookup and ownership verification
- Optional reputation/rating system

### 2. Backend API

#### ENS Service
- Resolves ENS names to addresses
- Reads resolver extension data
- Verifies ownership
- Caches resolutions

#### Discovery Service
- Queries service registry
- Filters and searches services
- Validates service data
- Integrates with x402 Bazaar

#### x402 Integration
- Validates x402 endpoints
- Verifies payment requirements
- Integrates with x402 facilitators

### 3. SDKs

#### TypeScript SDK
- ENS name resolution
- Service registration
- Service discovery
- x402 client integration

#### Go SDK
- Similar functionality to TypeScript SDK
- Follows Go best practices
- Compatible with x402 Go SDK

#### Python SDK
- Similar functionality to TypeScript SDK
- Compatible with x402 Python SDK

### 4. Frontend (Minimal)

- Service registration form
- Service discovery/search
- Service details display
- Basic styling

## Data Flow

```
1. Service Registration:
   Service Provider → ENS Resolver Extension → Service Registry → Discovery API

2. Service Discovery:
   Agent → Discovery API → ENS Resolver → Service Registry → x402 Endpoint

3. Payment Flow:
   Agent → x402 Client → x402 Facilitator → Service Provider
```

## Technology Stack

- **Smart Contracts**: Solidity 0.8.x, Hardhat/Foundry
- **Backend**: Node.js, TypeScript, Express.js
- **SDKs**: TypeScript, Go, Python
- **Frontend**: React/Next.js (minimal)
- **Blockchain**: Ethereum (Mainnet + Testnets)
- **ENS**: @ensdomains/ensjs or ethers.js
- **x402**: @x402 packages

## Security Considerations

- Validate all ENS resolutions
- Verify ownership before registration
- Sanitize all inputs
- Use secure random for nonces
- Follow x402 security patterns
- Smart contract security best practices
