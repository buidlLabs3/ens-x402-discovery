package discovery

type Config struct {
	APIBaseURL string
}

type ENSResolution struct {
	ENSName string
	Service RegisteredService
}

type RegisteredService struct {
	ENSName       string   `json:"ensName"`
	ENSNode       string   `json:"ensNode"`
	Owner         string   `json:"owner"`
	Endpoint      string   `json:"endpoint"`
	PaymentScheme string   `json:"paymentScheme"`
	Network       string   `json:"network"`
	Description   string   `json:"description"`
	Capabilities  []string `json:"capabilities"`
	FacilitatorURL string   `json:"facilitatorUrl"`
	Active        bool     `json:"active"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

type ServiceListFilters struct {
	Network       string
	PaymentScheme string
	Owner         string
	Active        *bool
}

type ServiceListResponse struct {
	Items []RegisteredService `json:"items"`
	Total int                 `json:"total"`
}

type ServiceRegistrationRequest struct {
	ENSName       string   `json:"ensName"`
	Owner         string   `json:"owner"`
	Endpoint      string   `json:"endpoint"`
	PaymentScheme string   `json:"paymentScheme"`
	Network       string   `json:"network"`
	Description   string   `json:"description,omitempty"`
	Capabilities  []string `json:"capabilities,omitempty"`
	FacilitatorURL string   `json:"facilitatorUrl,omitempty"`
}
