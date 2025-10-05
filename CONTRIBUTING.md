# Contributing to `create-polyglot`

Thanks for your interest in contributing! This document explains how to set up a local development environment, propose changes, add new service templates or generators, and submit pull requests.

---
## Table of Contents
1. Prerequisites
2. Project Overview
3. Getting Started (Local Dev)
4. Running / Debugging the CLI
5. Adding or Updating Service Templates
6. Adding External Generators (e.g. create-next-app)
7. Docker & Compose Generation
8. Presets (Turborepo / Nx)
9. Shared Packages (Workspaces)
10. Code Style & Tooling
11. Commit Message Conventions
12. Testing Strategy (Current & Future)
13. Releasing / Publishing
14. Issue Reporting & Pull Request Workflow
15. Security / Responsible Disclosure
16. Roadmap / Ideas

---
## 1. Prerequisites
- **Node.js**: >= 20 (commander@14 & other deps require current LTS / Active version).
- **npm** (or pnpm / yarn / bun if you want to test multi-PM flows).
- **Git** for version control.
- Internet access if you test the `--frontend-generator` flag (uses `npx create-next-app`).

Optional tooling:
- Docker (to validate generated Dockerfiles / `compose.yaml`).
- Java 21 & Maven if testing the Spring Boot template build.
- Go toolchain (>=1.22) for the Go service.
- Python 3.12 for the FastAPI service.

---
## 2. Project Overview
`create-polyglot` scaffolds a polyglot microservice monorepo supporting multiple languages & frameworks:
- Node.js (Express)
- Python (FastAPI)
- Go (net/http minimal)
- Java (Spring Boot)
- Frontend (Next.js) via internal template or `create-next-app` generator

Features:
- Interactive wizard (like `create-next-app`) if no arguments passed.
- Non‑interactive flags for automation.
- Optional presets: Turborepo or Nx.
- Shared workspace package example (`packages/shared`).
- Dockerfile generation + `compose.yaml` (multi-service) with a shared network.
- Linting / formatting (ESLint + Prettier) + root scripts.

---
## 3. Getting Started (Local Dev)
```bash
# Clone your fork
git clone https://github.com/<your-username>/create-polyglot.git
cd create-polyglot

# Install dependencies
npm install

# Link globally to test the CLI
npm link

# Run interactively
create-polyglot

# Or scripted
create-polyglot demo -s node,python,go,java,frontend --preset turborepo --git
```
To unlink later:
```bash
npm unlink -g create-polyglot
```

---
## 4. Running / Debugging the CLI
Without linking you can run directly:
```bash
node bin/index.js my-app -s node,python
```
Use environment variable `DEBUG=1` (you can instrument logs) if you add debug branches.

You can also insert `console.log` statements or use an inspector:
```bash
node --inspect-brk bin/index.js demo -s node
```
Then attach a debugger (e.g., VS Code).

---
## 5. Adding or Updating Service Templates
1. Add a folder under `templates/<service-name>`.
2. Include minimal runnable code (avoid giant dependency graphs).
3. Add necessary dependency manifests (e.g., `package.json`, `requirements.txt`, `pom.xml`, `go.mod`).
4. If the template has files that some dev tools may auto-ignore (like `application.properties` earlier), you can store as `.txt` then rename during copy (see Spring Boot handling in `bin/index.js`).
5. Update `allServiceChoices` array AND if you need alias matching add to `templateMap`.
6. Document new service in README + (optionally) `--help` details.

Design guidelines:
- Keep templates minimal & fast to scaffold.
- Provide a `/health` endpoint for consistency.
- Avoid binding privileged ports or random ephemeral ports.

---
## 6. Adding External Generators (e.g. `create-next-app`)
Current support: `--frontend-generator` triggers `npx create-next-app`. To add more:
1. Introduce a general flag (e.g., `--use-generator <service[:generator]>`).
2. Parse mapping: service -> command.
3. Use `execa` to run the tool in the target directory.
4. Wrap in try/catch, fallback to internal template on failure.
5. Sanitize directory (remove pre-existing files) before invoking generation.

Keep external executions opt-in to avoid slow default scaffolds.

---
## 7. Docker & Compose Generation
The generator creates per-service `Dockerfile`s and a `compose.yaml`:
- Shared network: `app-net`.
- Ports mapped 1:1 (e.g., Node 3001:3001).
- Environment variable `PORT` injected.

To modify behavior:
- Edit section in `bin/index.js` after `// Generate Dockerfiles + compose.yaml`.
- Consider adding `healthcheck` blocks or dependencies (e.g., databases) behind a new flag `--with-db`.

Testing:
```bash
cd <generated-project>
docker compose up --build
```

---
## 8. Presets (Turborepo / Nx)
- Preset selected via `--preset turborepo` or `--preset nx` (or interactive).
- Alters `dev` script and adds `turbo.json` or `nx.json` plus relevant dev dependency.
- Add a new preset: extend conditional block where `rootPkg` is built, then emit configuration file.

---
## 9. Shared Packages (Workspaces)
The example `packages/shared` demonstrates a simple util export. To add new shared libs:
```bash
mkdir -p packages/logger/src
cat > packages/logger/package.json <<'EOF'
{
  "name": "@shared/logger",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.js"
}
EOF
```
Then import from services that use Node.js / Frontend. (Other languages each maintain their own dependency system.)

---
## 10. Code Style & Tooling
- **Formatting**: Prettier (`npm run format`).
- **Linting**: ESLint (`npm run lint`).
- Keep `bin/index.js` logically segmented—prefer small helper functions if it grows.
- Avoid introducing TypeScript in the CLI unless you add a build step.

Suggested style: keep functions small, prefer async/await, graceful error handling with actionable messages.

---
## 11. Commit Message Conventions
Use Conventional Commits where possible:
```
feat: add Rust service template
fix: correct compose environment mapping
chore: bump dependencies
refactor: extract docker writer helper
docs: update contributing guidelines
```
This assists in automated changelog generation later.

---
## 12. Testing Strategy (Current & Future)
Currently there are no automated tests. Suggested roadmap:
- Unit tests for helper functions (after refactoring CLI logic into modules).
- Snapshot tests for generated directory structures.
- E2E tests using a temporary tmpdir: run CLI, assert expected files, run `node apps/node/src/index.js` health check.
- Integration test to ensure docker compose builds (can be optional in CI).

Potential frameworks: `vitest` or `jest`.

---
## 13. Releasing / Publishing
1. Ensure `main` is green & docs updated.
2. Bump version in `package.json` (follow semver).
3. Update / create `CHANGELOG.md`.
4. Commit & tag:
   ```bash
   git add .
   git commit -m "chore: release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```
5. Publish:
   ```bash
   npm publish --access public
   ```
6. Verify install:
   ```bash
   npx create-polyglot --help
   ```

---
## 14. Issue Reporting & Pull Request Workflow
**Issues:**
- Use the issue template (if/when added).
- Provide: environment (OS, Node version), command run, reproduction steps, expected vs actual.

**Pull Requests Checklist:**
- One focused change per PR.
- Updated docs / README / CONTRIBUTING sections if behavior changes.
- Ran a local scaffold test (`node bin/index.js test -s node --no-install --force`).
- No large unrelated formatting diffs.

**Review Tips:** Split big refactors into multiple smaller PRs whenever possible.

---
## 15. Security / Responsible Disclosure
If you discover a security issue (e.g., command injection risk in generator inputs), **do not** open a public issue immediately. Instead contact the maintainer (add contact method in README or via GitHub security advisories once configured). Provide clear reproduction details.

---
## 16. Roadmap / Ideas
- Add additional language templates: Rust (Axum), .NET (Minimal API), PHP (Laravel Octane lightweight variant), Deno/Fresh.
- Configurable port allocation & detection of conflicts.
- Pluggable recipe system (YAML describing services & generators).
- Telemetry (opt-in) for anonymized feature usage.
- `--with-ci github-actions` to generate workflow.
- Test harness & code coverage.
- Multi-stage infra: generate k8s manifests or helm charts.
- Monorepo plugin system for custom user templates in `~/.config/create-polyglot/templates`.

---
## Questions / Help
Open an issue or start a discussion. PRs welcome!

Happy building 🌟
