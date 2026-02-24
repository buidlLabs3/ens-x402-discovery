export interface DiscoverySdkConfig {
  apiBaseUrl: string;
}

export interface EnsResolutionResult {
  ensName: string;
  ensNode: string;
  service: RegisteredService;
}

export interface ServiceRegistrationRequest {
  ensName: string;
  owner: string;
  endpoint: string;
  paymentScheme: string;
  network: string;
  description?: string;
  capabilities?: string[];
  facilitatorUrl?: string;
}

export interface ServiceDiscoveryFilters {
  network?: string;
  paymentScheme?: string;
  owner?: string;
  active?: boolean;
}

export interface ServiceListResponse {
  items: RegisteredService[];
  total: number;
}

export interface X402DiscoveryOptions {
  facilitatorUrl?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface X402DiscoveryResponse {
  facilitatorUrl: string;
  items: Array<Record<string, unknown>>;
  total: number;
}

export interface ServicePaymentVerifyRequest {
  paymentPayload: Record<string, unknown>;
  paymentRequirements: Record<string, unknown>;
  facilitatorUrl?: string;
  x402Version?: number;
}

export interface ServicePaymentVerification {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
  extensions?: Record<string, unknown>;
}

export interface ServicePaymentVerifyResponse {
  ensName: string;
  verification: ServicePaymentVerification;
}

export interface RegisteredService {
  ensName: string;
  ensNode: string;
  owner: string;
  endpoint: string;
  paymentScheme: string;
  network: string;
  description: string;
  capabilities: string[];
  facilitatorUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
