package discovery

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestENSNormalizationAndValidation(t *testing.T) {
	t.Parallel()

	client, err := NewClient(Config{APIBaseURL: "http://localhost:3000"}, nil)
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	normalized := client.NormalizeENSName(" Weather-API.ETH ")
	if normalized != "weather-api.eth" {
		t.Fatalf("unexpected normalized ENS name: %s", normalized)
	}

	if !client.ValidateENSName(normalized) {
		t.Fatal("expected ENS name to be valid")
	}
	if client.ValidateENSName("invalid-name") {
		t.Fatal("expected invalid ENS name to fail validation")
	}
}

func TestResolveENSName(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path != "/api/services/weather-api.eth" {
			http.NotFound(w, r)
			return
		}

		fmt.Fprint(w, `{"service":{"ensName":"weather-api.eth","ensNode":"0xnode","owner":"0x1111111111111111111111111111111111111111","endpoint":"https://api.example.com/weather","paymentScheme":"exact","network":"eip155:8453","description":"Weather","capabilities":["forecast"],"facilitatorUrl":"https://x402.org/facilitator","active":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}}`)
	}))
	defer server.Close()

	client, err := NewClient(Config{APIBaseURL: server.URL}, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	resolution, err := client.ResolveENSName(" Weather-API.ETH ")
	if err != nil {
		t.Fatalf("resolve ens name: %v", err)
	}
	if resolution.ENSName != "weather-api.eth" {
		t.Fatalf("unexpected resolved ENS name: %s", resolution.ENSName)
	}
	if resolution.Service.Endpoint != "https://api.example.com/weather" {
		t.Fatalf("unexpected resolved service endpoint: %s", resolution.Service.Endpoint)
	}
}

func TestResolveENSNameValidationAndMismatch(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"service":{"ensName":"different.eth","ensNode":"0xnode"}}`)
	}))
	defer server.Close()

	client, err := NewClient(Config{APIBaseURL: server.URL}, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	if _, err := client.ResolveENSName("invalid-name"); err == nil {
		t.Fatal("expected validation error for invalid ENS name")
	}

	if _, err := client.ResolveENSName("weather-api.eth"); err == nil {
		t.Fatal("expected resolver mismatch error")
	}
}
