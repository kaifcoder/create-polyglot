# create-polyglot

CLI to scaffold a polyglot microservice monorepo (Node.js, Python/FastAPI, Go, Java Spring Boot, Next.js frontend) with optional Turborepo or Nx presets, Docker assets, shared packages, an interactive wizard, post-init service/plugin additions, and a persisted `polyglot.json` config.

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

## Commands

| Command | Description |
|---------|-------------|
| `create-polyglot init <name>` | Scaffold a new workspace (root invocation without `init` is deprecated). |
| `create-polyglot add service <name>` | Add a service after init (`--type`, `--port`, `--yes`). |
| `create-polyglot add plugin <name>` | Create plugin skeleton under `plugins/<name>`. |

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
