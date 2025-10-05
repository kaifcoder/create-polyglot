# Flags

| Flag | Description |
| ---- | ----------- |
| `-s, --services <list>` | (init) Comma separated services (`node,python,go,java,frontend`). Supports `type:name:port` triples. |
| `--preset <name>` | `turborepo`, `nx`, or none. Alters dev script + config file. |
| `--no-install` | Skip root dependency installation step. |
| `--git` | Initialize git repo & initial commit. |
| `--force` | Overwrite non-empty target directory. |
| `--package-manager <pm>` | `npm|pnpm|yarn|bun` (default detection or npm). |
| `--frontend-generator` | (init) Use `create-next-app` for the frontend instead of template (fallback on failure). |
| `--type <type>` | (add service) Service type without prompt. |
| `--port <port>` | (add service) Desired port (default auto if omitted). |
| `--lang <type>` | (Deprecated) Alias of `--type`. |
| `--yes` | Non-interactive defaults (project: `app`, services: `node`). |

Defaults when `--yes` provided and flag not explicitly set:
```
projectName=app
services=node
preset=none
packageManager=npm
git=false
```
