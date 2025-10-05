# Getting Started

## Install
```bash
npm install -g create-polyglot
```

## Scaffold a Project
```bash
create-polyglot my-org -s node,python,go,java,frontend --git
```
If you omit flags, the wizard prompts for missing values.

## Directory Layout
```
my-org/
  apps/
    node/ python/ go/ java/ frontend/
  packages/shared
  compose.yaml
  package.json
```

## Dev Workflow
```bash
cd my-org
npm run dev     # starts Node-based dev scripts (basic or preset orchestration)
```
Non-Node services (Python/Go/Java) start manually or via Docker compose:
```bash
docker compose up --build
```
