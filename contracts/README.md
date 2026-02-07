# Smart Contracts

This directory contains the smart contracts for ENS x402 Discovery.

## Contracts

### ENSResolverExtension.sol
Extension to ENS resolver for storing x402 service metadata.

### ServiceRegistry.sol
On-chain registry mapping ENS names to x402 service endpoints.

## Development

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network sepolia
```
