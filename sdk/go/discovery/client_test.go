package discovery

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewClient(t *testing.T) {
	t.Parallel()

	client, err := NewClient(Config{APIBaseURL: "http://localhost:3000"}, nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if client == nil {
		t.Fatal("expected client to be non-nil")
	}

	if _, err := NewClient(Config{APIBaseURL: ""}, nil); err == nil {
		t.Fatal("expected error for empty API base URL")
	}
}

func TestListAndSearchServices(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/services":
			fmt.Fprint(w, `{"items":[{"ensName":"weather-api.eth","ensNode":"0xnode"}],"total":1}`)
		case "/api/services/search":
			if got := r.URL.Query().Get("q"); got != "weather" {
				http.Error(w, "invalid q", http.StatusBadRequest)
				return
			}
			fmt.Fprint(w, `{"items":[{"ensName":"weather-api.eth","ensNode":"0xnode"}],"total":1}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(Config{APIBaseURL: server.URL}, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	active := true
	list, err := client.ListServices(ServiceListFilters{
		Network: "eip155:8453",
		Active:  &active,
	})
	if err != nil {
		t.Fatalf("list services: %v", err)
	}
	if list.Total != 1 {
		t.Fatalf("expected total=1, got %d", list.Total)
	}

	search, err := client.SearchServices("weather")
	if err != nil {
		t.Fatalf("search services: %v", err)
	}
	if search.Total != 1 {
		t.Fatalf("expected total=1, got %d", search.Total)
	}
}

func TestGetAndRegisterService(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/services/weather-api.eth":
			fmt.Fprint(w, `{"service":{"ensName":"weather-api.eth","ensNode":"0xnode","owner":"0x1111111111111111111111111111111111111111","endpoint":"https://api.example.com/weather","paymentScheme":"exact","network":"eip155:8453","description":"Weather","capabilities":["forecast"],"facilitatorUrl":"https://x402.org/facilitator","active":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}}`)
		case r.Method == http.MethodPost && r.URL.Path == "/api/services":
			rawBody, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "failed to read request body", http.StatusInternalServerError)
				return
			}
			body := string(rawBody)
			if !strings.Contains(body, `"ensName":"weather-api.eth"`) {
				http.Error(w, "invalid body", http.StatusBadRequest)
				return
			}
			fmt.Fprint(w, `{"service":{"ensName":"weather-api.eth","ensNode":"0xnode","owner":"0x1111111111111111111111111111111111111111","endpoint":"https://api.example.com/weather","paymentScheme":"exact","network":"eip155:8453","description":"Weather","capabilities":["forecast"],"facilitatorUrl":"https://x402.org/facilitator","active":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(Config{APIBaseURL: server.URL}, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	service, err := client.GetServiceByENSName("weather-api.eth")
	if err != nil {
		t.Fatalf("get service: %v", err)
	}
	if service.ENSName != "weather-api.eth" {
		t.Fatalf("unexpected ensName: %s", service.ENSName)
	}

	registered, err := client.RegisterService(ServiceRegistrationRequest{
		ENSName:       "weather-api.eth",
		Owner:         "0x1111111111111111111111111111111111111111",
		Endpoint:      "https://api.example.com/weather",
		PaymentScheme: "exact",
		Network:       "eip155:8453",
	})
	if err != nil {
		t.Fatalf("register service: %v", err)
	}
	if registered.ENSName != "weather-api.eth" {
		t.Fatalf("unexpected registered ensName: %s", registered.ENSName)
	}
}

func TestClientValidation(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"service":{"ensName":"weather-api.eth"}}`)
	}))
	defer server.Close()

	client, err := NewClient(Config{APIBaseURL: server.URL}, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	if _, err := client.GetServiceByENSName("  "); err == nil {
		t.Fatal("expected error for empty ENS name")
	}

	if _, err := client.RegisterService(ServiceRegistrationRequest{}); err == nil {
		t.Fatal("expected error for invalid registration input")
	}

	if _, err := client.SearchServices("   "); err == nil {
		t.Fatal("expected error for empty search query")
	}
}

func TestAPIErrorMapping(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprint(w, `{"error":{"code":"ownership_mismatch","message":"Owner mismatch","details":{"ensName":"weather-api.eth"}}}`)
	}))
	defer server.Close()

	client, err := NewClient(Config{APIBaseURL: server.URL}, server.Client())
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	_, err = client.GetServiceByENSName("weather-api.eth")
	if err == nil {
		t.Fatal("expected API error")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}

	if apiErr.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status code: %d", apiErr.StatusCode)
	}
	if apiErr.Code != "ownership_mismatch" {
		t.Fatalf("unexpected error code: %s", apiErr.Code)
	}
	if apiErr.Message != "Owner mismatch" {
		t.Fatalf("unexpected error message: %s", apiErr.Message)
	}
}
