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
