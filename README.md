# ENS x402 Discovery

**ENS identity layer for x402 agentic service discovery.** Enable services to register with ENS names and be discovered by human-readable identities instead of raw URLs.

## Overview

This project integrates [ENS (Ethereum Name Service)](https://ens.domains/) with the [x402 agentic payment protocol](https://github.com/coinbase/x402) to create an identity-verified service discovery layer. Service providers can register their x402-protected endpoints under ENS names, making them discoverable and verifiable by human-readable identities.

## Problem Statement

x402 enables agentic payments, but services are currently discovered by raw URLs. This creates several issues:
- **No identity layer**: Services can't prove ownership or build reputation
- **Hard to remember**: URLs aren't memorable or human-friendly
- **No verification**: Agents can't verify service authenticity before paying
- **Fragmented discovery**: Services exist in silos without unified identity

## Solution

Extend x402's Bazaar discovery with ENS identity, enabling:
- **ENS-Name Service Registration**: Services register under ENS names (e.g., `weather-api.eth`)
- **Identity-Verified Discovery**: Agents discover services by ENS name and verify ownership
- **Unified Service Registry**: Open registry mapping ENS names → x402 endpoints
- **Reputation Building**: Services build verifiable reputation tied to ENS identity

## Architecture

```
┌─────────────┐
│   Agents    │
│  (Clients)  │
└──────┬──────┘
       │
       │ 1. Query: "Find weather services"
       ▼
┌─────────────────┐
│ Discovery API   │
└──────┬──────────┘
       │
       │ 2. Returns: "weather-api.eth"
       ▼
┌─────────────────┐
│  ENS Resolver   │
│   Extension     │
└──────┬──────────┘
       │
       │ 3. Resolves to x402 endpoint + metadata
       ▼
┌─────────────────┐
│ Service Registry│
│   (On-chain)    │
└──────┬──────────┘
       │
       │ 4. Verifies ownership
       ▼
┌─────────────────┐
│  x402 Payment   │
│    Protocol     │
└─────────────────┘
```

## Project Structure

```
ens-x402-discovery/
├── contracts/          # Smart contracts (Solidity)
│   ├── ENSResolverExtension.sol
│   └── ServiceRegistry.sol
├── backend/           # API services (TypeScript)
│   ├── src/
│   │   ├── api/       # API routes
│   │   ├── services/  # Business logic
│   │   └── utils/     # Utilities
│   └── tests/
├── sdk/               # Client SDKs
│   ├── typescript/    # TypeScript SDK
│   ├── go/            # Go SDK
│   └── python/        # Python SDK
├── frontend/          # Simple demo UI (minimal)
├── docs/              # Documentation
└── tests/             # Integration tests
```

## Getting Started

### Prerequisites

- Node.js 18+
- Hardhat or Foundry
- TypeScript
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/buidlLabs3/ens-x402-discovery.git
cd ens-x402-discovery

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build contracts
npm run build:contracts
```

## Roadmap

See [TASKS.md](./TASKS.md) for detailed task breakdown.

### Phase 1: Foundation (Week 1-2)
- Project setup and architecture design

### Phase 2: Smart Contracts (Week 3-5)
- ENS resolver extension
- Service registry contract

### Phase 3: Backend API (Week 6-8)
- Discovery API endpoints
- ENS integration service

### Phase 4: SDK Development (Week 9-11)
- TypeScript, Go, and Python SDKs

### Phase 5: Frontend (Week 12-13)
- Simple demo UI

### Phase 6: Documentation & Polish (Week 14)
- Complete documentation

### Phase 7: Deployment (Week 15-16)
- Mainnet deployment

## Contributing

This project follows progressive development principles:
- Small, focused commits
- Test before committing
- Document as you build
- Follow existing patterns

See [.cursorrules](./.cursorrules) for development guidelines.

## License

[To be determined]

## Links

- [ENS Documentation](https://docs.ens.domains/)
- [x402 Documentation](https://docs.x402.org/)
- [x402 GitHub](https://github.com/coinbase/x402)

## Status

🚧 **Early Development** - This project is in active development.
