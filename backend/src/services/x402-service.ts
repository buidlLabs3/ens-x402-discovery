import { AppError } from "../errors";

export interface X402ValidationInput {
  endpoint: string;
  paymentScheme: string;
  network: string;
  facilitatorUrl: string;
}

const SUPPORTED_PAYMENT_SCHEMES = new Set(["exact"]);
const CAIP2_PATTERN = /^[a-z0-9]+:[A-Za-z0-9]+$/;

export class X402Service {
  validate(input: X402ValidationInput): void {
    this.validateEndpoint(input.endpoint);
    this.validatePaymentScheme(input.paymentScheme);
    this.validateNetwork(input.network);
    this.validateFacilitatorUrl(input.facilitatorUrl);
  }

  private validateEndpoint(endpoint: string): void {
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new AppError(400, "invalid_endpoint", "Endpoint must be a valid URL", { endpoint });
    }

    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !isLocal) {
      throw new AppError(400, "invalid_endpoint_protocol", "Endpoint must use https", {
        endpoint,
      });
    }
  }

  private validatePaymentScheme(paymentScheme: string): void {
    if (!SUPPORTED_PAYMENT_SCHEMES.has(paymentScheme)) {
      throw new AppError(400, "unsupported_payment_scheme", "Unsupported payment scheme", {
        paymentScheme,
      });
    }
  }

  private validateNetwork(network: string): void {
    if (!CAIP2_PATTERN.test(network)) {
      throw new AppError(400, "invalid_network", "Network must be CAIP-2 formatted", { network });
    }
  }

  private validateFacilitatorUrl(facilitatorUrl: string): void {
    try {
      new URL(facilitatorUrl);
    } catch {
      throw new AppError(400, "invalid_facilitator_url", "Facilitator URL must be valid", {
        facilitatorUrl,
      });
    }
  }
}
