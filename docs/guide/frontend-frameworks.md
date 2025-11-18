# Modern Frontend Framework Support

create-polyglot can scaffold additional frontend frameworks beyond the default Next.js.

## Supported Frameworks

- **Next.js** (internal template or `create-next-app` when `--frontend-generator` is passed)
- **Remix** (via `npx create-remix@latest . --template remix`)
- **Astro** (via `npx create-astro@latest -- --template minimal`)
- **SvelteKit** (via `npx sv create .`; falls back to `npx create-svelte@latest . --template skeleton` if the new command fails)

## Selecting Frameworks

Specify them in the `--services` list during init or with `create-polyglot add service`:

```bash
create-polyglot init my-stack -s remix,astro,sveltekit --yes
create-polyglot add service docs --type astro --port 3030
```

## Ports

Default ports:

```text
remix:     3005
astro:     3006
sveltekit: 3007
```

Override any port via `type:name:port` syntax:

```bash
create-polyglot init web-app -s remix:web:3100,astro:site:3200,sveltekit:kit:3300 --yes
```

## Generation Behavior

| Framework | Generation Method | Fallback | Notes |
|-----------|-------------------|----------|-------|
| Remix     | `create-remix`    | None (skip on failure) | Skipped if generator errors. |
| Astro     | `create-astro`    | None (skip on failure) | Uses `--template minimal`. |
| SvelteKit | `sv create`       | `create-svelte`        | Deprecation handled gracefully. |

Failed generators log an error and the service is skipped (not partially scaffolded) to avoid broken directories.

## Docker

All Node-based frameworks (Remix, Astro, SvelteKit) reuse the generic Node Dockerfile pattern:

```Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || true
COPY . .
EXPOSE <PORT>
CMD ["npm", "run", "dev"]
```

Adjust after generation if framework-specific build or preview commands are desired.

## Service Manager

Runtime start uses the detected package manager and `npm run dev` (or equivalent) for these frameworks. Ensure the generator produces a `dev` script. If not, add one manually.

## Caveats & Future Plans

- No internal fallback templates (kept lean). Potential future flag: `--allow-fallback`.
- Post-generation customization (eslint, prettier) left to user.
- May add automatic build scripts & production Docker variants later.

## Example Full Init

```bash
npx create-polyglot init multi-web -s node,remix,astro,sveltekit --git --yes
```

After scaffold:

```bash
cd multi-web
npm run list:services
create-polyglot dev
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Generator network failure | Offline or registry issue | Retry with stable connection; consider adding fallback templates. |
| Missing dev script | Generator changed defaults | Add `"dev": "<framework command>"` to `package.json`. |
| Port collision | Duplicate specified port | Re-run with adjusted port list or edit `polyglot.json` then restart. |
| SvelteKit deprecation warning | Using legacy command | Ensure `sv` is available; keep fallback until ecosystem fully migrates. |

## Updating Existing Workspace

Add a new framework to an existing project:

```bash
create-polyglot add service ui-new --type sveltekit --port 3400
```

Remove it later:

```bash
create-polyglot remove service ui-new --yes
```

---

Need another framework (e.g., Nuxt, SolidStart)? Open an issue or PR with a proposed generator command.
