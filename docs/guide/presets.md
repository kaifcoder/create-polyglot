# Presets

You can select a preset via `--preset turborepo` or `--preset nx`.

| Preset | Effect |
| ------ | ------ |
| (none) | Adds `scripts/dev-basic.cjs` and uses a simple concurrent runner |
| turborepo | Adds `turbo.json` and sets `dev` script to `turbo run dev --parallel` |
| nx | Adds `nx.json` and sets `dev` script to `nx run-many -t dev --all` |

All presets share the same templates; only orchestration & caching strategies differ.
