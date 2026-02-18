export interface ServiceRegistrationInput {
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

export interface ServiceListFilters {
  network?: string;
  paymentScheme?: string;
  owner?: string;
  active?: boolean;
}
