# Extending: New Service Type

To add a new service:

1. Create a template folder under `templates/<service>` with minimal runnable code + README (optional).
2. Update service choices in `bin/lib/scaffold.js` and the `add` command in `bin/index.js`.
3. Add a default port in `defaultPorts` map.
4. Add Dockerfile generation logic inside the service loop (match existing patterns).
5. Add compose entry fields if needed (environment variables, healthchecks in future).
6. Update docs & tests (`tests/smoke.test.js`) to include the new service.

Update default port maps and compose/Docker generation if needed.

Validate by scaffolding a test project and confirming:
- Dockerfile exists
- Port is unique / not colliding
- Service appears in summary table
