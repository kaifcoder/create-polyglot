# Copilot Instructions for create-polyglot

Purpose: This repo is a CLI (`bin/index.js`) that scaffolds a polyglot monorepo (Node.js, Python/FastAPI, Go, Spring Boot Java, Next.js frontend) with optional Turborepo or Nx presets, docker assets, and a basic concurrent dev runner.

## Core Architecture
- Single entrypoint: `bin/index.js` (ESM). All behavior (prompting, parsing, filesystem generation, process execution) lives here—there is no internal module layering yet.
- Templates live under `templates/<service>` (node, python, go, spring-boot, frontend). These are copied verbatim; only Spring Boot renames `application.properties.txt` to `application.properties` post-copy.
- Service selection -> array of objects: `{ type, name, port }`. Ports have defaults: frontend 3000, node 3001, go 3002, java 3003, python 3004. Uniqueness is enforced; conflicts abort.
- `--services` flag accepts comma separated specs: `type`, or `type:name`, or `type:name:port`. Example: `--services node api:python:5001 go:web:4000`.
- Preset affects root `package.json` dev script + adds config file (`turbo.json` or `nx.json`). No preset => basic runner (`scripts/dev-basic.cjs`).
- Docker + `compose.yaml` are generated after templates: each service gets a Dockerfile if missing; compose exposes the same internal and external port.

## Key Flows
1. Parse CLI args (commander) -> gather missing info via `prompts` (unless `--yes`).
2. Build `services` list; validate names (reject reserved), ensure port uniqueness.
3. Create directory skeleton: `<project>/apps/*`, `packages/shared`, optional preset config.
4. Write root artifacts: `package.json`, `.eslintrc.cjs`, `.prettierrc`, README, optional git init.
5. Conditionally run `create-next-app` if frontend + `--frontend-generator` (fallback to internal template on failure).
6. Generate Dockerfiles + `compose.yaml` (simple internal YAML function, not an external lib).
7. Install deps unless `--no-install`.

## Project Conventions
- ESM at root (`type: module`). Test runner: Vitest (`npm test` => `vitest run`). Keep tests in `tests/` with `.test.js` naming.
- Single large CLI file is intentional for now; when adding features prefer extracting small helper modules under `bin/` (e.g. `lib/ports.js`) but update imports accordingly.
- All user-visible output uses `chalk` with emoji prefixes; follow existing style for consistency (info cyan/yellow, success green, errors red with leading symbol).
- Interactive defaults when `--yes`: projectName 'app', services ['node'], preset none, packageManager npm, git false.

## Edge Case Handling Already Implemented
- Aborts on invalid service type, duplicate service name, reserved names, invalid port range, or port collision.
- Graceful fallback if `create-next-app` fails (logs warning then copies template).
- Git init failure is non-fatal.
- Dependency install failures log a warning but do not abort scaffold.

## Adding / Modifying Behavior (Examples)
- New service template: create `templates/<newtype>`; add to `allServiceChoices` + defaultPorts + (optional) Dockerfile generation switch + compose mapping.
- Custom flags: Extend commander chain; ensure interactive question only added when flag absent. Add to summary + README if user-relevant.
- Compose enhancements: modify the `composeServices` object; keep network name `app-net` unless a breaking change is intended.

## Dev & Testing Workflow
- Local development: `npm install`, then run CLI directly: `node bin/index.js demo --services node,python --no-install --yes`.
- Run tests: `npm test` (non-watch). To add tests, mirror `tests/smoke.test.js` pattern; use `execa` to run the CLI inside a temp directory. Keep per-test timeout generous (≥30s) for create-next-app scenarios.
- When editing templates, no build step—files are copied verbatim. Ensure new template files are included via `files` array in root `package.json` if adding new top-level folders.

## External Tools & Commands
- `execa` is used for: `create-next-app`, git commands, and root dependency installation. Maintain `stdio: 'inherit'` for scaffold steps that should stream output.
- Avoid spawning raw `child_process` unless streaming multi-process dev tasks (already done in `scripts/dev-basic.cjs`). Prefer `execa` for promise-based control.

## Common Pitfalls to Avoid
- Forgetting to update defaultPorts or Dockerfile switch when adding a service causes incorrect compose or missing Dockerfile.
- Mutating `services` after port uniqueness check without re-validating can introduce collisions—re-run validation if you add dynamic adjustments.
- Adding large binary/template assets outside `templates/` may break packaging (root `files` whitelist).

## Style & Error Messaging
- Use concise, user-facing error messages followed by `process.exit(1)` for hard failures before writing scaffolded output.
- Non-critical failures (git init, install, external generator) should warn and continue.

## Quick Reference
- Entry CLI: `bin/index.js`
- Basic dev runner template: `scripts/dev-basic.cjs`
- Templates root: `templates/`
- Tests: `tests/`
- Workflow pipeline (publish): `.github/workflows/npm-publish.yml` (runs `npm ci && npm test` on release creation, then publishes)

If adding major refactors (e.g., splitting CLI), document new module boundaries here.

---
Feedback: Let me know if any sections need more depth (e.g., Docker generation, prompt flow, adding new presets) or if emerging conventions should be captured.
