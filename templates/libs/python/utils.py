"""
Shared utility functions for {{name}}
"""

from typing import Any, Dict, Optional
import json
import datetime


def format_response(data: Any, status: str = "success", message: Optional[str] = None) -> Dict[str, Any]:
    """Format a standardized API response."""
    response = {
        "status": status,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "data": data
    }
    if message:
        response["message"] = message
    return response


def validate_config(config: Dict[str, Any], required_keys: list) -> bool:
    """Validate that required keys exist in configuration."""
    return all(key in config for key in required_keys)


def safe_json_loads(json_str: str, default: Any = None) -> Any:
    """Safely parse JSON string with fallback."""
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


def generate_id() -> str:
    """Generate a simple timestamp-based ID."""
    return f"{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"