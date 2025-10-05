# CLI Usage

Initialize:
```bash
create-polyglot init my-org -s node,python --preset turborepo --git
```
Root invocation without `init` is deprecated.

Add a service:
```bash
create-polyglot add service analytics --type node --port 4300
```

Add a plugin:
```bash
create-polyglot add plugin kafka
```

Run dev (local processes):
```bash
create-polyglot dev
```

Run dev via Docker Compose:
```bash
create-polyglot dev --docker
```

Health endpoints are polled at `/health` on each service port with a 15s timeout.
