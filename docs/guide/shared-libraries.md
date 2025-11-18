# Shared Libraries in create-polyglot

create-polyglot now supports generating and managing shared libraries across different programming languages. This feature enables code reuse and modularity across your polyglot monorepo services.

## Overview

Shared libraries allow you to create common utilities, models, and functions that can be used across multiple services in your monorepo. create-polyglot supports generating libraries for:

- **Python packages** - Installable Python packages with setuptools/pip
- **Go modules** - Go modules that can be imported by Go services  
- **Java libraries** - Maven-based JAR libraries for Java services

## Quick Start

### Creating a Shared Library

```bash
# Create a Python shared library
npx create-polyglot add lib my-utils --type python

# Create a Go shared library  
npx create-polyglot add lib common --type go

# Create a Java shared library
npx create-polyglot add lib shared-models --type java
```

### Listing Shared Libraries

```bash
# List all shared libraries in a table
npx create-polyglot libraries

# Get JSON output
npx create-polyglot libs --json
```

### Removing a Shared Library

```bash
# Remove library (with confirmation)
npx create-polyglot remove lib my-utils

# Remove without confirmation
npx create-polyglot remove lib my-utils --yes

# Remove from config but keep files
npx create-polyglot remove lib my-utils --keep-files
```

## Language-Specific Usage

### Python Libraries

Python libraries are generated as installable packages using modern `pyproject.toml` configuration.

**Structure:**
```
packages/libs/my-utils/
├── pyproject.toml          # Package configuration
├── README.md               # Documentation
├── __init__.py            # Package initialization
├── utils.py               # Utility functions
└── models.py              # Data models
```

**Using in Services:**
```python
# Install the shared library (from service directory)
pip install -e ../packages/libs/my-utils

# Import and use in your service
from my_utils.utils import format_response, validate_config
from my_utils.models import ServiceHealth

response = format_response({"message": "Hello"}, "success")
health = ServiceHealth("my-service", "healthy")
```

**Development Commands:**
```bash
cd packages/libs/my-utils

# Install in editable mode
pip install -e .

# Install with dev dependencies
pip install -e .[dev]

# Run tests
pytest

# Format code
black .

# Type checking
mypy .
```

### Go Libraries

Go libraries are generated as Go modules that can be imported by Go services.

**Structure:**
```
packages/libs/common/
├── go.mod                 # Module definition
├── README.md              # Documentation
└── common.go              # Library code with types and functions
```

**Using in Services:**
```go
// Add to your service's go.mod
go mod edit -require=common@v0.1.0
go mod edit -replace=common=../packages/libs/common

// Import and use in your service
import "common"

response := common.FormatResponse(data, "success", nil)
health := common.NewServiceHealth("my-service", "healthy")
```

**Development Commands:**
```bash
cd packages/libs/common

# Install dependencies
go mod tidy

# Run tests
go test ./...

# Format code
go fmt ./...
```

### Java Libraries

Java libraries are generated as Maven projects that compile to JAR files.

**Structure:**
```
packages/libs/shared-models/
├── pom.xml                             # Maven configuration
├── README.md                           # Documentation
└── src/main/java/com/polyglot/shared/
    ├── models/
    │   ├── Response.java               # Response model
    │   └── ServiceHealth.java          # Health model
    └── utils/
        └── SharedUtils.java            # Utility functions
```

**Using in Services:**
```xml
<!-- Add to your service's pom.xml -->
<dependency>
    <groupId>com.polyglot</groupId>
    <artifactId>shared-models</artifactId>
    <version>0.1.0</version>
</dependency>
```

```java
// Import and use in your service
import com.polyglot.shared.models.Response;
import com.polyglot.shared.utils.SharedUtils;

Response<String> response = SharedUtils.formatResponse("Hello", "success", null);
```

**Development Commands:**
```bash
cd packages/libs/shared-models

# Compile
mvn compile

# Run tests  
mvn test

# Package as JAR
mvn package

# Install to local repository
mvn install
```

## Configuration

Shared libraries are tracked in your `polyglot.json` configuration:

```json
{
  "name": "my-project",
  "preset": "none",
  "packageManager": "npm",
  "services": [...],
  "sharedLibs": [
    {
      "name": "my-utils",
      "type": "python", 
      "path": "packages/libs/my-utils",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "name": "common",
      "type": "go",
      "path": "packages/libs/common", 
      "createdAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "plugins": {}
}
```

## Best Practices

### Library Design

1. **Keep libraries focused** - Each library should have a single responsibility
2. **Version your libraries** - Use semantic versioning for library releases
3. **Document your APIs** - Include comprehensive README and code documentation
4. **Write tests** - Include unit tests for library functionality
5. **Use consistent naming** - Follow language conventions for naming

### Cross-Service Integration

1. **Define clear interfaces** - Use consistent data models across services
2. **Handle errors gracefully** - Implement proper error handling and fallbacks
3. **Mock for testing** - Create mockable interfaces for easier service testing
4. **Version compatibility** - Ensure library changes don't break existing services

### Development Workflow

1. **Create library first** - Design shared functionality before duplicating code
2. **Test in isolation** - Verify library functionality independently
3. **Integrate incrementally** - Add library usage to services one at a time
4. **Monitor dependencies** - Track which services depend on which libraries

## CLI Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `add lib <name> --type <type>` | Create a new shared library | `add lib utils --type python` |
| `libraries` / `libs` | List all shared libraries | `libraries --json` |
| `remove lib <name>` | Remove a shared library | `remove lib utils --yes` |

## Plugin Hooks

Shared library operations trigger plugin hooks for extensibility:

- `before:lib:create` - Before creating a library
- `after:lib:create` - After creating a library  
- `before:lib:remove` - Before removing a library
- `after:lib:remove` - After removing a library

## Troubleshooting

### Common Issues

**Library not found when importing:**
- Ensure the library is properly installed/linked
- Check import paths and module names
- Verify the library was built successfully

**Build errors in services:**
- Check that library dependencies are satisfied
- Ensure compatible language/framework versions
- Verify library code compiles independently

**Import conflicts:**
- Use specific import statements
- Check for naming conflicts with other libraries
- Verify correct module paths

### Getting Help

- Run `npx create-polyglot libs` to see current libraries
- Check library README files for usage instructions
- Verify library builds independently before using in services