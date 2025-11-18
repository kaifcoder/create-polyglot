// Package {{name}} provides shared utilities and models for create-polyglot monorepo
package {{name}}

import (
	"encoding/json"
	"fmt"
	"time"
	
	"github.com/google/uuid"
)

// Response represents a standardized API response
type Response struct {
	Status    string      `json:"status"`
	Timestamp string      `json:"timestamp"`
	Data      interface{} `json:"data"`
	Message   *string     `json:"message,omitempty"`
}

// ServiceHealth represents the health status of a service
type ServiceHealth struct {
	ID          string     `json:"id"`
	ServiceName string     `json:"service_name"`
	Status      string     `json:"status"` // "healthy", "degraded", "unhealthy"
	Version     *string    `json:"version,omitempty"`
	Uptime      *float64   `json:"uptime,omitempty"`
	LastCheck   *time.Time `json:"last_check,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	ID           string                 `json:"id"`
	ErrorCode    string                 `json:"error_code"`
	ErrorMessage string                 `json:"error_message"`
	Details      map[string]interface{} `json:"details,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// FormatResponse creates a standardized API response
func FormatResponse(data interface{}, status string, message *string) Response {
	return Response{
		Status:    status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Data:      data,
		Message:   message,
	}
}

// ValidateConfig checks that all required keys exist in the configuration map
func ValidateConfig(config map[string]interface{}, requiredKeys []string) bool {
	for _, key := range requiredKeys {
		if _, exists := config[key]; !exists {
			return false
		}
	}
	return true
}

// SafeJSONUnmarshal safely unmarshals JSON with fallback to default value
func SafeJSONUnmarshal(data []byte, v interface{}, defaultValue interface{}) interface{} {
	if err := json.Unmarshal(data, v); err != nil {
		return defaultValue
	}
	return v
}

// GenerateID generates a new UUID string
func GenerateID() string {
	return uuid.New().String()
}

// NewServiceHealth creates a new ServiceHealth instance
func NewServiceHealth(serviceName, status string) ServiceHealth {
	now := time.Now().UTC()
	return ServiceHealth{
		ID:          GenerateID(),
		ServiceName: serviceName,
		Status:      status,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// NewErrorResponse creates a new ErrorResponse instance
func NewErrorResponse(errorCode, errorMessage string, details map[string]interface{}) ErrorResponse {
	now := time.Now().UTC()
	return ErrorResponse{
		ID:           GenerateID(),
		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
		Details:      details,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// String returns a string representation of the ServiceHealth
func (sh ServiceHealth) String() string {
	return fmt.Sprintf("ServiceHealth{ID: %s, Service: %s, Status: %s}", sh.ID, sh.ServiceName, sh.Status)
}