# Copilot Instructions for create-polyglot

Purpose: CLI tool (`bin/index.js`) that scaffolds polyglot monorepos with Node.js, Python/FastAPI, Go, Spring Boot Java, Next.js, Remix, Astro, and SvelteKit. Supports Turborepo/Nx presets, Docker orchestration, hot reload, plugin system, and admin dashboard with real-time monitoring.

## Core Architecture
- **Entrypoint**: `bin/index.js` (ESM) routes subcommands to modular handlers in `bin/lib/`:
  - `scaffold.js` - Project initialization, service/plugin/library add/remove
  - `dev.js` - Local development runner with health checks
  - `hotreload.js` - Language-specific hot reload orchestration (nodemon, uvicorn, go run, spring-boot)
  - `admin.js` - HTTP dashboard server with WebSocket log streaming (chokidar-based file watching)
  - `logs.js` - Log management (viewing, filtering, cleanup, file watching with `LogFileWatcher`)
  - `service-manager.js` - Process lifecycle management (start/stop/status services)
  - `plugin-system.js` - Hookable-based plugin lifecycle (60+ hook points)
  - `resources.js` - System resource monitoring (pidusage, systeminformation)
  - `ui.js` - CLI rendering helpers (tables via chalk)

- **Configuration**: `polyglot.json` manifest drives all commands (services, ports, preset, packageManager, plugins, sharedLibs)
- **Templates**: `templates/<type>` copied verbatim; Spring Boot special handling (`application.properties.txt` → `.properties`)
- **Service Model**: Array of `{ type, name, port, path }` where path is `services/<name>` (new) or `apps/<name>` (legacy)
- **Default Ports**: frontend 3000, node 3001, go 3002, java 3003, python 3004, remix 3005, astro 3006, sveltekit 3007
- **Reserved Names**: `scripts`, `packages`, `apps`, `node_modules`, `docker`, `compose`, `compose.yaml` rejected during validation
- **Port Uniqueness**: Enforced at init and add; conflicts abort early with clear error

## Key Workflows

### Scaffolding (`init` command)
1. Parse CLI args (commander) → gather missing via `prompts` (skip if `--yes`)
2. Call plugin hook `before:init`
3. Validate services: check reserved names, port conflicts, valid types
4. Create directory skeleton: `<project>/services/*`, `packages/shared`, `.polyglot/plugins/`
5. Write root artifacts: `package.json`, `polyglot.json`, `.eslintrc.cjs`, `.prettierrc`, README
6. Copy templates from `templates/<type>` → `services/<name>` (conditional `create-next-app` for frontend if `--frontend-generator`)
7. Generate Dockerfiles (inline logic, no external lib) + `compose.yaml` with `app-net` network
8. Optional: generate `.github/workflows/ci.yml` if `--with-actions`
9. Optional: `git init` (non-fatal on failure)
10. Install deps via `execa` unless `--no-install` (warns on failure, doesn't abort)
11. Call plugin hook `after:init`
12. Initialize service logs (`.logs/<date>.log`)

### Service Management
- **Add service**: Validate name/port → update `polyglot.json` → copy template → generate Dockerfile → call plugin hooks
- **Remove service**: Prompt confirmation (unless `--yes`) → delete files (unless `--keep-files`) → update `polyglot.json` → rebuild Docker compose
- **List services**: Read `polyglot.json` → render table or JSON

### Development
- **`dev` command**: Spawns processes per service type (npm run dev for node/frontend, uvicorn for python, go run for go, mvn spring-boot:run for java) + admin dashboard on port 9000
- **`dev --docker`**: Delegates to `docker compose up --build`
- **`hot` command**: Language-specific file watchers with debounced restarts (400ms)
- **`admin` command**: Starts HTTP server with resource monitoring + WebSocket log streaming (chokidar watches `.logs/*.log`)

### Plugin System
- Hooks execute via `hookable` library (before/after: init, service:add/remove, dev:start/stop, docker:build, hotreload:*, admin:*, logs:*)
- Plugins discovered from `.polyglot/plugins/` (local) or `node_modules` (npm)
- Dependency resolution via `dependencies` array in plugin metadata
- Enable/disable via `polyglot.json` plugins config

## Project Conventions
- **Module system**: ESM (`"type": "module"` in root package.json). All imports use `.js` extensions
- **Test runner**: Vitest (`npm test` → `vitest run && npm run test:cleanup`). Tests in `tests/*.test.js` with 30s+ timeouts for CLI ops
- **Output style**: All user-facing messages use `chalk` with consistent emoji prefixes:
  - Info: `chalk.cyan('🚀 ...')` or `chalk.yellow('⚠️  ...')`
  - Success: `chalk.green('✅ ...')`
  - Errors: `chalk.red('❌ ...')` followed by `process.exit(1)` for hard failures
  - Service logs: color per service via hash of name (see `colorFor()` helper in dev.js, hotreload.js)
- **Interactive defaults** (when `--yes`): projectName='app', services=['node'], preset=none, packageManager=npm, git=false
- **File operations**: Use `fs-extra` for async file ops (mkdirp, copy, readJson, writeJson). Use `execa` for spawning commands (not raw child_process except in service-manager.js)
- **Error handling**: Hard failures (validation errors) exit immediately; soft failures (git init, npm install, external generators) warn and continue

## Validation & Error Handling
- **Hard failures** (abort immediately):
  - Invalid service type not in `allServiceChoices` (node, python, go, java, frontend, remix, astro, sveltekit)
  - Duplicate service name or reserved name (`scripts`, `packages`, `apps`, `node_modules`, `docker`, `compose`, `compose.yaml`)
  - Port collision (checked in scaffold.js during init and addService)
  - Invalid port range (must be 1-65535)
  - Missing `polyglot.json` when running commands in workspace
- **Soft failures** (warn and continue):
  - `create-next-app` failure → fallback to internal template
  - Git init failure → continues without git
  - Dependency install failure → warns but doesn't abort scaffold
  - Admin dashboard startup failure → continues dev command without monitoring

## Adding Features
- **New service type**:
  1. Create `templates/<type>` directory with starter files
  2. Add to `allServiceChoices` in scaffold.js (line ~141)
  3. Add default port to `defaultPorts` object
  4. Add Dockerfile generation logic in scaffold.js (optional, inline templates)
  5. Add service start command in `service-manager.js` `getStartCommand()` switch
  6. Update `hot` command watcher in `hotreload.js` if custom restart strategy needed
- **New CLI flag**: Extend commander `.option()` chain in bin/index.js; add interactive prompt to `interactiveQuestions` array if flag is optional
- **New hook point**: Add to `HOOK_POINTS` object in `plugin-system.js`; call via `await callHook('hook:name', context)` at appropriate point

## Dev & Testing
- **Local dev**: `npm install` → `node bin/index.js init demo --services node,python --no-install --yes`
- **Run tests**: `npm test` (runs `vitest run && npm run test:cleanup`)
- **Test patterns**:
  - Use `execa` to invoke CLI in temp directory (`fs.mkdtempSync(path.join(os.tmpdir(), 'polyglot-test-'))`)
  - Set generous timeouts (≥30s) for tests involving `create-next-app` or Java builds
  - Example: `await execa('node', [cliPath, 'init', projName, '--services', 'node', '--no-install', '--yes'], { cwd: tmpDir })`
  - Clean up with `fs.rmSync(tmpParent, { recursive: true, force: true })` in `afterAll()`
- **Template changes**: No build step; files copied verbatim. Ensure new top-level folders added to `files` array in package.json
- **Plugin system tests**: Reset `pluginSystem` state in `beforeEach()` (clear plugins Map, reset hooks via `createHooks()`)

## Key Dependencies
- **Process spawning**: `execa` (CLI invocation, git, npm install) with `stdio: 'inherit'` for user-visible output
- **File ops**: `fs-extra` (mkdirp, copy, readJson, writeJson)
- **Prompts**: `prompts` library (interactive CLI; skip if `--yes` or `process.env.CI === 'true'`)
- **Plugin system**: `hookable` (lifecycle hooks)
- **Logging**: `chalk` (colored output), `chokidar` (file watching for logs)
- **Monitoring**: `pidusage` (per-process CPU/memory), `systeminformation` (system-wide stats)
- **WebSocket**: `ws` library (admin dashboard log streaming)

## Pitfalls to Avoid
- Forgetting to update `defaultPorts` or `allServiceChoices` when adding a service type causes missing validation/config
- Mutating `services` array after port uniqueness check without re-validation can introduce collisions
- Adding large assets outside `templates/` may break npm packaging (check `files` array in package.json)
- Using `child_process` directly instead of `execa` loses error handling and promise-based control (exception: service-manager.js uses `spawn` for long-running processes)
- Not resetting plugin system state in tests causes cross-test pollution (hooks remain registered)

## Module Boundaries & Integration Points

### Service Lifecycle Integration
- `bin/index.js` parses commands → delegates to handlers in `bin/lib/`
- `scaffold.js` writes `polyglot.json` → all other commands read this manifest
- `dev.js` spawns admin dashboard via `spawn(process.execPath, [cliEntry, 'admin', ...])` (IPC via stdio)
- `service-manager.js` detects package manager (checks for lock files: package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb)
- Both `services/<name>` (new) and `apps/<name>` (legacy) paths supported throughout

### Log System Architecture
- `logs.js` exports `LogFileWatcher` class + helper functions (viewLogs, cleanupOldLogs)
- Each service gets `.logs/<date>.log` created by `initializeServiceLogs()`
- `admin.js` instantiates `globalLogWatcher` on dashboard start → emits events (`logsUpdated`, `logsCleared`)
- WebSocket endpoint `/ws` streams log updates to browser clients (custom protocol, not socket.io)
- Cache limit: 1000 lines per service in memory (server-side); client-side filters applied without refetch

### Plugin Hook Flow
- `plugin-system.js` exports `initializePlugins()` (must be called before hooks fire)
- Plugins discovered from `.polyglot/plugins/<name>/index.js` (local) or `node_modules/@create-polyglot/<name>` (npm)
- Hook execution order: plugins sorted by dependency graph, then by load order
- Context objects passed to hooks include `projectDir`, `config`, service details, etc.
- 60+ hook points across init, service CRUD, dev, docker, hotreload, admin, logs

### Resource Monitoring
- `resources.js` exports `ResourceMonitor` class (extends EventEmitter)
- Collects metrics every 5s (configurable): CPU%, memory, disk, network per service
- History stored in memory (max 720 entries = 1 hour at 5s intervals)
- Admin dashboard polls `/api/resources` endpoint (server aggregates from monitor instance)
- Uses `pidusage` for per-process stats, `systeminformation` for OS-level data

## Critical Files Reference
- **CLI entry**: `bin/index.js` (548 lines, commander-based routing)
- **Scaffold logic**: `bin/lib/scaffold.js` (1592 lines, handles init/add/remove)
- **Plugin system**: `bin/lib/plugin-system.js` (511 lines, hookable integration)
- **Service manager**: `bin/lib/service-manager.js` (369 lines, process spawning)
- **Log watcher**: `bin/lib/logs.js` (LogFileWatcher class + helpers)
- **Admin server**: `bin/lib/admin.js` (HTTP + WebSocket for dashboard)
- **Hot reload**: `bin/lib/hotreload.js` (227 lines, language-specific watchers)
- **Templates**: `templates/<type>` (node, python, go, spring-boot, frontend, libs/{python,go})
- **Tests**: `tests/*.test.js` (11 test files, Vitest runner)
- **CI/CD**: `.github/workflows/npm-publish.yml` (runs on release creation)

## Admin Dashboard & Log Streaming (Updated)
The admin dashboard (`startAdminDashboard` in `bin/lib/admin.js`) now uses a chokidar-powered file watcher for real-time service logs.

### Log Watching Implementation
- Class: `LogFileWatcher` in `bin/lib/logs.js`.
- Dependency added: `chokidar` (installed in root `package.json`).
- Watches each service's `.logs/*.log` files (supports both legacy `apps/<service>` and new `services/<service>` paths).
- Maintains an in-memory cache (`serviceLogsCache`) with latest logs per service (capped to 1000 per service when merging updates).
- Emits events to listeners: `logsUpdated` (with `event: add|change`), `logsCleared` (on file deletion).

### WebSocket Protocol (Simplified)
- Endpoint: `/ws` (still a minimal custom implementation—no external WS library).
- Client sends `{ type: 'start_log_stream', service: <optionalServiceName|null> }` to (re)subscribe.
- Server pushes messages:
	- `log_data`: initial batch (tail 100) for requested service or all services.
	- `log_update`: incremental updates (new lines) as files change.
	- `logs_cleared`: emitted when a log file is deleted (e.g., rotation/cleanup).
	- `error`: watcher or processing failures.

### Removed UI Elements / Behavior
- Manual "Refresh" and "Live Stream" buttons removed; streaming starts automatically on page load.
- No explicit "Start/Stop" toggling—connection auto-reconnects with exponential backoff on disconnect.
- Filtering (service, level, search text) is applied client-side against the cached `allLogsCache`.
- Re-sending `start_log_stream` with a new service filter requests a narrower set without page reload.

### Server-Side Changes
- `globalLogWatcher` initialized when dashboard starts; falls back gracefully if initialization fails.
- `/api/logs` now serves from watcher cache if available (still present for manual export and any non-WS consumers).

### Client-Side Changes (`admin.js` embedded script)
- Removed functions: `fetchLogs`, `toggleLogStream`, `stopLogStream`, `updateStreamButton`, incremental DOM `appendLogs` logic.
- Added in-memory `allLogsCache` and `applyClientFilters()` for dynamic filtering without refetch.
- Reconnect logic retains filters by re-sending latest `start_log_stream` payload on open.

### Considerations / Future Enhancements
- Potential optimization: send only new log line(s) instead of array (currently small overhead acceptable).
- Add backend endpoint for clearing logs (currently UI shows confirmation but warns unimplemented).
- Could expose a `since` param in WebSocket start message for time-based tailing.
- Log rotation: `cleanupOldLogs` keeps most recent 10 daily files; watcher handles file add/delete events transparently.

### Pitfalls to Avoid When Extending
- If introducing batching: ensure not to stall UI; prefer immediate push for smaller latency.
- When adjusting max cache size, reflect limits both server-side (merge logic) and client-side (slice for rendering).
- Avoid blocking operations in watcher event handler; heavy parsing should be deferred if logs grow large.

### Testing Notes
- Existing Vitest suite did not reference removed buttons; no test changes required.
- For new tests: simulate writing to `.logs/<date>.log` and assert WebSocket `log_update` is received (could add an integration test harness later).

Update this section if log streaming protocol or watcher boundaries change.

## CLI Usage Summary (Reference)
For detailed, user-facing examples see the README (search for "Quick Start", "Commands"). This section is a concise operator guide.

Primary commands:
- `create-polyglot init <name> [flags]` – Scaffold a new workspace. Flags: `-s, --services`, `--preset <turbo|nx|none>`, `--package-manager <npm|pnpm|yarn|bun>`, `--git`, `--yes`, `--frontend-generator`.
- `create-polyglot add service <name> --type <node|python|go|java|frontend> [--port <p>] [--yes]` – Append a service to an existing workspace.
- `create-polyglot dev [--docker]` – Local dev runner (frontend + node by default). With `--docker` delegates to Docker Compose for all services.
- `create-polyglot hot [--services a,b] [--dry-run]` – Unified hot reload orchestrator across selected services.
- `create-polyglot admin [--port <p>] [--open false]` – Start admin dashboard (status + real-time logs).
- `create-polyglot logs [<service>] [--tail <n>] [--level <error|warn|info|debug>] [--filter <regex>] [--since <relative|ISO>] [--clear]` – CLI log viewing / maintenance.

Behavior notes:
- `init` writes `polyglot.json` manifest which powers all subsequent commands.
- Port uniqueness enforced during `init` and `add service`; collisions abort early.
- `hot` uses language-specific runners (e.g. Node via `nodemon` or custom; Python via `uvicorn`; Go recompile; Java Spring Boot restart) aggregated in a single multiplexed output.
- `admin` now auto-streams logs (no refresh or manual toggle) leveraging `LogFileWatcher` + WebSocket events described above.
- `logs --clear` performs per-service log directory cleanup (invokes helper in `logs.js`). Non-critical failures warn.
- `dev --docker` assumes generated Dockerfiles; if one is missing for a service, generation logic from scaffold covers it.

Error handling conventions:
- Hard validation failures → red emoji + `process.exit(1)` prior to partial writes.
- Soft failures (git init, dependency install, external generators) log yellow warning and continue.

Testing guidance:
- Prefer `execa` for invoking CLI within tests; set generous timeouts (≥30s) for Next.js or Java operations.
- For admin log stream tests, you can simulate writes to `.logs/<date>.log` then assert WebSocket `log_update` message.

When extending:
- Add new command flags in `bin/index.js` commander chain; reflect in README and this summary.
- Keep README examples authoritative; this section should remain concise.

---
Feedback: Let me know if any sections need more depth (e.g., Docker generation, prompt flow, adding new presets) or if emerging conventions should be captured.
