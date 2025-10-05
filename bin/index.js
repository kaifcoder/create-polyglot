#!/usr/bin/env node
import { Command } from "commander";
import prompts from "prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import url from "url";
import { execa } from "execa";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const program = new Command();

program
  .name("create-polyglot")
  .description("Scaffold a polyglot microservice monorepo")
  .argument("[project-name]", "Name of the project (optional, will prompt if omitted)")
  .option("-s, --services <services>", "Comma separated list of services (node,python,go,java,frontend)")
  .option("--preset <preset>", "Add preset: turborepo | nx")
  .option("--no-install", "Skip installing dependencies at the root")
  .option("--git", "Initialize a git repository")
  .option("--force", "Overwrite if directory exists and not empty")
  .option("--package-manager <pm>", "npm | pnpm | yarn | bun (default: npm)")
  .option("--frontend-generator", "Use create-next-app to scaffold the frontend instead of the bundled template")
  .action(async (projectNameArg, options) => {
    try {
      // Collect interactive data if arguments / flags not provided
      let projectName = projectNameArg;
      const interactiveQuestions = [];

      if (!projectName) {
        interactiveQuestions.push({
          type: 'text',
          name: 'projectName',
          message: 'Project name:',
          validate: v => v && /^[a-zA-Z0-9._-]+$/.test(v) ? true : 'Use alphanumerics, dash, underscore, dot'
        });
      }
      if (!options.services) {
        interactiveQuestions.push({
          type: 'multiselect',
          name: 'services',
          message: 'Select services to include:',
          choices: [
            { title: 'Node.js (Express)', value: 'node' },
            { title: 'Python (FastAPI)', value: 'python' },
            { title: 'Go (Fiber-like)', value: 'go' },
            { title: 'Java (Spring Boot)', value: 'java' },
            { title: 'Frontend (Next.js)', value: 'frontend' }
          ],
          instructions: false,
          min: 1
        });
      }
      if (!options.preset) {
        interactiveQuestions.push({
          type: 'select',
          name: 'preset',
            message: 'Preset (optional):',
            choices: [
              { title: 'None', value: '' },
              { title: 'Turborepo', value: 'turborepo' },
              { title: 'Nx', value: 'nx' }
            ],
            initial: 0
        });
      }
      if (!options.packageManager) {
        interactiveQuestions.push({
          type: 'select',
          name: 'packageManager',
          message: 'Package manager:',
          choices: [
            { title: 'npm', value: 'npm' },
            { title: 'pnpm', value: 'pnpm' },
            { title: 'yarn', value: 'yarn' },
            { title: 'bun', value: 'bun' }
          ],
          initial: 0
        });
      }
      if (options.git === undefined) {
        interactiveQuestions.push({
          type: 'toggle',
          name: 'git',
          message: 'Initialize git repository?',
          active: 'yes',
          inactive: 'no',
          initial: true
        });
      }

      let answers = {};
      if (interactiveQuestions.length) {
        answers = await prompts(interactiveQuestions, {
          onCancel: () => {
            console.log(chalk.red('\n✖ Cancelled.'));
            process.exit(1);
          }
        });
      }

      projectName = projectName || answers.projectName;
      if (!projectName) {
        console.error(chalk.red('Project name is required.'));
        process.exit(1);
      }
      options.services = options.services || (answers.services ? answers.services.join(',') : undefined);
      if (!options.services) {
        console.error(chalk.red('At least one service must be selected.'));
        process.exit(1);
      }
      options.preset = options.preset || answers.preset || '';
      options.packageManager = options.packageManager || answers.packageManager || 'npm';
      if (options.git === undefined) options.git = answers.git;

      console.log(chalk.cyanBright(`\n🚀 Creating ${projectName} monorepo...\n`));

      const allServiceChoices = [
        { title: "Node.js (Express)", value: "node" },
        { title: "Python (FastAPI)", value: "python" },
        { title: "Go (Fiber-like)", value: "go" },
        { title: "Java (Spring Boot)", value: "java" },
        { title: "Frontend (Next.js)", value: "frontend" }
      ];

      const templateMap = { java: "spring-boot" }; // alias -> folder name

      // services: { type, name, port }
      let services = [];
      const reservedNames = new Set(['scripts','packages','apps','node_modules','docker','compose','compose.yaml']);
      const defaultPorts = { frontend: 3000, node: 3001, go: 3002, java: 3003, python: 3004 };

      if (options.services) {
        const validValues = allServiceChoices.map(c => c.value);
        const rawEntries = options.services.split(',').map(s => s.trim()).filter(Boolean);
        for (const entry of rawEntries) {
          const parts = entry.split(':').map(p => p.trim()).filter(Boolean);
          const type = parts[0];
          if (!validValues.includes(type)) {
            console.error(chalk.red(`Invalid service type: ${type}`));
            process.exit(1);
          }
          const name = parts[1] || type;
          const portStr = parts[2];
          if (reservedNames.has(name)) {
            console.error(chalk.red(`Service name '${name}' is reserved.`));
            process.exit(1);
          }
          if (services.find(s => s.name === name)) {
            console.error(chalk.red(`Duplicate service name detected: ${name}`));
            process.exit(1);
          }
          let port = defaultPorts[type];
          if (portStr) {
            const parsed = Number(portStr);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
              console.error(chalk.red(`Invalid port '${portStr}' for service '${name}'.`));
              process.exit(1);
            }
            port = parsed;
          }
          services.push({ type, name, port });
        }
      } else {
        // Interactive selection of service types
        const answer = await prompts({
          type: 'multiselect',
          name: 'serviceTypes',
          message: 'Select services to include:',
          choices: allServiceChoices,
          instructions: false,
          min: 1
        });
        const selected = answer.serviceTypes || [];
        for (const type of selected) services.push({ type, name: type, port: defaultPorts[type] });

        // Custom name & port prompts
        for (let i = 0; i < services.length; i++) {
          const svc = services[i];
          const rename = await prompts({
            type: 'text',
            name: 'newName',
            message: `Name for ${svc.type} service (leave blank to keep '${svc.name}'):`,
            validate: v => !v || (/^[a-zA-Z0-9._-]+$/.test(v) ? true : 'Use alphanumerics, dash, underscore, dot')
          });
          if (rename.newName && rename.newName !== svc.name) {
            if (reservedNames.has(rename.newName)) {
              console.log(chalk.red(`Name '${rename.newName}' is reserved. Keeping '${svc.name}'.`));
            } else if (services.find(s => s !== svc && s.name === rename.newName)) {
              console.log(chalk.red(`Name '${rename.newName}' already used. Keeping '${svc.name}'.`));
            } else {
              svc.name = rename.newName;
            }
          }
          const portResp = await prompts({
            type: 'text',
            name: 'newPort',
            message: `Port for ${svc.name} (${svc.type}) (default ${svc.port}):`,
            validate: v => !v || (/^\d+$/.test(v) && +v > 0 && +v <= 65535) ? true : 'Enter a valid port 1-65535'
          });
          if (portResp.newPort) {
            const newPort = Number(portResp.newPort);
            if (services.find(s => s !== svc && s.port === newPort)) {
              console.log(chalk.red(`Port ${newPort} already used; keeping ${svc.port}.`));
            } else {
              svc.port = newPort;
            }
          }
        }
      }

      if (services.length === 0) {
        console.log(chalk.yellow('No services selected. Exiting.'));
        process.exit(0);
      }

      // Validate final port uniqueness
      const portMap = new Map();
      for (const s of services) {
        if (portMap.has(s.port)) {
          console.error(chalk.red(`Port conflict: ${s.name} and ${portMap.get(s.port)} both use ${s.port}`));
          process.exit(1);
        }
        portMap.set(s.port, s.name);
      }

      // Summary & confirmation
      console.log(chalk.magenta('\nSummary:'));
      console.table(services.map(s => ({ type: s.type, name: s.name, port: s.port })));
      console.log(`Preset: ${options.preset || 'none'}`);
      console.log(`Package Manager: ${options.packageManager}`);
      const { proceed } = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with scaffold?',
        initial: true
      });
      if (!proceed) {
        console.log(chalk.red('✖ Aborted by user.'));
        process.exit(1);
      }

  const projectDir = path.join(process.cwd(), projectName);
      if (await fs.pathExists(projectDir)) {
        const contents = await fs.readdir(projectDir);

        if (contents.length > 0 && !options.force) {
          console.error(chalk.red(`❌ Directory '${projectName}' already exists and is not empty. Use --force to continue.`));
          process.exit(1);
        }
      }
      fs.mkdirSync(projectDir, { recursive: true });

  console.log(chalk.yellow("\n📁 Setting up monorepo structure..."));
      const appsDir = path.join(projectDir, "apps");
      fs.mkdirSync(appsDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, "packages"), { recursive: true });

  // servicePorts was defined earlier (used for defaults)

      for (const svcObj of services) {
        const { type: svcType, name: svcName, port: svcPort } = svcObj;
        const templateFolder = templateMap[svcType] || svcType; // actual template dir
        const src = path.join(__dirname, `../templates/${templateFolder}`);
        const dest = path.join(appsDir, svcName);
        fs.mkdirSync(dest, { recursive: true });
        let usedGenerator = false;
        if (svcType === 'frontend' && options.frontendGenerator) {
          // Attempt to run create-next-app
          try {
            console.log(chalk.cyan(`⚙️  Running create-next-app for frontend...`));
            // ensure directory empty
            const existing = await fs.readdir(dest);
            for (const f of existing) await fs.remove(path.join(dest, f));
            // Use npx; adapt to chosen package manager if needed later
            await execa('npx', [
              '--yes',
              'create-next-app@latest',
              '.',
              '--eslint',
              '--app',
              '--src-dir',
              '--no-tailwind',
              '--use-npm',
              '--no-ts'
            ], { cwd: dest, stdio: 'inherit' });
            usedGenerator = true;
          } catch (e) {
            console.log(chalk.yellow('⚠️  create-next-app failed, falling back to internal template. Error:'), e.shortMessage || e.message);
          }
        }
        if (!usedGenerator) {
          if (await fs.pathExists(src) && (await fs.readdir(src)).length > 0) {
            await fs.copy(src, dest, { overwrite: true });
            if (templateFolder === "spring-boot") {
              const propTxt = path.join(dest, "src/main/resources/application.properties.txt");
              const prop = path.join(dest, "src/main/resources/application.properties");
              if (await fs.pathExists(propTxt) && !(await fs.pathExists(prop))) {
                await fs.move(propTxt, prop);
              }
            }
          } else {
            await fs.writeFile(path.join(dest, `README.md`), `# ${svc} service\n\nScaffolded by create-polyglot.`);
          }
        }
        console.log(chalk.green(`✅ Created ${svcName} (${svcType}) service on port ${svcPort}`));
      }

      // root package.json
      const rootPkgPath = path.join(projectDir, "package.json");
      const rootPkg = {
        name: projectName,
        private: true,
        version: "0.1.0",
        workspaces: ["apps/*", "packages/*"],
        scripts: {
          dev: "node scripts/dev-basic.cjs",
          "list:services": "ls apps",
          format: "prettier --write .",
          lint: "eslint \"apps/**/*.{js,jsx,ts,tsx}\" --max-warnings 0 || true"
        },
        devDependencies: {
          prettier: "^3.3.3",
          eslint: "^9.11.1",
            "eslint-config-prettier": "^9.1.0",
            "eslint-plugin-import": "^2.29.1"
        }
      };
      if (options.preset === 'turborepo') {
        rootPkg.scripts.dev = 'turbo run dev --parallel';
        rootPkg.devDependencies.turbo = '^2.0.0';
      } else if (options.preset === 'nx') {
        rootPkg.scripts.dev = 'nx run-many -t dev --all';
        rootPkg.devDependencies.nx = '^19.8.0';
      }
      await fs.writeJSON(rootPkgPath, rootPkg, { spaces: 2 });

      // Copy basic dev runner if using basic preset (or no preset)
      if (!options.preset) {
        const scriptsDir = path.join(projectDir, 'scripts');
        await fs.mkdirp(scriptsDir);
        const runnerSrc = path.join(__dirname, '../scripts/dev-basic.cjs');
        try {
          if (await fs.pathExists(runnerSrc)) {
            await fs.copy(runnerSrc, path.join(scriptsDir, 'dev-basic.cjs'));
          }
        } catch (e) {
          console.log(chalk.yellow('⚠️  Failed to copy dev-basic runner:', e.message));
        }
      }

  // README
      const readmePath = path.join(projectDir, "README.md");
  const svcList = services.map(s => `- ${s.name} (${s.type}) port:${s.port}`).join("\n");
      await fs.writeFile(readmePath, `# ${projectName}\n\nGenerated with create-polyglot.\n\n## Services\n${svcList}\n\n## Preset\n${options.preset || 'none'}\n\n## Commands\n- list services: \`npm run list:services\`\n- dev: \`npm run dev\`\n- lint: \`npm run lint\`\n- format: \`npm run format\`\n\n## Docker Compose\nSee compose.yaml (generated).\n`);

      // Shared library example
      const sharedDir = path.join(projectDir, 'packages/shared');
      if (!(await fs.pathExists(sharedDir))) {
        await fs.mkdirp(path.join(sharedDir, 'src'));
        await fs.writeJSON(path.join(sharedDir, 'package.json'), {
          name: '@shared/utils', version: '0.0.1', type: 'module', main: 'src/index.js'
        }, { spaces: 2 });
        await fs.writeFile(path.join(sharedDir, 'src/index.js'), `export function greet(name){return \`Hello, ${'${'}name}\`;}`);
      }

      // Lint / format configs
      await fs.writeFile(path.join(projectDir, '.eslintrc.cjs'), `module.exports={root:true,env:{node:true,es2022:true},extends:['eslint:recommended','plugin:import/recommended','prettier'],parserOptions:{ecmaVersion:'latest',sourceType:'module'},rules:{}};\n`);
      await fs.writeJSON(path.join(projectDir, '.prettierrc'), { singleQuote: true, semi: true, trailingComma: 'es5' }, { spaces: 2 });

      // Preset config files
      if (options.preset === 'turborepo') {
        await fs.writeJSON(path.join(projectDir, 'turbo.json'), {
          $schema: 'https://turbo.build/schema.json',
          pipeline: { dev: { cache: false, persistent: true }, build: { dependsOn: ['^build'], outputs: ['dist/**','build/**'] }, lint:{}, format:{ cache:false } }
        }, { spaces: 2 });
      } else if (options.preset === 'nx') {
        await fs.writeJSON(path.join(projectDir, 'nx.json'), {
          $schema: 'https://json.schemastore.org/nx.json',
          npmScope: projectName.replace(/[^a-zA-Z0-9_-]/g,'').toLowerCase(),
          tasksRunnerOptions: { default: { runner: 'nx/tasks-runners/default', options: {} } },
          targetDefaults: { build: { cache: true }, dev: { cache: false } }
        }, { spaces: 2 });
      }

      // Generate Dockerfiles + compose.yaml
      const composeServices = {};
      for (const svcObj of services) {
        const svcDir = path.join(appsDir, svcObj.name);
        const port = svcObj.port || servicePorts[svcObj.type] || 0;
        const dockerfile = path.join(svcDir, 'Dockerfile');
        if (!(await fs.pathExists(dockerfile))) {
          let dockerContent = '';
          if (svcObj.type === 'node' || svcObj.type === 'frontend') {
            dockerContent = `# ${svcObj.name} (${svcObj.type}) service\nFROM node:20-alpine AS deps\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --omit=dev || true\nCOPY . .\nEXPOSE ${port}\nCMD [\"npm\", \"run\", \"dev\"]\n`;
          } else if (svcObj.type === 'python') {
            dockerContent = `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt ./\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE ${port}\nCMD [\"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"${port}\"]\n`;
          } else if (svcObj.type === 'go') {
            dockerContent = `FROM golang:1.22-alpine AS builder\nWORKDIR /src\nCOPY . .\nRUN go build -o app main.go\nFROM alpine:3.20\nWORKDIR /app\nCOPY --from=builder /src/app ./app\nEXPOSE ${port}\nCMD [\"./app\"]\n`;
          } else if (svcObj.type === 'java') {
            dockerContent = `FROM maven:3-eclipse-temurin-21 AS build\nWORKDIR /workspace\nCOPY pom.xml .\nRUN mvn -q -DskipTests dependency:go-offline\nCOPY . .\nRUN mvn -q -DskipTests package\nFROM eclipse-temurin:21-jre\nWORKDIR /app\nCOPY --from=build /workspace/target/*.jar app.jar\nEXPOSE ${port}\nENTRYPOINT [\"java\", \"-jar\", \"/app/app.jar\"]\n`;
          }
          if (dockerContent) await fs.writeFile(dockerfile, dockerContent);
        }
        if (port) {
          composeServices[svcObj.name] = {
            build: { context: `./apps/${svcObj.name}` },
            container_name: `${projectName}-${svcObj.name}`,
            ports: [`${port}:${port}`],
            environment: { PORT: port },
            networks: ['app-net']
          };
        }
      }
      if (Object.keys(composeServices).length) {
        const composePath = path.join(projectDir, 'compose.yaml');
        if (!(await fs.pathExists(composePath))) {
          const yaml = (obj, indent=0) => Object.entries(obj).map(([k,v])=>{ const pad=' '.repeat(indent); if (Array.isArray(v)) return `${pad}${k}:\n${v.map(i=>`${' '.repeat(indent+2)}- ${typeof i==='object'? JSON.stringify(i): i}`).join('\n')}`; if (v && typeof v==='object') return `${pad}${k}:\n${yaml(v, indent+2)}`; return `${pad}${k}: ${v}`; }).join('\n');
          const composeObj = { version: '3.9', services: composeServices, networks: { 'app-net': { driver: 'bridge' } } };
          await fs.writeFile(composePath, `# Generated by create-polyglot\n${yaml(composeObj)}\n`);
        }
      }

      // Git init if requested
      if (options.git) {
        await fs.writeFile(path.join(projectDir, ".gitignore"), `node_modules\n.DS_Store\n.env*\n/dist\n.next\n`);
        try {
          await execa("git", ["init"], { cwd: projectDir });
          await execa("git", ["add", "."], { cwd: projectDir });
          await execa("git", ["commit", "-m", "chore: initial scaffold"], { cwd: projectDir });
          console.log(chalk.green("✅ Initialized git repository"));
        } catch (e) {
          console.log(chalk.yellow("⚠️  Git initialization failed (continuing)."));
        }
      }

      // Install deps unless skipped
  const pm = options.packageManager || "npm";
      if (!options.noInstall) {
        console.log(chalk.cyan(`\n📦 Installing root dependencies using ${pm}...`));
        const installCmd = pm === "yarn" ? ["install"] : pm === "pnpm" ? ["install"] : pm === "bun" ? ["install"] : ["install"];
        try {
          await execa(pm, installCmd, { cwd: projectDir, stdio: "inherit" });
        } catch (e) {
          console.log(chalk.yellow("⚠️  Installing dependencies failed, you can try manually."));
        }
      }

      console.log(chalk.blueBright("\n🎉 Monorepo setup complete!\n"));
      console.log(`👉 Next steps:`);
  console.log(`  cd ${projectName}`);
      if (options.noInstall) console.log(`  ${pm} install`);
      console.log(`  ${pm} run list:services`);
      console.log(`  ${pm} run dev`);
      console.log(`  docker compose up --build`);
      console.log("\nHappy hacking!\n");
    } catch (err) {
      console.error(chalk.red("Failed to scaffold project:"), err);
      process.exit(1);
    }
  });

program.parse();
