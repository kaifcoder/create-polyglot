# create-polyglot

CLI to scaffold a polyglot microservice monorepo (Node.js, Python/FastAPI, Go, Java Spring Boot, Next.js frontend) with optional Turborepo or Nx presets, Docker assets, shared packages, and an interactive wizard.

## Installation (local dev)

```bash
npm install
npm link # or: pnpm link --global / yarn link / bun link
```

Then run (non-interactive example):

```bash
create-polyglot my-org -s node,python,go,java,frontend --git
```

Interactive (wizard prompts for any missing info):

```bash
create-polyglot my-org
```

## Options

| Flag | Description |
|------|-------------|
| `-s, --services <list>` | Comma separated services: `node,python,go,java,frontend` |
| `--preset <name>` | `turborepo`, `nx`, or `basic` (default auto -> asks) |
| `--git` | Initialize git repo & initial commit |
| `--no-install` | Skip dependency installation step |
| `--package-manager <pm>` | One of `npm|pnpm|yarn|bun` (default: detect or npm) |
| `--frontend-generator <gen>` | Currently: `create-next-app` (else falls back to template) |
| `--force` | Overwrite existing target directory if it exists |

If you omit flags, the wizard will prompt interactively (similar to `create-next-app`).

## Generated Structure
```
my-org/
  apps/
    node/
    python/
    go/
    java/ (spring-boot template)
    frontend/
  packages/
  package.json
```

### Generated Structure (Baseline)

```
my-org/
  apps/
    node/          # Express + nodemon dev script
    python/        # FastAPI + uvicorn
    go/            # net/http service
    java/          # Spring Boot (Maven)
    frontend/      # Next.js (template or create-next-app output)
  packages/
    shared/        # Example shared util (Node)
  docker/          # Per-service Dockerfiles (if not placed inline) *optional*
  compose.yaml     # Generated docker-compose for all selected services
  package.json     # Workspaces + scripts
  turbo.json / nx.json (if preset chosen)
  scripts/
    dev-basic.cjs  # Basic concurrent runner (no preset)
```

### Presets
- Turborepo: Generates `turbo.json`, sets root `dev` & `build` scripts to leverage Turborepo pipelines.
- Nx: Generates `nx.json` and adjusts scripts accordingly.
- Basic: Provides a minimal setup plus `scripts/dev-basic.cjs` for simple concurrency.

### Basic Dev Runner
When no preset is chosen, `npm run dev` (or your selected package manager) invokes `scripts/dev-basic.cjs` which:
1. Detects package manager (pnpm > yarn > bun > npm fallback)
2. Scans `apps/` directories
3. Starts only services with a `package.json` containing a `dev` script
4. Prefixes each line of output with the service name

Non-Node services (Python/Go/Spring) are skipped automatically; start them manually as needed:
```
cd apps/python && uvicorn main:app --reload
```

### Docker & Compose
For each selected service a Dockerfile is generated. A `compose.yaml` includes:
- Service definitions with build contexts
- Port mappings (adjust manually if conflicts)
- Shared network `app-net`
You can extend compose with volumes, env vars, or database services after generation.

### Frontend Generation
If `--frontend-generator create-next-app` is supplied, the tool shells out to `npx create-next-app` (respecting the chosen package manager for installs). If it fails, a fallback static template is used.

### Shared Package
An example `packages/shared` workspace demonstrates sharing Node utilities across services. Expand or add more workspaces as needed.

### Force Overwrite
If the target directory already exists, the CLI aborts unless `--force` is passed. Use with caution.

### Git Initialization
Pass `--git` to automatically run `git init`, create an initial commit, and (if desired) you can add remotes afterwards.

### Lint & Format
Generates ESLint + Prettier base configs at the root. Extend rules per service if needed.

### Roadmap / Ideas
- Healthchecks and depends_on in `compose.yaml`
- Additional generators (e.g. Remix, Astro, SvelteKit)
- Automatic test harness & CI workflow template
- Language-specific shared libs examples (Python package, Go module)
- Hot reload integration aggregator

## License
MIT
