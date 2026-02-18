import { AppError } from "../errors";

export interface X402ValidationInput {
  endpoint: string;
  paymentScheme: string;
  network: string;
  facilitatorUrl: string;
}

export interface X402BazaarListInput {
  facilitatorUrl: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface X402BazaarListResult {
  items: Array<Record<string, unknown>>;
  total: number;
}

export interface X402PaymentVerificationInput {
  facilitatorUrl: string;
  paymentPayload: Record<string, unknown>;
  paymentRequirements: Record<string, unknown>;
  x402Version?: number;
}

export interface X402PaymentVerificationResult {
  isValid: boolean;
  invalidReason?: string;
  invalidMessage?: string;
  payer?: string;
  extensions?: Record<string, unknown>;
}

const SUPPORTED_PAYMENT_SCHEMES = new Set(["exact"]);
const CAIP2_PATTERN = /^[a-z0-9]+:[A-Za-z0-9]+$/;
const DEFAULT_X402_VERSION = 2;

export class X402Service {
  validate(input: X402ValidationInput): void {
    this.validateEndpoint(input.endpoint);
    this.validatePaymentScheme(input.paymentScheme);
    this.validateNetwork(input.network);
    this.validateFacilitatorUrl(input.facilitatorUrl);
  }

  async listBazaarResources(input: X402BazaarListInput): Promise<X402BazaarListResult> {
    this.validateFacilitatorUrl(input.facilitatorUrl);
    const url = this.buildFacilitatorUrl(input.facilitatorUrl, "discovery/resources");
    if (input.type) {
      url.searchParams.set("type", input.type);
    }
    if (input.limit !== undefined) {
      url.searchParams.set("limit", String(input.limit));
    }
    if (input.offset !== undefined) {
      url.searchParams.set("offset", String(input.offset));
    }

    const response = await this.safeFetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await this.parseJson(response, "x402_discovery_invalid_response");
    const parsed = this.extractDiscoveryItems(payload);
    return {
      items: parsed.items,
      total: parsed.total,
    };
  }

  async verifyPayment(
    input: X402PaymentVerificationInput
  ): Promise<X402PaymentVerificationResult> {
    this.validateFacilitatorUrl(input.facilitatorUrl);
    const response = await this.safeFetch(
      this.buildFacilitatorUrl(input.facilitatorUrl, "verify").toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          x402Version: input.x402Version ?? DEFAULT_X402_VERSION,
          paymentPayload: input.paymentPayload,
          paymentRequirements: input.paymentRequirements,
        }),
      }
    );

    const payload = await this.parseJson(response, "x402_verify_invalid_response");
    if (!this.isRecord(payload) || typeof payload.isValid !== "boolean") {
      throw new AppError(
        502,
        "x402_verify_invalid_response",
        "Facilitator verification response schema is invalid"
      );
    }

    const verificationResult: X402PaymentVerificationResult = {
      isValid: payload.isValid,
      invalidReason:
        typeof payload.invalidReason === "string" ? payload.invalidReason : undefined,
      invalidMessage:
        typeof payload.invalidMessage === "string" ? payload.invalidMessage : undefined,
      payer: typeof payload.payer === "string" ? payload.payer : undefined,
      extensions: this.isRecord(payload.extensions) ? payload.extensions : undefined,
    };
    if (!response.ok) {
      return {
        ...verificationResult,
        isValid: false,
        invalidReason: verificationResult.invalidReason ?? `http_${response.status}`,
      };
    }

    return verificationResult;
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

  private buildFacilitatorUrl(baseUrl: string, path: string): URL {
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL(path, normalizedBase);
  }

  private async safeFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      throw new AppError(502, "x402_facilitator_unreachable", "Failed to reach x402 facilitator", {
        url,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  private async parseJson(response: Response, code: string): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new AppError(502, code, "Facilitator returned an invalid JSON payload", {
        statusCode: response.status,
      });
    }
  }

  private extractDiscoveryItems(payload: unknown): X402BazaarListResult {
    if (Array.isArray(payload)) {
      return {
        items: payload.filter((item): item is Record<string, unknown> => this.isRecord(item)),
        total: payload.length,
      };
    }
    if (this.isRecord(payload) && Array.isArray(payload.items)) {
      const totalValue = payload.total;
      const items = payload.items.filter(
        (item): item is Record<string, unknown> => this.isRecord(item)
      );
      return {
        items,
        total: typeof totalValue === "number" ? totalValue : items.length,
      };
    }
    throw new AppError(
      502,
      "x402_discovery_invalid_response",
      "Facilitator discovery response schema is invalid"
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
