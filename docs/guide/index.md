# Introduction

`create-polyglot` is a CLI that scaffolds a polyglot microservice monorepo including:

- Node.js (Express)
- Python (FastAPI)
- Go (net/http)
- Java (Spring Boot)
- Next.js frontend

It produces a workspace with `services/*` (replacing the earlier `apps/*` layout), optional Turborepo or Nx presets, a persisted `polyglot.json`, and a basic dev runner when no preset is chosen. Additional services and plugins can be added post-init via `create-polyglot add ...`.
