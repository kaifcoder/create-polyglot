<div align="center">

# create-polyglot

[![Build Status](https://img.shields.io/github/actions/workflow/status/kaifcoder/create-polyglot/npm-publish.yml?branch=main)](https://github.com/kaifcoder/create-polyglot/actions)
[![License](https://img.shields.io/github/license/kaifcoder/create-polyglot.svg)](https://github.com/kaifcoder/create-polyglot/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/kaifcoder/create-polyglot)](https://github.com/kaifcoder/create-polyglot/releases)
[![Open Issues](https://img.shields.io/github/issues/kaifcoder/create-polyglot)](https://github.com/kaifcoder/create-polyglot/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/kaifcoder/create-polyglot)](https://github.com/kaifcoder/create-polyglot/pulls)
[![Languages](https://img.shields.io/github/languages/top/kaifcoder/create-polyglot)](https://github.com/kaifcoder/create-polyglot)
[![Coverage](https://img.shields.io/codecov/c/github/kaifcoder/create-polyglot)](https://codecov.io/gh/kaifcoder/create-polyglot)
[![Contributors](https://img.shields.io/github/contributors/kaifcoder/create-polyglot)](https://github.com/kaifcoder/create-polyglot/graphs/contributors)
[![npm version](https://img.shields.io/npm/v/create-polyglot.svg)](https://www.npmjs.com/package/create-polyglot)
[![npm downloads](https://img.shields.io/npm/dw/create-polyglot.svg)](https://www.npmjs.com/package/create-polyglot)

<strong>Scaffold a modern polyglot microservices monorepo in seconds.</strong><br/>
Generate Node.js, Python (FastAPI), Go, Java (Spring Boot), and Next.js frontend services with optional Turborepo or Nx presets, Docker Compose, shared packages, plugin hooks, and a persisted configuration file.

</div>

---

## Table of Contents
1. [Why create-polyglot?](#why-create-polyglot)
2. [Features](#features)
3. [Quick Start](#quick-start)
4. [Installation](#installation)
5. [Usage Examples](#usage-examples)
6. [Commands](#commands)
7. [Init Flags / Options](#init-options)
8. [Generated Project Structure](#generated-structure)
9. [Presets](#presets)
10. [Development Workflow](#development-workflow)
11. [Docker & Compose Support](#docker--compose)
12. [polyglot.json Configuration](#polyglotjson)
13. [Plugins](#plugins)
14. [Basic Dev Runner](#basic-dev-runner)
15. [Roadmap](#roadmap--ideas)
16. [Contributing](#contributing)
17. [License](#license)

---

## Why create-polyglot?
Building a production-style polyglot microservice environment normally requires repetitive boilerplate across languages, Docker files, presets, and configs. `create-polyglot` automates:
- Consistent folder layout & service naming
- Language starter templates (Node, FastAPI, Go, Spring Boot, Next.js)
- Optional monorepo orchestration (Turborepo or Nx) OR a zero-frills basic runner
- Dockerfile + `compose.yaml` generation with correct port mappings
- Extensible plugin scaffolding for future lifecycle hooks
- A centralized manifest (`polyglot.json`) driving subsequent commands (e.g. `add service`)

Use it to prototype architectures, onboard teams faster, or spin up reproducible demos / PoCs.

## Features
- 🚀 Rapid polyglot monorepo scaffolding (Node.js, Python/FastAPI, Go, Java Spring Boot, Next.js)
- 🧩 Optional presets: Turborepo, Nx, or Basic runner
- 🐳 Automatic Dockerfile + Docker Compose generation
- 🛠 Interactive wizard (or fully non-interactive via flags)
- 🔁 Post-init extensibility: add services & plugins anytime
- 📦 Shared package (`packages/shared`) for cross-service JS utilities
- 🧪 Vitest test setup for the CLI itself
- 🌈 Colorized dev logs & health probing for Node/frontend services
- 🔌 Plugin skeleton generation (`create-polyglot add plugin <name>`)
- 📄 Single source of truth: `polyglot.json`
- ✅ Safe guards: port collision checks, reserved name checks, graceful fallbacks
- 📝 Friendly chalk-based CLI output with clear status symbols

## Quick Start
Scaffold a workspace named `my-org` with multiple services:

```bash
npx create-polyglot init my-org -s node,python,go,java,frontend --git --yes
```

Then run everything (Node + frontend locally):
```bash
create-polyglot dev
```

Or via Docker Compose:
```bash
create-polyglot dev --docker
```

Add a new service later:
```bash
create-polyglot add service payments --type node --port 4100
```

## Installation
Global (recommended for repeated use):
```bash
npm install -g create-polyglot
```

Local dev / contributing:
```bash
npm install
npm link   # or: pnpm link --global / yarn link / bun link
```

## Usage Examples
Interactive wizard (prompts for missing info):
```bash
create-polyglot init my-org
```

Non-interactive with explicit services & git init:
```bash
create-polyglot init my-org -s node,python,go --git --yes
```

Add plugin skeleton:
```bash
create-polyglot add plugin postgres
```

Start dev with Docker:
```bash
create-polyglot dev --docker
```

## Commands
| Command | Description |
|---------|-------------|
| `create-polyglot init <name>` | Scaffold a new workspace (root invocation without `init` is deprecated). |
| `create-polyglot add service <name>` | Add a service after init (`--type`, `--port`, `--yes`). |
| `create-polyglot add plugin <name>` | Create plugin skeleton under `plugins/<name>`. |
| `create-polyglot dev [--docker]` | Run Node & frontend services locally or all via compose. |

## Init Options
| Flag | Description |
|------|-------------|
| `-s, --services <list>` | Comma separated services: `node,python,go,java,frontend` |
| `--preset <name>` | `turborepo`, `nx`, or `basic` (default auto -> asks) |
| `--git` | Initialize git repo & initial commit |
| `--no-install` | Skip dependency installation step |
| `--package-manager <pm>` | One of `npm|pnpm|yarn|bun` (default: detect or npm) |
| `--frontend-generator` | Use `create-next-app` (falls back to template on failure) |
| `--force` | Overwrite existing target directory if it exists |
| `--yes` | Accept defaults & suppress interactive prompts |

If you omit flags, the wizard will prompt interactively (similar to `create-next-app`).

## Generated Structure
```
my-org/
  services/
    node/          # Express + dev script
    python/        # FastAPI + uvicorn
    go/            # Go net/http service
    java/          # Spring Boot (Maven)
    frontend/      # Next.js (template or create-next-app output)
  gateway/
  infra/
  packages/
    shared/
  plugins/         # created when adding plugins
  compose.yaml
  polyglot.json    # persisted configuration
  package.json
  turbo.json / nx.json (if preset chosen)
  scripts/
    dev-basic.cjs
```

### Presets
- **Turborepo**: Generates `turbo.json`, sets root `dev` & `build` scripts for pipeline caching.
- **Nx**: Generates `nx.json` and adjusts scripts accordingly.
- **Basic**: Minimal setup + `scripts/dev-basic.cjs` for simple concurrency.

## Development Workflow
1. Scaffold with `init`.
2. (Optional) Add more services or plugins.
3. Run `create-polyglot dev` (local) or `create-polyglot dev --docker`.
4. Edit services under `services/<name>`.
5. Extend infra / databases inside `compose.yaml`.

### Basic Dev Runner
When no preset is chosen, `npm run dev` uses `scripts/dev-basic.cjs`:
1. Detects package manager (pnpm > yarn > bun > npm fallback)
2. Scans `services/` for Node services
3. Runs those with a `dev` script
4. Prefixes log lines with service name

Non-Node services start manually or via compose:
```bash
cd services/python && uvicorn app.main:app --reload
```

## polyglot dev Command
`create-polyglot dev` reads `polyglot.json`, launches Node & frontend services that expose a `dev` script, assigns each a colorized log prefix, and probes `http://localhost:<port>/health` until ready (15s timeout). Pass `--docker` to instead delegate to `docker compose up --build` for all services.

If a service lacks a `dev` script it is skipped with no error. Non-Node services (python/go/java) are not auto-started yet unless you choose `--docker`.

## Docker & Compose
For each selected service a Dockerfile is generated. A `compose.yaml` includes:
- Service definitions with build contexts
- Port mappings (adjust manually if conflicts)
- Shared network `app-net`

You can extend compose with volumes, env vars, or database services after generation.

## Frontend Generation
If `--frontend-generator create-next-app` is supplied, the tool shells out to `npx create-next-app` (respecting the chosen package manager for installs). If it fails, a fallback static template is used.

## polyglot.json
Example:
```jsonc
{
  "name": "my-org",
  "preset": "none",
  "packageManager": "npm",
  "services": [
    { "name": "node", "type": "node", "port": 3001, "path": "services/node" }
  ]
}
```
Used by `add service` to assert uniqueness and regenerate `compose.yaml`.

## Plugins
`create-polyglot add plugin <name>` scaffolds `plugins/<name>/index.js` with a hook skeleton (`afterInit`). Future releases will execute hooks automatically during lifecycle events.

## Shared Package
`packages/shared` shows cross-service Node utilities. Extend or add per-language shared modules.

## Force Overwrite
If the target directory already exists, the CLI aborts unless `--force` is passed. Use with caution.

## Git Initialization
Pass `--git` to automatically run `git init`, create an initial commit, and (if desired) you can add remotes afterwards.

## Lint & Format
Generates ESLint + Prettier base configs at the root. Extend rules per service if needed.

## Roadmap / Ideas
- Plugin hook execution pipeline
- Healthchecks and depends_on in `compose.yaml`
- Additional generators (Remix, Astro, SvelteKit)
- Automatic test harness & CI workflow template
- Language-specific shared libs (Python package, Go module)
- Hot reload integration aggregator
- Remove service / remove plugin commands

## Contributing
Contributions welcome! See `CONTRIBUTING.md` for guidelines. Please run tests before submitting a PR:
```bash
npm test
```

## License
MIT

## Documentation Site (VitePress)

Local docs development:
```bash
npm run docs:dev
```
Build static site:
```bash
npm run docs:build
```
Preview production build:
```bash
npm run docs:preview
```
Docs source lives in `docs/` with sidebar-driven structure defined in `docs/.vitepress/config.mjs`.

### Deployment
Docs are auto-deployed to GitHub Pages on pushes to `main` that touch `docs/` via `.github/workflows/docs.yml`. The base path is set using `VITEPRESS_BASE=/create-polyglot/`.

## Installation (local dev)

```bash
npm install
npm link # or: pnpm link --global / yarn link / bun link
```

Then run (non-interactive example):

```bash
create-polyglot init my-org -s node,python,go,java,frontend --git --yes
```

Interactive (wizard prompts for any missing info):

```bash
create-polyglot init my-org
```

Add a service later:
```bash
create-polyglot add service payments --type node --port 4100
```

Add a plugin scaffold:
```bash
create-polyglot add plugin postgres
```

Run all services in dev mode (Node & frontend locally; others manual unless using docker):
```bash
create-polyglot dev
```

Run everything via Docker Compose:
```bash
create-polyglot dev --docker
```

## Commands

| Command | Description |
|---------|-------------|
| `create-polyglot init <name>` | Scaffold a new workspace (root invocation without `init` is deprecated). |
| `create-polyglot add service <name>` | Add a service after init (`--type`, `--port`, `--yes`). |
| `create-polyglot add plugin <name>` | Create plugin skeleton under `plugins/<name>`. |
| `create-polyglot dev [--docker]` | Run Node & frontend services locally or all via compose. |

## Init Options

| Flag | Description |
|------|-------------|
| `-s, --services <list>` | Comma separated services: `node,python,go,java,frontend` |
| `--preset <name>` | `turborepo`, `nx`, or `basic` (default auto -> asks) |
| `--git` | Initialize git repo & initial commit |
| `--no-install` | Skip dependency installation step |
| `--package-manager <pm>` | One of `npm|pnpm|yarn|bun` (default: detect or npm) |
| `--frontend-generator` | Use `create-next-app` (falls back to template on failure) |
| `--force` | Overwrite existing target directory if it exists |

If you omit flags, the wizard will prompt interactively (similar to `create-next-app`).

## Generated Structure
```
my-org/
  services/
    node/          # Express + dev script
    python/        # FastAPI + uvicorn
    go/            # Go net/http service
    java/          # Spring Boot (Maven)
    frontend/      # Next.js (template or create-next-app output)
  gateway/
  infra/
  packages/
    shared/
  plugins/         # created when adding plugins
  compose.yaml
  polyglot.json    # persisted configuration
  package.json
  turbo.json / nx.json (if preset chosen)
  scripts/
    dev-basic.cjs
```

### Presets
- Turborepo: Generates `turbo.json`, sets root `dev` & `build` scripts to leverage Turborepo pipelines.
- Nx: Generates `nx.json` and adjusts scripts accordingly.
- Basic: Provides a minimal setup plus `scripts/dev-basic.cjs` for simple concurrency.

### Basic Dev Runner
When no preset is chosen, `npm run dev` uses `scripts/dev-basic.cjs`:
1. Detects package manager (pnpm > yarn > bun > npm fallback)
2. Scans `services/` for Node services
3. Runs those with a `dev` script
4. Prefixes log lines with service name

Non-Node services start manually or via compose:
```
cd services/python && uvicorn app.main:app --reload
```

### polyglot dev Command
`create-polyglot dev` reads `polyglot.json`, launches Node & frontend services that expose a `dev` script, assigns each a colorized log prefix, and probes `http://localhost:<port>/health` until ready (15s timeout). Pass `--docker` to instead delegate to `docker compose up --build` for all services.

If a service lacks a `dev` script it is skipped with no error. Non-Node services (python/go/java) are not auto-started yet unless you choose `--docker`.

### Docker & Compose
For each selected service a Dockerfile is generated. A `compose.yaml` includes:
- Service definitions with build contexts
- Port mappings (adjust manually if conflicts)
- Shared network `app-net`
You can extend compose with volumes, env vars, or database services after generation.

### Frontend Generation
If `--frontend-generator create-next-app` is supplied, the tool shells out to `npx create-next-app` (respecting the chosen package manager for installs). If it fails, a fallback static template is used.

### polyglot.json
Example:
```jsonc
{
  "name": "my-org",
  "preset": "none",
  "packageManager": "npm",
  "services": [
    { "name": "node", "type": "node", "port": 3001, "path": "services/node" }
  ]
}
```
Used by `add service` to assert uniqueness and regenerate `compose.yaml`.

### Plugins
`create-polyglot add plugin <name>` scaffolds `plugins/<name>/index.js` with a hook skeleton (`afterInit`). Future releases will execute hooks automatically during lifecycle events.

### Shared Package
`packages/shared` shows cross-service Node utilities. Extend or add per-language shared modules.

### Force Overwrite
If the target directory already exists, the CLI aborts unless `--force` is passed. Use with caution.

### Git Initialization
Pass `--git` to automatically run `git init`, create an initial commit, and (if desired) you can add remotes afterwards.

### Lint & Format
Generates ESLint + Prettier base configs at the root. Extend rules per service if needed.

### Roadmap / Ideas
- Plugin hook execution pipeline
- Healthchecks and depends_on in `compose.yaml`
- Additional generators (Remix, Astro, SvelteKit)
- Automatic test harness & CI workflow template
- Language-specific shared libs (Python package, Go module)
- Hot reload integration aggregator
- Remove service / remove plugin commands

## License
MIT

## Documentation Site (VitePress)

Local docs development:
```bash
npm run docs:dev
```
Build static site:
```bash
npm run docs:build
```
Preview production build:
```bash
npm run docs:preview
```
Docs source lives in `docs/` with sidebar-driven structure defined in `docs/.vitepress/config.mjs`.

### Deployment
Docs are auto-deployed to GitHub Pages on pushes to `main` that touch `docs/` via `.github/workflows/docs.yml`. The base path is set using `VITEPRESS_BASE=/create-polyglot/`.
