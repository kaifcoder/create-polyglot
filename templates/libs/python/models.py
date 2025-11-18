"""
Shared data models for {{name}}
"""

from typing import Optional
from dataclasses import dataclass
import datetime


@dataclass
class BaseModel:
    """Base model with common fields."""
    id: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.datetime.utcnow()


@dataclass
class ServiceHealth(BaseModel):
    """Model for service health status."""
    service_name: str = ""
    status: str = "unknown"  # "healthy", "degraded", "unhealthy"
    version: Optional[str] = None
    uptime: Optional[float] = None
    last_check: Optional[datetime.datetime] = None


@dataclass 
class ErrorResponse(BaseModel):
    """Model for standardized error responses."""
    error_code: str = ""
    error_message: str = ""
    details: Optional[dict] = None