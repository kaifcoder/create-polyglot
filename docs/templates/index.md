# Templates Overview

Service scaffolding comes from internal templates or official generators:

- Internal templates (copied verbatim): `node/`, `python/`, `go/`, `spring-boot/`, `frontend/` (minimal Next.js when not using `--frontend-generator`).
- External generators (no internal fallback unless added later): Remix (`create-remix`), Astro (`create-astro`), SvelteKit (`sv create` with legacy `create-svelte` fallback).

Spring Boot still performs a post-copy rename of `application.properties.txt` → `application.properties`.

Keep internal templates minimal & dependency-light; external generator outputs are left intact.
