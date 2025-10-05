# Docker & Compose

Each selected service gets a Dockerfile (if not already present). A `compose.yaml` is generated with:

- 1:1 service definitions
- Matching internal/external port mappings
- Shared network `app-net`

Extend compose after generation with databases, volumes, or env vars as needed.
