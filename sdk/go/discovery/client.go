package discovery

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

type Client struct {
	apiBaseURL string
	httpClient *http.Client
}

type APIError struct {
	StatusCode int
	Code       string
	Message    string
	Details    map[string]any
	RawBody    string
}

func (e *APIError) Error() string {
	base := fmt.Sprintf("request failed (%d)", e.StatusCode)
	if e.Code != "" && e.Message != "" {
		return fmt.Sprintf("%s: %s - %s", base, e.Code, e.Message)
	}
	if e.Message != "" {
		return fmt.Sprintf("%s: %s", base, e.Message)
	}
	if e.RawBody != "" {
		return fmt.Sprintf("%s: %s", base, e.RawBody)
	}
	return base
}

func NewClient(config Config, httpClient *http.Client) (*Client, error) {
	baseURL := strings.TrimSpace(config.APIBaseURL)
	if baseURL == "" {
		return nil, fmt.Errorf("api base url is required")
	}

	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid api base url: %q", config.APIBaseURL)
	}

	client := httpClient
	if client == nil {
		client = http.DefaultClient
	}

	return &Client{
		apiBaseURL: strings.TrimRight(baseURL, "/"),
		httpClient: client,
	}, nil
}

func (c *Client) GetServiceByENSName(ensName string) (*RegisteredService, error) {
	resolution, err := c.ResolveENSName(ensName)
	if err != nil {
		return nil, err
	}

	return &resolution.Service, nil
}

func (c *Client) NormalizeENSName(ensName string) string {
	return strings.ToLower(strings.TrimSpace(ensName))
}

func (c *Client) ValidateENSName(ensName string) bool {
	normalized := c.NormalizeENSName(ensName)
	return ensNamePattern.MatchString(normalized)
}

func (c *Client) ResolveENSName(ensName string) (*ENSResolution, error) {
	normalizedENSName := c.NormalizeENSName(ensName)
	if normalizedENSName == "" {
		return nil, fmt.Errorf("ens name is required")
	}
	if !c.ValidateENSName(normalizedENSName) {
		return nil, fmt.Errorf("invalid ens name: %q", ensName)
	}

	path := fmt.Sprintf("/api/services/%s", url.PathEscape(normalizedENSName))
	var response struct {
		Service *RegisteredService `json:"service"`
	}
	if err := c.requestJSON(http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}
	if response.Service == nil {
		return nil, fmt.Errorf("invalid response: missing service object")
	}

	if c.NormalizeENSName(response.Service.ENSName) != normalizedENSName {
		return nil, fmt.Errorf(
			"resolver mismatch: expected ens name %q, got %q",
			normalizedENSName,
			response.Service.ENSName,
		)
	}

	return &ENSResolution{
		ENSName: normalizedENSName,
		Service: *response.Service,
	}, nil
}

func (c *Client) RegisterService(input ServiceRegistrationRequest) (*RegisteredService, error) {
	if err := validateServiceRegistrationInput(input); err != nil {
		return nil, err
	}

	var response struct {
		Service *RegisteredService `json:"service"`
	}
	if err := c.requestJSON(http.MethodPost, "/api/services", input, &response); err != nil {
		return nil, err
	}
	if response.Service == nil {
		return nil, fmt.Errorf("invalid response: missing service object")
	}

	return response.Service, nil
}

func (c *Client) ListServices(filters ServiceListFilters) (*ServiceListResponse, error) {
	query := url.Values{}
	if network := strings.TrimSpace(filters.Network); network != "" {
		query.Set("network", network)
	}
	if paymentScheme := strings.TrimSpace(filters.PaymentScheme); paymentScheme != "" {
		query.Set("paymentScheme", paymentScheme)
	}
	if owner := strings.TrimSpace(filters.Owner); owner != "" {
		query.Set("owner", owner)
	}
	if filters.Active != nil {
		query.Set("active", fmt.Sprintf("%t", *filters.Active))
	}

	path := "/api/services"
	if encoded := query.Encode(); encoded != "" {
		path = path + "?" + encoded
	}

	response := ServiceListResponse{}
	if err := c.requestJSON(http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

func (c *Client) SearchServices(query string) (*ServiceListResponse, error) {
	needle := strings.TrimSpace(query)
	if needle == "" {
		return nil, fmt.Errorf("search query is required")
	}

	path := "/api/services/search?q=" + url.QueryEscape(needle)
	response := ServiceListResponse{}
	if err := c.requestJSON(http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

func (c *Client) requestJSON(method, path string, body any, out any) error {
	fullURL := c.apiBaseURL + path

	var payload io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		payload = bytes.NewReader(encoded)
	}

	request, err := http.NewRequest(method, fullURL, payload)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("perform request: %w", err)
	}
	defer response.Body.Close()

	raw, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return decodeAPIError(response.StatusCode, raw)
	}

	if out == nil || len(raw) == 0 {
		return nil
	}

	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	return nil
}

func decodeAPIError(statusCode int, raw []byte) error {
	type apiErrorPayload struct {
		Error *struct {
			Code    string         `json:"code"`
			Message string         `json:"message"`
			Details map[string]any `json:"details"`
		} `json:"error"`
	}

	trimmedBody := strings.TrimSpace(string(raw))
	if trimmedBody == "" {
		return &APIError{
			StatusCode: statusCode,
		}
	}

	payload := apiErrorPayload{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return &APIError{
			StatusCode: statusCode,
			RawBody:    trimmedBody,
		}
	}

	if payload.Error == nil {
		return &APIError{
			StatusCode: statusCode,
			RawBody:    trimmedBody,
		}
	}

	return &APIError{
		StatusCode: statusCode,
		Code:       payload.Error.Code,
		Message:    payload.Error.Message,
		Details:    payload.Error.Details,
		RawBody:    trimmedBody,
	}
}

func validateServiceRegistrationInput(input ServiceRegistrationRequest) error {
	normalizedENSName := strings.ToLower(strings.TrimSpace(input.ENSName))
	if normalizedENSName == "" {
		return fmt.Errorf("ens name is required")
	}
	if !ensNamePattern.MatchString(normalizedENSName) {
		return fmt.Errorf("invalid ens name: %q", input.ENSName)
	}
	if strings.TrimSpace(input.Owner) == "" {
		return fmt.Errorf("owner is required")
	}
	if strings.TrimSpace(input.Endpoint) == "" {
		return fmt.Errorf("endpoint is required")
	}
	if strings.TrimSpace(input.PaymentScheme) == "" {
		return fmt.Errorf("payment scheme is required")
	}
	if strings.TrimSpace(input.Network) == "" {
		return fmt.Errorf("network is required")
	}

	return nil
}

var ensNamePattern = regexp.MustCompile(`^(?=.{3,255}$)([a-z0-9-]+\.)+eth$`)
