# Backend API

TypeScript/Express.js backend for ENS x402 Discovery.

## Structure

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

## Development

```bash
# Start dev server
npm run dev

# Run tests
npm test
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/services/:ensName` - Get service by ENS name
- `GET /api/services` - List all services
- `POST /api/services` - Register new service
- `GET /api/services/search` - Search services
