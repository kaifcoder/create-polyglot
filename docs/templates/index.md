# Templates Overview

All service templates live in `templates/` and are copied verbatim (with a Spring Boot properties rename step). Current templates:

- `node/` Express + `/health` endpoint
- `python/` FastAPI + `/health`
- `go/` net/http server + `/health`
- `spring-boot/` Java with `/health` REST controller
- `frontend/` Next.js minimal (or `create-next-app` output when generator used)

Each template should stay minimal & dependency-light.
