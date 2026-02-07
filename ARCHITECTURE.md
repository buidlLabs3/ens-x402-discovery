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

## Directory Structure

### Smart Contracts (`contracts/`)
Contains Solidity smart contracts for ENS x402 Discovery.

**Contracts:**
- `ENSResolverExtension.sol` - Extension to ENS resolver for storing x402 service metadata
- `ServiceRegistry.sol` - On-chain registry mapping ENS names to x402 service endpoints

**Development:**
```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network sepolia
```

### Backend API (`backend/`)
TypeScript/Express.js backend for ENS x402 Discovery.

**Structure:**
```
backend/
├── src/
│   ├── api/          # API routes
│   ├── services/     # Business logic
│   │   ├── ens/      # ENS resolution service
│   │   └── x402/     # x402 integration service
│   └── utils/        # Utilities
└── tests/            # API tests
```

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/services/:ensName` - Get service by ENS name
- `GET /api/services` - List all services
- `POST /api/services` - Register new service
- `GET /api/services/search` - Search services

**Development:**
```bash
# Start dev server
npm run dev

# Run tests
npm test
```

### SDKs (`sdk/`)
Client SDKs for TypeScript, Go, and Python.

### Frontend (`frontend/`)
Minimal demo UI for service registration and discovery.

## Security Considerations

- Validate all ENS resolutions
- Verify ownership before registration
- Sanitize all inputs
- Use secure random for nonces
- Follow x402 security patterns
- Smart contract security best practices
- Never commit private keys or secrets
- Use environment variables for sensitive configuration
