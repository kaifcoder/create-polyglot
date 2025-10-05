# Getting Started

## Install
```bash
npm install -g create-polyglot
```

## Scaffold a Project
```bash
create-polyglot init my-org -s node,python,go,java,frontend --git --yes
```
If you omit flags (or drop `--yes`), the wizard prompts for missing values and lets you rename services + adjust ports.

## Directory Layout
```
my-org/
  services/
    node/ python/ go/ java/ frontend/
  packages/shared
  polyglot.json
  compose.yaml
  package.json
```

## Dev Workflow
```bash
cd my-org
npm run dev     # starts Node-based dev scripts (scans services/)
```
Non-Node services (Python/Go/Java) start manually or via Docker compose:
```bash
docker compose up --build

## Add a Service Later
```bash
create-polyglot add service reporting --type python --port 5050
```

## Add a Plugin
```bash
create-polyglot add plugin auth
```
```
