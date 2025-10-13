# Contributing to `create-polyglot`

Thanks for your interest in contributing\! Your help is vital for growing the **polyglot microservice ecosystem**. This document is your comprehensive guide to setting up a local development environment, understanding our development process, and successfully proposing changes.

We strive to be an open, inclusive, and welcoming project. If you have any questions, don't hesitate to **open a discussion or an issue**\!

-----

## Table of Contents

1.  **🚀 For First-Time Contributors**
2.  Prerequisites
3.  Project Overview
4.  Getting Started (Local Dev)
5.  **🔬 Running, Testing, and Debugging the CLI**
6.  **💻 Development Workflow**
7.  **🧱 Adding or Updating Service Templates**
8.  **🔗 Adding External Generators**
9.  Docker & Compose Generation
10. Presets (Turborepo / Nx)
11. Shared Packages (Workspaces)
12. **🎨 Code Style & Tooling**
13. **💬 Commit Message Conventions**
14. Testing Strategy (Current & Future)
15. Releasing / Publishing
16. **📝 Issue Reporting & Pull Request Guidelines**
17. Security / Responsible Disclosure
18. **🔭 Roadmap & Future Features**

-----

## 1\. 🚀 For First-Time Contributors

Welcome to open source\! We're thrilled to have you. Here are a few tips to get you started:

### Starting Your First Contribution

1.  **Look for "Good First Issue":** Check our **[Issues](https://www.google.com/search?q=link-to-issues-page)** page and filter by the **`good first issue`** label. These tasks are specifically chosen to be great entry points into the project.
2.  **Say Hello:** If you plan to work on an issue, leave a comment like "I'd like to work on this\!" to let others know you're taking it on.
3.  **Fork and Clone:** Follow the instructions in **Section 4** to get your local environment set up.
4.  **Ask Questions:** Don't struggle in silence\! If you get stuck or need clarification on any part of the codebase or documentation, please ask in the issue thread. No question is too basic.

### Anatomy of a Contribution

A typical contribution, from start to finish, looks like this:

1.  **Fork** the repository to your own GitHub account.
2.  **Clone** your fork locally.
3.  **Create a new branch** for your feature or fix (e.g., `git checkout -b feat/add-rust-service`).
4.  **Develop** and test your changes.
5.  **Commit** your changes using the conventions in **Section 13**.
6.  **Push** your branch to your fork.
7.  **Open a Pull Request (PR)** against the main `create-polyglot` repository.

-----

## 2\. Prerequisites

  - **Node.js**: **\>= 20** (We target the current LTS / Active version - commander@14 & other deps require current LTS / Active version).
  - **npm** (or pnpm / yarn / bun if you want to test multi-PM flows).
  - **Git** for version control.
  - Internet access if you test the `--frontend-generator` flag (uses `npx create-next-app`).

**Optional tooling (needed for testing all generated services):**

  - Docker (to validate generated Dockerfiles / `compose.yaml`).
  - Java 21 & Maven for the Spring Boot template build.
  - Go toolchain ($\ge 1.22$) for the Go service.
  - Python 3.12 for the FastAPI service.

-----

## 3\. Project Overview

`create-polyglot` scaffolds a polyglot microservice monorepo supporting multiple languages & frameworks:

  - Node.js (Express)
  - Python (FastAPI)
  - Go (net/http minimal)
  - Java (Spring Boot)
  - Frontend (Next.js) via internal template or `create-next-app` generator

Features:
- Interactive wizard (like `create-next-app`) if no arguments passed.
- Non‑interactive flags for automation.
- Optional presets: Turborepo or Nx.
- Shared workspace package example (`packages/shared`).
- Dockerfile generation + `compose.yaml` (multi-service) with a shared network.
- Linting / formatting (ESLint + Prettier) + root scripts.

-----

## 4\. Getting Started (Local Dev)

Get the project running on your machine:

```bash
# Clone your fork
git clone https://github.com/<your-username>/create-polyglot.git
cd create-polyglot

# Install dependencies (this uses the package-lock.json)
npm install

# Link globally to test the CLI as if it were installed via npm
npm link
```

**Run interactively:**

```bash
create-polyglot
```

**Run scripted (for quick testing):**

```bash
create-polyglot demo -s node,python,go,java,frontend --preset turborepo --git
```

**To unlink later:**

```bash
npm unlink -g create-polyglot
```

-----

## 5\. 🔬 Running, Testing, and Debugging the CLI

You don't need to link the package to test changes; you can execute the main script directly.

### Running Locally Without Linking

This is the fastest way to test your changes:

```bash
# Execute the main entry file directly
node bin/index.js my-app -s node,python
```

### Logging and Debugging

You can instrument logs in the CLI logic. If you add debug branches, use the `DEBUG` environment variable to enable them:

```bash
# Example: If your code uses `if (process.env.DEBUG)`
DEBUG=1 node bin/index.js my-app
```

For a full debugging experience with a tool like **VS Code** or Chrome DevTools:

```bash
# This starts the Node process and pauses on the first line of code
node --inspect-brk bin/index.js demo -s node
```

You can insert `console.log` statements or use an inspector then attach your debugger to the running process.

### Testing a Scaffold Locally

Before submitting a PR, always run a full test scaffold and assert the output:

```bash
# This generates a test project, runs no-install, and force-overwrites any existing output
node bin/index.js test-project -s node,python,go --preset turborepo --no-install --force
```

After generation, manually inspect the `test-project` folder to ensure all files, templates, and configurations (like `turbo.json` or `Dockerfile`s) are correct.

-----

## 6\. 💻 Development Workflow

To ensure a smooth workflow and successful PR:

1.  **Create a New Branch:** Always branch off `main` for your work.
    ```bash
    git checkout main
    git pull origin main
    git checkout -b [type/short-description] # e.g., feat/add-rust-service
    ```
2.  **Develop:** Write your code, and commit frequently.
3.  **Code Style:** Run formatting and linting before you commit (see **Section 12**).
4.  **Commit Messages:** Follow the Conventional Commits specification (**Section 13**).
5.  **Rebase (Optional but Recommended):** Before creating the PR, consider rebasing your branch on top of the latest `main` to keep your history clean.
    ```bash
    git fetch origin
    git rebase origin/main
    ```

-----

## 7\. 🧱 Adding or Updating Service Templates

Adding a new or updating service templates is one of the most common contributions.

### Best Practices for Templates

  - **Keep it Minimal:** Templates should contain only the most essential runnable code. Avoid large, slow-to-install dependency graphs.
  - **Scaffolding Speed:** The faster the template scaffolds, the better the user experience.
  - **Consistency:** Provide a minimal `/health` endpoint for consistency with our multi-service setup.
  - **Port Handling:** Avoid binding privileged or random ports. Use a hardcoded, available port (e.g., 3000-3004) that is configured via an environment variable (`PORT`).

### Steps to Add a New Template

1.  **Create Template Folder:** Add a folder under `templates/<service-name>`.
2.  **Include Manifests:** Add necessary dependency manifests (e.g., `package.json`, `Cargo.toml`, `pom.xml`).
3.  **Handle Tooling Conflicts:** If your template contains files that tooling might auto-ignore (like a hidden config file), you can store it as `.txt` and rename it during the copy process (see Spring Boot handling in `bin/index.js`).
4.  **Update CLI Logic:**
      * Update the `allServiceChoices` array in `bin/index.js`.
      * If an alias is needed (e.g., users can type `node` or `nodejs`), add it to the `templateMap`.
5.  **Update Documentation:** Document your new service in the main `README.md` and (optionally) in the CLI's `--help` output.

-----

## 8\. 🔗 Adding External Generators

External generators, like `create-next-app`, allow users to leverage existing, feature-rich tools.

### Recommended Practices for Generators

  - **Opt-in Execution:** External executions can be slow and often require user interaction. They should always be opt-in (e.g., behind a flag like `--use-generator`).
  - **Graceful Failure:** Always wrap external execution calls in a `try/catch` block and fall back to an internal template if the external command fails.

### Steps to Add a New Generator

1.  **Introduce a Flag:** If needed, introduce a new, general flag (e.g., `--use-generator <service:generator-command>`).
2.  **Implement `execa`:** Use the `execa` library to run the external tool (e.g., `npx <generator-command>`) in the target directory.
3.  **Sanitize:** Ensure the target directory is clean (e.g., remove pre-existing files) *before* invoking the external generator, as they often assume an empty directory.
4.  **Configuration:** Ensure the generated code is compatible with our monorepo presets (e.g., adjust the `package.json` for **Turborepo** or **Nx**).

-----

## 9\. Docker & Compose Generation

The generator creates per-service `Dockerfile`s and a root `compose.yaml`.

  - **Shared network:** `app-net`.
  - **Port Mapping:** Ports are mapped 1:1 (e.g., Node 3001:3001).
  - **Configuration:** `PORT` environment variable is injected.

To modify generation logic, edit the relevant section in `bin/index.js` (look for `// Generate Dockerfiles + compose.yaml`).
Consider adding `healthcheck` blocks or dependencies (e.g., databases) behind a new flag `--with-db`.

**Testing:**

```bash
cd <generated-project>
docker compose up --build
```

-----

## 10\. Presets (Turborepo / Nx)

Presets are selected via flags like `--preset turborepo` or `--preset nx`.

  - Presets alter the root `dev` script.
  - Presets add relevant configuration files (`turbo.json` or `nx.json`) and dev dependencies.

To add a new preset, extend the conditional block where `rootPkg` is built, then emit configuration file.

-----

## 11\. Shared Packages (Workspaces)

The example `packages/shared` demonstrates a simple util export.

To add new shared libs:

```bash
# Create package.json and import/export logic
mkdir -p packages/logger/src
cat > packages/logger/package.json <<'EOF'
{
  "name": "@shared/logger",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.js"
}
EOF
```

Remember that currently, only Node.js / Frontend services can consume these shared packages via the workspace system. Other languages maintain their own dependency systems.

-----

## 12\. 🎨 Code Style & Tooling

Consistency makes the code easier to read, debug, and maintain.

  - **Formatting**: We use **Prettier** (`npm run format`). Always run this before submitting a PR.
  - **Linting**: We use **ESLint** (`npm run lint`).
  - **CLI Structure:** Keep `bin/index.js` logically segmented. Prefer **small helper functions** and **modularity** as the file grows.
  - **Language:** Keep the CLI logic in vanilla Node.js/JavaScript. Avoid introducing TypeScript unless you also add a proper build step.
  - **Style Guide:**
      * Prefer **async/await** over older promise chains.
      * Use **clear, graceful error handling** with actionable messages for the user.
      * Maintain a direct and imperative tone in user prompts and messages.

-----

## 13\. 💬 Commit Message Conventions

We enforce **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**. This standard helps us automate changelog generation and version bumping.

| Type | When to Use | Example |
| :--- | :--- | :--- |
| **`feat`** | A new feature or capability. | `feat: add Rust service template` |
| **`fix`** | A bug fix. | `fix: correct compose environment mapping for Python` |
| **`chore`** | Routine tasks, no code changes (e.g., dependency bumps). | `chore: bump dependencies` |
| **`refactor`** | Code changes that neither fix a bug nor add a feature. | `refactor: extract docker writer helper` |
| **`docs`** | Documentation-only changes. | `docs: update contributing guidelines` |
| **`style`** | Formatting, missing semicolons, etc. (differs from `chore`). | `style: enforce single quotes with prettier` |

**Example Commit:**

```
fix: correct compose environment mapping for Python

The FASTAPI service was using port 8000 internally but the compose.yaml
was incorrectly mapping 3002. This commit corrects the internal port
mapping and updates the Dockerfile.
```

-----

## 14\. Testing Strategy (Current & Future)

Currently there are no automated tests.

**Suggested Roadmap:**

  - **Unit Tests:** For helper functions (after refactoring CLI logic into modules).
  - **Snapshot Tests:** For generated directory structures.
  - **E2E Tests:** Using a temporary directory: run the CLI, assert expected files exist, and run a health check on the generated service.
  - **Potential Frameworks:** **`vitest`** or **`jest`**.

-----

## 15\. Releasing / Publishing

The maintainers handle this process, but here is the process:

1.  Ensure `main` is green and documentation is up to date.
2.  Bump version in `package.json` (following semver).
3.  Update / create `CHANGELOG.md`.
4. Commit & tag:
   ```bash
   git add .
   git commit -m "chore: release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```
5. Publish:
   ```bash
   npm publish --access public
   ```
6. Verify install:
   ```bash
   npx create-polyglot --help
   ```

-----

## 16\. 📝 Issue Reporting & Pull Request Workflow

### Issue Reporting

  - Use the issue template (if/when added).
  - Provide **clear reproduction steps**.
  - Include your environment details (OS, Node version, command run).
  - State the **expected** vs. **actual** behavior.

### Pull Request Checklist

  - **Focus:** Each PR should address one focused change, feature, or bug fix.
  - **Testing:** **Always** run a local scaffold test (`node bin/index.js test-app ...`) and inspect the output.
  - **Checklist:**
      * [ ] I have tested my changes locally by running a full scaffold.
      * [ ] My PR only contains changes directly related to the fix/feature.
      * [ ] I have updated the documentation (README / CONTRIBUTING) if a major behavior changed.
      * [ ] My commits follow the **Conventional Commits** standard.
  - **Review Tips:** Split big refactors or feature additions into multiple smaller, digestible PRs whenever possible.

-----

## 17\. Security / Responsible Disclosure

If you discover a security issue (e.g., a command injection risk in the generator inputs), **do not** open a public issue immediately.

Please contact the maintainer directly through the channel listed in the `README.md` or via a GitHub Security Advisory. Provide clear reproduction details so we can address it as quickly as possible. Provide clear reproduction details.

-----

## 18\. 🔭 Roadmap & Future Features / Ideas

We're constantly evolving\! Here are some ways you can contribute to the future of `create-polyglot`:

- Add additional language templates: Rust (Axum), .NET (Minimal API), PHP (Laravel Octane lightweight variant), Deno/Fresh.
- Configurable port allocation & detection of conflicts.
- Pluggable recipe system (YAML describing services & generators).
- Telemetry (opt-in) for anonymized feature usage.
- `--with-ci github-actions` to generate workflow.
- Test harness & code coverage.
- Multi-stage infra: generate k8s manifests or helm charts.
- Monorepo plugin system for custom user templates in `~/.config/create-polyglot/templates`.

-----

## Questions / Help

Open an issue or start a discussion. PRs are always welcome\!

Happy building 🌟