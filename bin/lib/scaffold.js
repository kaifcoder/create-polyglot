import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import url from 'url';
import { execa } from 'execa';
import { renderServicesTable, printBoxMessage } from './ui.js';
import { initializeServiceLogs } from './logs.js';
import { initializePlugins, callHook } from './plugin-system.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Extracted core scaffold logic so future subcommands (e.g. add service, plugins) can reuse pieces.
export async function scaffoldMonorepo(projectNameArg, options) {
  try {
    // Call before:init hook
    await callHook('before:init', { 
      projectName: projectNameArg, 
      options: { ...options } 
    });

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

    if (!options.preset) {
      interactiveQuestions.push({
        type: 'select',
        name: 'preset',
        message: 'Preset:',
        choices: [
          { title: 'None (basic)', value: '' },
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
    if (options.withActions === undefined) {
      interactiveQuestions.push({
        type: 'toggle',
        name: 'withActions',
        message: 'Generate GitHub Actions CI workflow?',
        active: 'yes',
        inactive: 'no',
        initial: false
      });
    }

    let answers = {};
    const nonInteractive = !!options.yes || process.env.CI === 'true';
    if (interactiveQuestions.length) {
      if (nonInteractive) {
        // Fill defaults for each missing prompt deterministically.
        for (const q of interactiveQuestions) {
          switch (q.name) {
            case 'projectName':
              answers.projectName = projectNameArg || 'app';
              break;
            case 'preset':
              answers.preset = '';
              break;
            case 'packageManager':
              answers.packageManager = 'npm';
              break;
            case 'git':
              answers.git = false;
              break;
            case 'withActions':
              answers.withActions = false; // default disabled in non-interactive mode
              break;
            default:
              break;
          }
        }
      } else {
        answers = await prompts(interactiveQuestions, {
          onCancel: () => {
            console.log(chalk.red('\n✖ Cancelled.'));
            process.exit(1);
          }
        });
      }
    }

    projectName = projectName || answers.projectName;
    if (!projectName) {
      console.error(chalk.red('Project name is required.'));
      process.exit(1);
    }
    // Note: options.services will be handled in the dynamic flow below if not provided via CLI
    options.preset = options.preset || answers.preset || '';
    options.packageManager = options.packageManager || answers.packageManager || 'npm';
    if (options.git === undefined) options.git = answers.git;
  if (options.withActions === undefined) options.withActions = answers.withActions;
    // Commander defines '--no-install' as option 'install' defaulting to true, false when flag passed.
    if (Object.prototype.hasOwnProperty.call(options, 'install')) {
      // Normalize to legacy noInstall boolean used below.
      options.noInstall = options.install === false;
    }

    console.log(chalk.cyanBright(`\n🚀 Creating ${projectName} monorepo...\n`));

    const allServiceChoices = [
      { title: 'Node.js (Express)', value: 'node' },
      { title: 'Python (FastAPI)', value: 'python' },
      { title: 'Go (Fiber-like)', value: 'go' },
      { title: 'Java (Spring Boot)', value: 'java' },
      { title: 'Frontend (Next.js)', value: 'frontend' },
      { title: 'Remix', value: 'remix' },
      { title: 'Astro', value: 'astro' },
      { title: 'SvelteKit', value: 'sveltekit' }
    ];
    const templateMap = { java: 'spring-boot' };
    let services = [];
    const reservedNames = new Set(['scripts','packages','apps','node_modules','docker','compose','compose.yaml']);
  const defaultPorts = { frontend: 3000, node: 3001, go: 3002, java: 3003, python: 3004, remix: 3005, astro: 3006, sveltekit: 3007 };

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
      // Dynamic interactive flow: ask how many services, then collect each.
      // In non-interactive mode, default to a single node service
      if (nonInteractive) {
        services.push({ type: 'node', name: 'node', port: defaultPorts.node });
      } else {
        const countAns = await prompts({
          type: 'number',
          name: 'svcCount',
          message: 'How many services do you want to create?',
          initial: 1,
          min: 1,
          validate: v => Number.isInteger(v) && v > 0 && v <= 50 ? true : 'Enter a positive integer (max 50)'
        });
        const svcCount = countAns.svcCount || 1;
        for (let i = 0; i < svcCount; i++) {
        const typeAns = await prompts({
          type: 'select',
          name: 'svcType',
          message: `Service #${i+1} type:`,
          choices: allServiceChoices.map(c => ({ title: c.title, value: c.value })),
          initial: 0
        });
        const svcType = typeAns.svcType;
        if (!svcType) {
          console.log(chalk.red('No type selected; aborting.'));
          process.exit(1);
        }
        const nameAns = await prompts({
          type: 'text',
          name: 'svcName',
          message: `Name for ${svcType} service (leave blank for default '${svcType}'):`,
          validate: v => !v || (/^[a-zA-Z0-9._-]+$/.test(v) ? true : 'Use alphanumerics, dash, underscore, dot')
        });
        let svcName = nameAns.svcName && nameAns.svcName.trim() ? nameAns.svcName.trim() : svcType;
        if (reservedNames.has(svcName) || services.find(s => s.name === svcName)) {
          console.log(chalk.red(`Name '${svcName}' is reserved or already used. Using '${svcType}'.`));
          svcName = svcType;
        }
        const portDefault = defaultPorts[svcType];
        const portAns = await prompts({
          type: 'text',
          name: 'svcPort',
          message: `Port for ${svcName} (${svcType}) (default ${portDefault}):`,
          validate: v => !v || (/^\d+$/.test(v) && +v > 0 && +v <= 65535) ? true : 'Enter a valid port 1-65535'
        });
        let svcPort = portDefault;
        if (portAns.svcPort) {
          const parsed = Number(portAns.svcPort);
          if (services.find(s => s.port === parsed)) {
            console.log(chalk.red(`Port ${parsed} already used; keeping ${portDefault}.`));
          } else if (parsed >=1 && parsed <= 65535) {
            svcPort = parsed;
          }
        }
        services.push({ type: svcType, name: svcName, port: svcPort });
        }
      }
    }

    if (services.length === 0) {
      console.log(chalk.yellow('No services selected. Exiting.'));
      process.exit(0);
    }

    const portMap = new Map();
    for (const s of services) {
      if (portMap.has(s.port)) {
        console.error(chalk.red(`Port conflict: ${s.name} and ${portMap.get(s.port)} both use ${s.port}`));
        process.exit(1);
      }
      portMap.set(s.port, s.name);
    }

    printBoxMessage([
      `Project: ${projectName}`,
      `Preset: ${options.preset || 'none'}  |  Package Manager: ${options.packageManager}`,
      'Selected Services:'
    ], { color: chalk.magenta });
    renderServicesTable(services.map(s => ({ ...s, path: `services/${s.name}` })), { title: 'Service Summary' });
    let proceed = true;
    if (!nonInteractive) {
      const answer = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with scaffold?',
        initial: true
      });
      proceed = answer.proceed;
    }
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

    // Initialize plugin system for the new project
    await initializePlugins(projectDir);

    // Call template copy hooks
    await callHook('before:template:copy', {
      projectName,
      projectDir,
      services
    });

    console.log(chalk.yellow('\n📁 Setting up monorepo structure...'));
  // New structure: services/, gateway/, infra/
  const servicesDir = path.join(projectDir, 'services');
  const gatewayDir = path.join(projectDir, 'gateway');
  const infraDir = path.join(projectDir, 'infra');
  fs.mkdirSync(servicesDir, { recursive: true });
  fs.mkdirSync(gatewayDir, { recursive: true });
  fs.mkdirSync(infraDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'packages'), { recursive: true });

    for (const svcObj of services) {
      const { type: svcType, name: svcName, port: svcPort } = svcObj;
      const templateFolder = templateMap[svcType] || svcType;
  const src = path.join(__dirname, `../../templates/${templateFolder}`);
  const dest = path.join(servicesDir, svcName);
      fs.mkdirSync(dest, { recursive: true });
      let usedGenerator = false;
      if (svcType === 'frontend' && options.frontendGenerator) {
        try {
          console.log(chalk.cyan('⚙️  Running create-next-app for frontend...'));
          const existing = await fs.readdir(dest);
          for (const f of existing) await fs.remove(path.join(dest, f));
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
          console.log(chalk.yellow(`⚠️  create-next-app failed: ${e.message}. Using template.`));
        }
      }
      // Strict external generators for new frameworks: abort on failure (no internal fallback yet)
      if (svcType === 'remix') {
        try {
          console.log(chalk.cyan('⚙️  Running Remix generator (create-react-router with basic template)...'));
          await execa('npx', ['--yes', 'create-react-router@latest', '.', '--template', 'remix-run/react-router/examples/basic', '--no-git-init', '--no-install'], { cwd: dest, stdio: 'inherit' });
          usedGenerator = true;
        } catch (e) {
          console.error(chalk.red(`❌ create-react-router failed: ${e.message}. Aborting scaffold for this service.`));
          continue; // skip creating this service
        }
      } else if (svcType === 'astro') {
        try {
          console.log(chalk.cyan('⚙️  Running Astro generator (create-astro)...'));
          await execa('npx', ['--yes', 'create-astro@latest', '.', '--template', 'minimal', '--no-install', '--no-git'], { cwd: dest, stdio: 'inherit' });
          usedGenerator = true;
        } catch (e) {
          console.error(chalk.red(`❌ create-astro failed: ${e.message}. Aborting scaffold for this service.`));
          continue;
        }
      } else if (svcType === 'sveltekit') {
        try {
          console.log(chalk.cyan('⚙️  Running SvelteKit generator (sv create)...'));
          await execa('npx', ['sv', 'create', '.', '--template', 'minimal', '--types', 'ts', '--no-install', '--no-add-ons'], { cwd: dest, stdio: 'inherit' });
          usedGenerator = true;
        } catch (e) {
          console.error(chalk.red(`❌ sv create failed: ${e.message}. Aborting scaffold for this service.`));
          continue;
        }
      }
      if (!usedGenerator) {
        // Non-framework services use internal templates
        if (svcType !== 'remix' && svcType !== 'astro' && svcType !== 'sveltekit') {
          if (await fs.pathExists(src) && (await fs.readdir(src)).length > 0) {
            await fs.copy(src, dest, { overwrite: true });
            if (svcType === 'node') {
              const packageJsonPath = path.join(dest, 'package.json');
              if (await fs.pathExists(packageJsonPath)) {
                const packageJson = await fs.readJSON(packageJsonPath);
                packageJson.name = `@${projectNameArg || 'polyglot'}/${svcName}`;
                await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
              }
            }
            if (templateFolder === 'spring-boot') {
              const propTxt = path.join(dest, 'src/main/resources/application.properties.txt');
              const prop = path.join(dest, 'src/main/resources/application.properties');
              if (await fs.pathExists(propTxt) && !(await fs.pathExists(prop))) {
                await fs.move(propTxt, prop);
              }
            }
          } else {
            await fs.writeFile(path.join(dest, 'README.md'), `# ${svcName} service\n\nScaffolded by create-polyglot.`);
          }
        }
      }

      // Initialize logging for the service
      initializeServiceLogs(dest);

      console.log(chalk.green(`✅ Created ${svcName} (${svcType}) service on port ${svcPort}`));
    }

    // Call template copy complete hook
    await callHook('after:template:copy', {
      projectName,
      projectDir,
      services,
      generatedServices: services.map(s => ({ ...s, path: path.join(servicesDir, s.name) }))
    });

    const rootPkgPath = path.join(projectDir, 'package.json');
    const rootPkg = {
      name: projectName,
      private: true,
      version: '0.1.0',
      workspaces: ['services/*', 'packages/*'],
      scripts: {
        dev: 'npx create-polyglot dev',
        'list:services': 'node scripts/list-services.mjs',
        format: 'prettier --write .',
        lint: 'eslint "services/**/*.{js,jsx,ts,tsx}" --max-warnings 0 || true'
      },
      devDependencies: {
        prettier: '^3.3.3',
        eslint: '^9.11.1',
        'eslint-config-prettier': '^9.1.0',
        'eslint-plugin-import': '^2.29.1',
        chalk: '^5.6.2'
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

    // Always ensure scripts dir exists (needed for list-services script)
    const scriptsDir = path.join(projectDir, 'scripts');
    await fs.mkdirp(scriptsDir);
    // Create list-services script with runtime status detection
    const listScriptPath = path.join(scriptsDir, 'list-services.mjs');
    await fs.writeFile(listScriptPath, `#!/usr/bin/env node\nimport fs from 'fs';\nimport path from 'path';\nimport net from 'net';\nimport chalk from 'chalk';\nconst cwd = process.cwd();\nconst cfgPath = path.join(cwd, 'polyglot.json');\nif(!fs.existsSync(cfgPath)){ console.error(chalk.red('polyglot.json not found.')); process.exit(1);}\nconst cfg = JSON.parse(fs.readFileSync(cfgPath,'utf-8'));\n\nfunction strip(str){return str.replace(/\\x1B\\[[0-9;]*m/g,'');}\nfunction pad(str,w){const raw=strip(str);return str+' '.repeat(Math.max(0,w-raw.length));}\nfunction table(items){ if(!items.length){console.log(chalk.yellow('No services.'));return;} const cols=[{k:'name',h:'Name'},{k:'type',h:'Type'},{k:'port',h:'Port'},{k:'status',h:'Status'},{k:'path',h:'Path'}]; const widths=cols.map(c=>Math.max(c.h.length,...items.map(i=>strip(i[c.k]).length))+2); const top='┌'+widths.map(w=>'─'.repeat(w)).join('┬')+'┐'; const sep='├'+widths.map(w=>'─'.repeat(w)).join('┼')+'┤'; const bot='└'+widths.map(w=>'─'.repeat(w)).join('┴')+'┘'; console.log(top); console.log('│'+cols.map((c,i)=>pad(chalk.bold.white(c.h),widths[i])).join('│')+'│'); console.log(sep); for(const it of items){ console.log('│'+cols.map((c,i)=>pad(it[c.k],widths[i])).join('│')+'│'); } console.log(bot); console.log(chalk.gray('Total: '+items.length)); }\n\nasync function check(port){ return new Promise(res=>{ const sock=net.createConnection({port,host:'127.0.0.1'},()=>{sock.destroy();res(true);}); sock.setTimeout(350,()=>{sock.destroy();res(false);}); sock.on('error',()=>{res(false);});}); }\nconst promises = cfg.services.map(async s=>{ const up = await check(s.port); return { ...s, _up: up }; });\nconst results = await Promise.all(promises);\nconst rows = results.map(s=>({ name: chalk.cyan(s.name), type: colorType(s.type)(s.type), port: chalk.green(String(s.port)), status: s._up ? chalk.bgGreen.black(' UP ') : chalk.bgRed.white(' DOWN '), path: chalk.dim(s.path) }));\nfunction colorType(t){ switch(t){case 'node': return chalk.green; case 'python': return chalk.yellow; case 'go': return chalk.cyan; case 'java': return chalk.red; case 'frontend': return chalk.blue; default: return chalk.white;} }\nif(process.argv.includes('--json')) { console.log(JSON.stringify(results.map(r=>({name:r.name,type:r.type,port:r.port,up:r._up,path:r.path})),null,2)); } else { console.log(chalk.magentaBright('\nWorkspace Services (runtime status)')); table(rows); }\n`);

    const readmePath = path.join(projectDir, 'README.md');
  const svcList = services.map(s => `- ${s.name} (${s.type}) port:${s.port}`).join('\n');
    await fs.writeFile(readmePath, `# ${projectName}\n\nGenerated with create-polyglot.\n\n## Services\n${svcList}\n\n## Preset\n${options.preset || 'none'}\n\n## Commands\n- list services: \`npm run list:services\`\n- dev: \`npm run dev\`\n- lint: \`npm run lint\`\n- format: \`npm run format\`\n\n## Docker Compose\nSee compose.yaml (generated).\n`);

    const sharedDir = path.join(projectDir, 'packages/shared');
    if (!(await fs.pathExists(sharedDir))) {
      await fs.mkdirp(path.join(sharedDir, 'src'));
      await fs.writeJSON(path.join(sharedDir, 'package.json'), {
        name: '@shared/utils', version: '0.0.1', type: 'module', main: 'src/index.js'
      }, { spaces: 2 });
      await fs.writeFile(path.join(sharedDir, 'src/index.js'), 'export function greet(name){return `Hello, ${name}`;}');
    }

    // Create shared libraries directory
    const libsDir = path.join(projectDir, 'packages/libs');
    await fs.mkdirp(libsDir);
    await fs.writeFile(path.join(libsDir, '.gitkeep'), '# Shared libraries directory\n# This directory contains language-specific shared libraries\n# Generated by create-polyglot\n');

    await fs.writeFile(path.join(projectDir, '.eslintrc.cjs'), 'module.exports={root:true,env:{node:true,es2022:true},extends:[\'eslint:recommended\',\'plugin:import/recommended\',\'prettier\'],parserOptions:{ecmaVersion:\'latest\',sourceType:\'module\'},rules:{}};\n');
    await fs.writeJSON(path.join(projectDir, '.prettierrc'), { singleQuote: true, semi: true, trailingComma: 'es5' }, { spaces: 2 });

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

    // Docker / compose generation
    const composeServices = {};
    for (const svcObj of services) {
      const svcDir = path.join(servicesDir, svcObj.name);
      const port = svcObj.port || 0;
      const dockerfile = path.join(svcDir, 'Dockerfile');
      if (!(await fs.pathExists(dockerfile))) {
        let dockerContent = '';
  if (svcObj.type === 'node' || svcObj.type === 'frontend' || ['remix','astro','sveltekit'].includes(svcObj.type)) {
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
          build: { context: `./services/${svcObj.name}` },
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

    if (options.git) {
      await fs.writeFile(path.join(projectDir, '.gitignore'), 'node_modules\n.DS_Store\n.env*\n/dist\n.next\n');
      try {
        await execa('git', ['init'], { cwd: projectDir });
        await execa('git', ['add', '.'], { cwd: projectDir });
        await execa('git', ['commit', '-m', 'chore: initial scaffold'], { cwd: projectDir });
        console.log(chalk.green('✅ Initialized git repository'));
      } catch (e) {
        console.log(chalk.yellow('⚠️  Failed to initialize git repository:', e.message));
      }
    }

    const pm = options.packageManager || 'npm';
    // Commander maps --no-install to options.install = false
    if (options.install !== false) {
      await callHook('before:dependencies:install', {
        projectName,
        projectDir,
        packageManager: pm,
        services
      });

      console.log(chalk.cyan(`\n📦 Installing root dependencies using ${pm}...`));
      const installCmd = pm === 'yarn' ? ['install'] : pm === 'pnpm' ? ['install'] : pm === 'bun' ? ['install'] : ['install'];
      try {
        await execa(pm, installCmd, { cwd: projectDir, stdio: 'inherit' });
        
        await callHook('after:dependencies:install', {
          projectName,
          projectDir,
          packageManager: pm,
          success: true,
          services
        });
      } catch (e) {
        console.log(chalk.yellow('⚠️  Failed to install dependencies:', e.message));
        
        await callHook('after:dependencies:install', {
          projectName,
          projectDir,
          packageManager: pm,
          success: false,
          error: e.message,
          services
        });
      }
    }

    // Optionally generate GitHub Actions workflow
    if (options.withActions) {
      try {
        const wfDir = path.join(projectDir, '.github', 'workflows');
        await fs.mkdirp(wfDir);
        const wfPath = path.join(wfDir, 'ci.yml');
        if (!(await fs.pathExists(wfPath))) {
          const nodeVersion = '20.x';
          const installStep = pm === 'yarn' ? 'yarn install --frozen-lockfile || yarn install' : pm === 'pnpm' ? 'pnpm install' : pm === 'bun' ? 'bun install' : 'npm ci || npm install';
          const testCmd = pm === 'yarn' ? 'yarn test' : pm === 'pnpm' ? 'pnpm test' : pm === 'bun' ? 'bun test' : 'npm test';
          const wf = `# Generated by create-polyglot CI scaffold\nname: CI\n\non:\n  push:\n    branches: [ main, master ]\n  pull_request:\n    branches: [ main, master ]\n\njobs:\n  build-test:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n      - name: Setup Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: ${nodeVersion}\n          cache: '${pm === 'npm' ? 'npm' : pm}'\n      - name: Install dependencies\n        run: ${installStep}\n      - name: Run tests\n        run: ${testCmd}\n`;
          await fs.writeFile(wfPath, wf);
          console.log(chalk.green('✅ Added GitHub Actions workflow (.github/workflows/ci.yml)'));
        }
      } catch (e) {
        console.log(chalk.yellow('⚠️  Failed to create GitHub Actions workflow:', e.message));
      }
    }

    // Write polyglot config
    const polyglotConfig = {
      name: projectName,
      preset: options.preset || 'none',
      packageManager: options.packageManager,
      services: services.map(s => ({ name: s.name, type: s.type, port: s.port, path: `services/${s.name}` })),
      sharedLibs: [],
      plugins: {}
    };
    await fs.writeJSON(path.join(projectDir, 'polyglot.json'), polyglotConfig, { spaces: 2 });

    // Call after:init hook
    await callHook('after:init', {
      projectName,
      projectDir,
      services,
      config: polyglotConfig,
      options
    });

    printBoxMessage([
      '🎉 Monorepo setup complete!',
      `cd ${projectName}`,
      options.install === false ? `${pm} install` : '',
      `${pm} run list:services   # quick list (fancy table)`,
      `${pm} run dev             # run local node/frontend services`,
      'docker compose up --build# run all via docker',
      options.withActions ? 'GitHub Actions CI ready (see .github/workflows/ci.yml)' : '',
      '',
      'Happy hacking!'
    ].filter(Boolean));
  } catch (err) {
    console.error(chalk.red('Failed to scaffold project:'), err);
    process.exit(1);
  }
}

// Utility to add a service post-initialization
export async function addService(projectDir, { type, name, port }, options = {}) {
  const configPath = path.join(projectDir, 'polyglot.json');
  if (!(await fs.pathExists(configPath))) {
    throw new Error('polyglot.json not found. Are you in a create-polyglot project?');
  }

  // Initialize plugins for this project if not already done
  await initializePlugins(projectDir);

  // Call before:service:add hook
  await callHook('before:service:add', {
    projectDir,
    service: { type, name, port },
    options
  });

  const cfg = await fs.readJSON(configPath);
  if (cfg.services.find(s => s.name === name)) {
    throw new Error(`Service '${name}' already exists.`);
  }
  if (cfg.services.find(s => s.port === port)) {
    throw new Error(`Port ${port} already in use by another service.`);
  }
  const templateMap = { java: 'spring-boot' };
  const templateFolder = templateMap[type] || type;
  const servicesDir = path.join(projectDir, 'services');
  const dest = path.join(servicesDir, name);
  await fs.mkdirp(dest);
  const src = path.join(__dirname, `../../templates/${templateFolder}`);
  if (await fs.pathExists(src)) {
    await fs.copy(src, dest, { overwrite: true });
    
    // Dynamically update the name field in package.json for Node.js services
    if (type === 'node') {
      const packageJsonPath = path.join(dest, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJSON(packageJsonPath);
        packageJson.name = `@${cfg.name || 'polyglot'}/${name}`; // Ensure unique name
        await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
      }
    }
    
    if (templateFolder === 'spring-boot') {
      const propTxt = path.join(dest, 'src/main/resources/application.properties.txt');
      const prop = path.join(dest, 'src/main/resources/application.properties');
      if (await fs.pathExists(propTxt) && !(await fs.pathExists(prop))) await fs.move(propTxt, prop);
    }
  } else {
    await fs.writeFile(path.join(dest, 'README.md'), `# ${name} (${type}) service\n`);
  }

  // Initialize logging for the service
  initializeServiceLogs(dest);

  cfg.services.push({ name, type, port, path: `services/${name}` });
  await fs.writeJSON(configPath, cfg, { spaces: 2 });

  // Call after:service:add hook
  await callHook('after:service:add', {
    projectDir,
    service: { type, name, port, path: `services/${name}` },
    config: cfg,
    options
  });

  console.log(chalk.green(`✅ Added service '${name}' (${type}) on port ${port}`));

  // Update compose.yaml (append or create)
  const composePath = path.join(projectDir, 'compose.yaml');
  let composeObj;
  if (await fs.pathExists(composePath)) {
    const raw = await fs.readFile(composePath, 'utf-8');
    // naive parse: look for services: if cannot parse, regenerate
    try {
      // Not using YAML parser to avoid new dependency; simple regex fallback
      // If complexity grows, integrate js-yaml later.
      composeObj = { version: '3.9', services: {}, networks: { 'app-net': { driver: 'bridge' } } };
      // regenerate fully from cfg
    } catch {
      composeObj = null;
    }
  }
  if (!composeObj) composeObj = { version: '3.9', services: {}, networks: { 'app-net': { driver: 'bridge' } } };
  for (const s of cfg.services) {
    composeObj.services[s.name] = {
      build: { context: `./${s.path}` },
      container_name: `${cfg.name}-${s.name}`,
      ports: [`${s.port}:${s.port}`],
      environment: { PORT: s.port },
      networks: ['app-net']
    };
  }
  const yaml = (obj, indent = 0) => Object.entries(obj).map(([k, v]) => {
    const pad = ' '.repeat(indent);
    if (Array.isArray(v)) return `${pad}${k}:\n${v.map(i => `${' '.repeat(indent + 2)}- ${typeof i === 'object' ? JSON.stringify(i) : i}`).join('\n')}`;
    if (v && typeof v === 'object') return `${pad}${k}:\n${yaml(v, indent + 2)}`;
    return `${pad}${k}: ${v}`;
  }).join('\n');
  await fs.writeFile(composePath, `# Generated by create-polyglot\n${yaml(composeObj)}\n`);
}

export async function scaffoldPlugin(projectDir, pluginName) {
  const pluginsDir = path.join(projectDir, 'plugins');
  await fs.mkdirp(pluginsDir);
  const pluginDir = path.join(pluginsDir, pluginName);
  if (await fs.pathExists(pluginDir)) throw new Error(`Plugin '${pluginName}' already exists.`);
  await fs.mkdirp(pluginDir);
  
  const pluginCode = `// Example plugin '${pluginName}'
// This plugin demonstrates the available hooks and how to use them
export default {
  name: '${pluginName}',
  version: '1.0.0',
  description: 'Generated plugin for ${pluginName}',
  
  // Plugin initialization (optional)
  // Called when the plugin is loaded
  init(context) {
    this.context = context;
    console.log(\`[plugin:\${this.name}] Loaded successfully\`);
  },

  // Plugin configuration (optional)
  config: {
    // Plugin-specific configuration options
    enabled: true,
    logLevel: 'info'
  },

  // Hook handlers
  hooks: {
    // Project initialization hooks
    'before:init': function(ctx) {
      console.log(\`[plugin:\${this.name}] Project initialization starting for: \${ctx.projectName}\`);
      // You can modify the context or perform pre-initialization tasks
    },

    'after:init': function(ctx) {
      console.log(\`[plugin:\${this.name}] Project '\${ctx.projectName}' initialized successfully\`);
      console.log(\`[plugin:\${this.name}] Services created: \${ctx.services.map(s => s.name).join(', ')}\`);
      
      // Example: Create custom files or modify the project structure
      // await this.createCustomFiles(ctx.projectDir);
    },

    // Template handling hooks
    'before:template:copy': function(ctx) {
      console.log(\`[plugin:\${this.name}] Copying templates for \${ctx.services.length} services\`);
      // You can modify templates before they are copied
    },

    'after:template:copy': function(ctx) {
      console.log(\`[plugin:\${this.name}] Templates copied successfully\`);
      // You can post-process generated files
    },

    // Service management hooks
    'before:service:add': function(ctx) {
      console.log(\`[plugin:\${this.name}] Adding service: \${ctx.service.name} (\${ctx.service.type})\`);
      // Validate service configuration or modify it
      if (ctx.service.type === 'node' && !ctx.service.port) {
        console.log(\`[plugin:\${this.name}] Setting default port for Node service\`);
        ctx.service.port = 3001;
      }
    },

    'after:service:add': function(ctx) {
      console.log(\`[plugin:\${this.name}] Service '\${ctx.service.name}' added successfully\`);
      // Post-process the new service
    },

    // Development workflow hooks
    'before:dev:start': function(ctx) {
      console.log(\`[plugin:\${this.name}] Starting development mode (docker: \${ctx.docker})\`);
      // Pre-development setup
    },

    'after:dev:start': function(ctx) {
      console.log(\`[plugin:\${this.name}] Development mode started with \${ctx.processes} processes\`);
      // Post-development setup, monitoring, etc.
    },

    'before:dev:stop': function(ctx) {
      console.log(\`[plugin:\${this.name}] Stopping development mode\`);
      // Cleanup before stopping
    },

    'after:dev:stop': function(ctx) {
      console.log(\`[plugin:\${this.name}] Development mode stopped\`);
      // Final cleanup
    },

    // Admin dashboard hooks
    'before:admin:start': function(ctx) {
      console.log(\`[plugin:\${this.name}] Starting admin dashboard\`);
      // Pre-admin setup
    },

    'after:admin:start': function(ctx) {
      console.log(\`[plugin:\${this.name}] Admin dashboard started at \${ctx.dashboardUrl}\`);
      // Post-admin setup, register custom endpoints, etc.
    },

    // Dependency installation hooks
    'before:dependencies:install': function(ctx) {
      console.log(\`[plugin:\${this.name}] Installing dependencies with \${ctx.packageManager}\`);
      // Modify package.json or add custom dependencies
    },

    'after:dependencies:install': function(ctx) {
      if (ctx.success) {
        console.log(\`[plugin:\${this.name}] Dependencies installed successfully\`);
      } else {
        console.log(\`[plugin:\${this.name}] Dependencies installation failed: \${ctx.error}\`);
      }
      // Post-installation tasks
    }
  },

  // Plugin methods (optional)
  // These can be called by other plugins or the system
  methods: {
    createCustomFiles: async function(projectDir) {
      const fs = await import('fs-extra');
      const path = await import('path');
      
      // Example: Create a custom configuration file
      const configPath = path.join(projectDir, \`.config/\${this.name}.json\`);
      await fs.mkdirp(path.dirname(configPath));
      await fs.writeJSON(configPath, {
        plugin: this.name,
        version: this.version,
        createdAt: new Date().toISOString(),
        settings: this.config
      }, { spaces: 2 });
      
      console.log(\`[plugin:\${this.name}] Created custom config at \${configPath}\`);
    },

    validateProject: function(projectDir) {
      // Example validation logic
      console.log(\`[plugin:\${this.name}] Validating project at \${projectDir}\`);
      return true;
    },

    getPluginInfo: function() {
      return {
        name: this.name,
        version: this.version,
        description: this.description,
        hooks: Object.keys(this.hooks),
        methods: Object.keys(this.methods)
      };
    }
  },

  // Plugin lifecycle (optional)
  onLoad: function() {
    console.log(\`[plugin:\${this.name}] Plugin loaded\`);
  },

  onUnload: function() {
    console.log(\`[plugin:\${this.name}] Plugin unloaded\`);
  }
};
`;

  await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);
  
  const readmeContent = `# Plugin ${pluginName}

Generated plugin for create-polyglot projects.

## Features

This plugin provides hooks for various lifecycle events in the create-polyglot workflow:

### Available Hooks

- **Project Initialization**
  - \`before:init\` - Called before project scaffolding begins
  - \`after:init\` - Called after project scaffolding completes

- **Template Management**
  - \`before:template:copy\` - Called before copying service templates
  - \`after:template:copy\` - Called after copying service templates

- **Service Management**
  - \`before:service:add\` - Called before adding a new service
  - \`after:service:add\` - Called after adding a new service

- **Development Workflow**
  - \`before:dev:start\` - Called before starting dev server(s)
  - \`after:dev:start\` - Called after dev server(s) have started
  - \`before:dev:stop\` - Called before stopping dev server(s)
  - \`after:dev:stop\` - Called after dev server(s) have stopped

- **Admin Dashboard**
  - \`before:admin:start\` - Called before starting admin dashboard
  - \`after:admin:start\` - Called after admin dashboard is running

- **Dependencies**
  - \`before:dependencies:install\` - Called before installing dependencies
  - \`after:dependencies:install\` - Called after installing dependencies

## Configuration

Plugin configuration is stored in \`polyglot.json\`:

\`\`\`json
{
  "plugins": {
    "${pluginName}": {
      "enabled": true,
      "priority": 0,
      "config": {
        "logLevel": "info"
      }
    }
  }
}
\`\`\`

## Usage

### Enable/Disable Plugin

\`\`\`bash
# Enable plugin
create-polyglot plugin enable ${pluginName}

# Disable plugin
create-polyglot plugin disable ${pluginName}
\`\`\`

### Plugin Configuration

\`\`\`bash
# Configure plugin
create-polyglot plugin configure ${pluginName} --config '{"logLevel": "debug"}'
\`\`\`

## Development

1. Edit \`index.js\` to implement your hook handlers
2. Add any additional methods to the \`methods\` object
3. Update configuration options in the \`config\` object
4. Test your plugin by running create-polyglot commands

## Hook Context

Each hook receives a context object with relevant information:

\`\`\`javascript
{
  projectName,    // Name of the project
  projectDir,     // Absolute path to project directory
  services,       // Array of service configurations
  config,         // Project configuration from polyglot.json
  timestamp,      // Hook execution timestamp
  hookName,       // Name of the current hook
  // ... additional context depending on the hook
}
\`\`\`

## Best Practices

1. **Error Handling**: Always wrap async operations in try-catch blocks
2. **Logging**: Use consistent logging with the plugin name prefix
3. **Configuration**: Make your plugin configurable through the config object
4. **Documentation**: Document any new hooks or methods you add
5. **Testing**: Test your plugin with different project configurations

## Examples

### Custom File Generation

\`\`\`javascript
'after:init': async function(ctx) {
  const fs = await import('fs-extra');
  const path = await import('path');
  
  // Create a custom README section
  const readmePath = path.join(ctx.projectDir, 'README.md');
  const customSection = \`\\n## Custom Plugin Features\\n\\nAdded by \${this.name} plugin.\\n\`;
  
  if (await fs.pathExists(readmePath)) {
    const content = await fs.readFile(readmePath, 'utf-8');
    await fs.writeFile(readmePath, content + customSection);
  }
}
\`\`\`

### Service Validation

\`\`\`javascript
'before:service:add': function(ctx) {
  if (ctx.service.type === 'custom') {
    // Validate custom service configuration
    if (!ctx.service.customConfig) {
      throw new Error('Custom service requires customConfig');
    }
  }
}
\`\`\`

### Development Environment Setup

\`\`\`javascript
'before:dev:start': async function(ctx) {
  // Set up environment variables
  process.env.PLUGIN_MODE = 'development';
  process.env.PLUGIN_DEBUG = this.config.logLevel === 'debug';
}
\`\`\`
`;

  await fs.writeFile(path.join(pluginDir, 'README.md'), readmeContent);
  
  // Create a package.json for the plugin
  const packageJson = {
    name: `create-polyglot-plugin-${pluginName}`,
    version: "1.0.0",
    description: `Generated plugin ${pluginName} for create-polyglot`,
    main: "index.js",
    type: "module",
    keywords: ["create-polyglot", "plugin", pluginName],
    author: "",
    license: "MIT"
  };
  
  await fs.writeJSON(path.join(pluginDir, 'package.json'), packageJson, { spaces: 2 });
  
  console.log(chalk.green(`✅ Created plugin scaffold '${pluginName}' with comprehensive examples`));
}

// Service removal logic
export async function removeService(projectDir, serviceName, options = {}) {
  const configPath = path.join(projectDir, 'polyglot.json');
  if (!(await fs.pathExists(configPath))) {
    throw new Error('polyglot.json not found. Are you in a create-polyglot project?');
  }

  // Initialize plugins for this project if not already done
  await initializePlugins(projectDir);

  // Load current configuration
  const cfg = await fs.readJSON(configPath);
  const service = cfg.services.find(s => s.name === serviceName);
  
  if (!service) {
    throw new Error(`Service '${serviceName}' not found.`);
  }

  // Call before:service:remove hook
  await callHook('before:service:remove', {
    projectDir,
    service,
    options
  });

  // Confirmation prompt unless --yes is used
  if (!options.yes) {
    const prompts = (await import('prompts')).default;
    const confirmRemoval = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to remove service '${serviceName}' (${service.type})?`,
      initial: false
    });

    if (!confirmRemoval.confirmed) {
      console.log(chalk.yellow('Service removal cancelled.'));
      return;
    }
  }

  // Remove service from configuration
  cfg.services = cfg.services.filter(s => s.name !== serviceName);
  await fs.writeJSON(configPath, cfg, { spaces: 2 });

  // Remove service files unless --keep-files is used
  if (!options.keepFiles) {
    const servicePath = path.join(projectDir, 'services', serviceName);
    if (await fs.pathExists(servicePath)) {
      await fs.remove(servicePath);
      console.log(chalk.blue(`🗑️  Removed service files from services/${serviceName}`));
    }

    // Also check legacy apps/ directory
    const legacyServicePath = path.join(projectDir, 'apps', serviceName);
    if (await fs.pathExists(legacyServicePath)) {
      await fs.remove(legacyServicePath);
      console.log(chalk.blue(`🗑️  Removed service files from apps/${serviceName}`));
    }

    // Clean up logs
    const logsPath = path.join(projectDir, '.logs');
    if (await fs.pathExists(logsPath)) {
      const serviceLogFiles = await fs.readdir(logsPath);
      for (const logFile of serviceLogFiles) {
        if (logFile.includes(serviceName)) {
          await fs.remove(path.join(logsPath, logFile));
        }
      }
    }
  } else {
    console.log(chalk.yellow(`📁 Service files kept (--keep-files option)`));
  }

  // Update compose.yaml if it exists
  const composePath = path.join(projectDir, 'compose.yaml');
  if (await fs.pathExists(composePath)) {
    try {
      let composeContent = await fs.readFile(composePath, 'utf-8');
      
      // Remove service section from compose.yaml - more precise regex
      const lines = composeContent.split('\n');
      const result = [];
      let inTargetService = false;
      let serviceIndentLevel = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Check if this line starts our target service
        if (trimmed === `${serviceName}:`) {
          inTargetService = true;
          serviceIndentLevel = line.length - line.trimStart().length;
          continue; // Skip the service name line
        }
        
        // If we're in the target service, check if we've reached the end
        if (inTargetService) {
          const currentIndentLevel = line.length - line.trimStart().length;
          
          // If we hit another service at the same level or a section, we're done
          if (trimmed && (currentIndentLevel <= serviceIndentLevel || 
                         (currentIndentLevel === 0 && trimmed.endsWith(':')))) {
            inTargetService = false;
            serviceIndentLevel = -1;
            result.push(line); // Include this line as it's not part of our service
          }
          // Otherwise skip lines that are part of our target service
        } else {
          result.push(line);
        }
      }
      
      await fs.writeFile(composePath, result.join('\n'));
      console.log(chalk.blue(`🐳 Updated compose.yaml`));
    } catch (e) {
      console.warn(chalk.yellow(`⚠️  Could not update compose.yaml: ${e.message}`));
    }
  }

  // Update root package.json scripts if needed
  const rootPackageJsonPath = path.join(projectDir, 'package.json');
  if (await fs.pathExists(rootPackageJsonPath)) {
    try {
      const rootPackageJson = await fs.readJSON(rootPackageJsonPath);
      if (rootPackageJson.scripts) {
        // Remove service-specific scripts
        Object.keys(rootPackageJson.scripts).forEach(scriptName => {
          if (scriptName.includes(serviceName)) {
            delete rootPackageJson.scripts[scriptName];
          }
        });
        
        await fs.writeJSON(rootPackageJsonPath, rootPackageJson, { spaces: 2 });
        console.log(chalk.blue(`📦 Updated root package.json scripts`));
      }
    } catch (e) {
      console.warn(chalk.yellow(`⚠️  Could not update package.json: ${e.message}`));
    }
  }

  // Call after:service:remove hook
  await callHook('after:service:remove', {
    projectDir,
    service,
    config: cfg,
    options
  });

  console.log(chalk.green(`✅ Service '${serviceName}' removed successfully`));

  // Show updated services table
  if (cfg.services.length > 0) {
    console.log(chalk.blue('\n📊 Remaining services:'));
    renderServicesTable(cfg.services);
  } else {
    console.log(chalk.yellow('\n📭 No services remaining in the workspace'));
  }
}

// Plugin removal logic
export async function removePlugin(projectDir, pluginName, options = {}) {
  const configPath = path.join(projectDir, 'polyglot.json');
  if (!(await fs.pathExists(configPath))) {
    throw new Error('polyglot.json not found. Are you in a create-polyglot project?');
  }

  // Initialize plugins for this project if not already done
  await initializePlugins(projectDir);

  // Check if plugin exists
  const { pluginSystem } = await import('./plugin-system.js');
  await pluginSystem.initialize(projectDir);
  const plugin = pluginSystem.getPlugin(pluginName);
  
  if (!plugin) {
    throw new Error(`Plugin '${pluginName}' not found.`);
  }

  // Call before:plugin:unload hook
  await callHook('before:plugin:unload', {
    projectDir,
    pluginName,
    plugin,
    options
  });

  // Confirmation prompt unless --yes is used
  if (!options.yes) {
    const prompts = (await import('prompts')).default;
    const confirmRemoval = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to remove plugin '${pluginName}'?`,
      initial: false
    });

    if (!confirmRemoval.confirmed) {
      console.log(chalk.yellow('Plugin removal cancelled.'));
      return;
    }
  }

  // Remove plugin from configuration
  const cfg = await fs.readJSON(configPath);
  if (cfg.plugins && cfg.plugins[pluginName]) {
    delete cfg.plugins[pluginName];
    await fs.writeJSON(configPath, cfg, { spaces: 2 });
    console.log(chalk.blue(`🔧 Removed plugin configuration`));
  }

  // Remove plugin files unless --keep-files is used
  if (!options.keepFiles && plugin.type === 'local') {
    const pluginPath = path.join(projectDir, 'plugins', pluginName);
    if (await fs.pathExists(pluginPath)) {
      await fs.remove(pluginPath);
      console.log(chalk.blue(`🗑️  Removed plugin files from plugins/${pluginName}`));
    }
  } else if (options.keepFiles) {
    console.log(chalk.yellow(`📁 Plugin files kept (--keep-files option)`));
  } else if (plugin.type === 'external') {
    console.log(chalk.blue(`🔗 External plugin reference removed from configuration`));
  }

  // Unload plugin from system
  try {
    // Remove from loaded plugins without saving to config (we already deleted it)
    if (pluginSystem.plugins.has(pluginName)) {
      await callHook('before:plugin:unload', { plugin: pluginSystem.plugins.get(pluginName) });
      pluginSystem.plugins.delete(pluginName);
      await callHook('after:plugin:unload', { pluginName });
    }
    console.log(chalk.blue(`🔌 Plugin unloaded from system`));
  } catch (e) {
    console.warn(chalk.yellow(`⚠️  Could not unload plugin: ${e.message}`));
  }

  // Call after:plugin:unload hook
  await callHook('after:plugin:unload', {
    projectDir,
    pluginName,
    plugin,
    options
  });

  console.log(chalk.green(`✅ Plugin '${pluginName}' removed successfully`));

  // Show remaining plugins
  const remainingPlugins = pluginSystem.getAllPlugins().filter(p => p.name !== pluginName);
  if (remainingPlugins.length > 0) {
    console.log(chalk.blue('\n🔌 Remaining plugins:'));
    for (const plugin of remainingPlugins) {
      const status = plugin.enabled ? chalk.green('enabled') : chalk.red('disabled');
      const type = plugin.type === 'local' ? chalk.cyan('local') : chalk.magenta('external');
      console.log(`  ${chalk.bold(plugin.name)} [${status}] (${type})`);
    }
  } else {
    console.log(chalk.yellow('\n📭 No plugins remaining in the workspace'));
  }
}

// Shared Library Management Functions

export async function scaffoldSharedLibrary(projectDir, { type, name }, options = {}) {
  const configPath = path.join(projectDir, 'polyglot.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polyglot.json not found. Are you in a create-polyglot project?');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // Validate library name
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error('Library name must contain only alphanumerics, dash, underscore, or dot');
  }

  // Check for existing library with same name
  const existingLibs = config.sharedLibs || [];
  if (existingLibs.find(lib => lib.name === name)) {
    throw new Error(`Shared library '${name}' already exists`);
  }

  const validTypes = ['python', 'go'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid library type '${type}'. Must be one of: ${validTypes.join(', ')}`);
  }

  console.log(chalk.cyanBright(`\n📦 Creating ${type} shared library '${name}'...\n`));

  // Call before:lib:create hook
  await callHook('before:lib:create', { 
    name, 
    type, 
    projectDir, 
    config,
    options 
  });

  const libDir = path.join(projectDir, 'packages', 'libs', name);
  await fs.mkdirp(libDir);

  const templateDir = path.join(__dirname, '..', '..', 'templates', 'libs', type);
  
  // Copy template files
  const templateFiles = await fs.readdir(templateDir, { withFileTypes: true });
  for (const file of templateFiles) {
    if (file.isFile()) {
      let content = await fs.readFile(path.join(templateDir, file.name), 'utf-8');
      
      // Replace template variables with appropriate naming conventions
      const packageName = type === 'go' ? name.replace(/-/g, '_') : name;
      content = content.replace(/\{\{name\}\}/g, packageName);
      
      // Handle special file name replacements
      let targetFileName = file.name;
      if (file.name.includes('{{name}}')) {
        targetFileName = file.name.replace(/\{\{name\}\}/g, name);
      }
      
      await fs.writeFile(path.join(libDir, targetFileName), content);
    } else if (file.isDirectory()) {
      // Recursively copy directories
      await fs.copy(path.join(templateDir, file.name), path.join(libDir, file.name));
    }
  }

  // Create README.md
  const readmeContent = `# ${name}

A ${type} shared library for the ${config.name} monorepo.

## Description

This shared library provides common utilities, models, and functions that can be used across multiple services in the monorepo.

## Usage

### ${type === 'python' ? 'Python' : type === 'go' ? 'Go' : 'Java'}

${getUsageExample(type, name)}

## Development

${getDevelopmentInstructions(type)}

## Generated by create-polyglot

This library was generated using create-polyglot. To add more shared libraries:

\`\`\`bash
npx create-polyglot add lib <name> --type ${type}
\`\`\`
`;

  await fs.writeFile(path.join(libDir, 'README.md'), readmeContent);

  // Update polyglot.json
  const newLib = {
    name,
    type,
    path: `packages/libs/${name}`,
    createdAt: new Date().toISOString()
  };

  config.sharedLibs = config.sharedLibs || [];
  config.sharedLibs.push(newLib);
  
  await fs.writeJSON(configPath, config, { spaces: 2 });

  // Call after:lib:create hook
  await callHook('after:lib:create', {
    name,
    type,
    projectDir,
    libDir,
    config,
    library: newLib,
    options
  });

  console.log(chalk.green(`\n✅ Shared library '${name}' created successfully!`));
  console.log(chalk.cyan(`📁 Location: packages/libs/${name}`));
  
  // Show usage suggestions
  console.log(chalk.blue('\n💡 Next steps:'));
  console.log(chalk.gray('   • Add your shared code to the library'));
  console.log(chalk.gray('   • Update services to import from this library'));
  console.log(chalk.gray(`   • Run 'npx create-polyglot libs' to see all libraries`));
}

function getUsageExample(type, name) {
  switch (type) {
    case 'python':
      return `\`\`\`python
# Import utilities from the shared library
from ${name}.utils import format_response, validate_config
from ${name}.models import ServiceHealth, ErrorResponse

# Use in your service
response = format_response({"message": "Hello"}, "success")
health = ServiceHealth("my-service", "healthy")
\`\`\``;
    
    case 'go':
      return `\`\`\`go
// Import from the shared library
import "${name}"

// Use in your service
response := ${name}.FormatResponse(data, "success", nil)
health := ${name}.NewServiceHealth("my-service", "healthy")
\`\`\``;
    
    default:
      return '// Usage example not available for this type';
  }
}

function getDevelopmentInstructions(type) {
  switch (type) {
    case 'python':
      return `\`\`\`bash
# Install in editable mode
pip install -e .

# Install development dependencies
pip install -e .[dev]

# Run tests
pytest

# Format code
black .

# Type check
mypy .
\`\`\``;
    
    case 'go':
      return `\`\`\`bash
# Initialize module (if needed)
go mod tidy

# Run tests
go test ./...

# Format code
go fmt ./...

# Lint
golangci-lint run
\`\`\``;
    
    default:
      return '// Development instructions not available for this type';
  }
}

export async function removeSharedLibrary(projectDir, name, options = {}) {
  const configPath = path.join(projectDir, 'polyglot.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polyglot.json not found. Are you in a create-polyglot project?');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const libs = config.sharedLibs || [];
  const libToRemove = libs.find(lib => lib.name === name);

  if (!libToRemove) {
    throw new Error(`Shared library '${name}' not found`);
  }

  // Confirmation prompt unless --yes
  if (!options.yes) {
    const { default: prompts } = await import('prompts');
    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Remove shared library '${name}' (${libToRemove.type})?`,
      initial: false
    });

    if (!response.confirm) {
      console.log(chalk.yellow('❌ Cancelled'));
      return;
    }
  }

  console.log(chalk.cyanBright(`\n🗑️  Removing shared library '${name}'...`));

  // Call before:lib:remove hook
  await callHook('before:lib:remove', {
    name,
    library: libToRemove,
    projectDir,
    config,
    options
  });

  // Remove from config
  config.sharedLibs = libs.filter(lib => lib.name !== name);
  await fs.writeJSON(configPath, config, { spaces: 2 });

  // Remove files unless --keep-files
  if (!options.keepFiles) {
    const libDir = path.join(projectDir, libToRemove.path);
    if (await fs.pathExists(libDir)) {
      await fs.remove(libDir);
      console.log(chalk.gray(`📁 Removed directory: ${libToRemove.path}`));
    }
  } else {
    console.log(chalk.yellow(`📁 Kept files: ${libToRemove.path} (use --keep-files=false to remove)`));
  }

  // Call after:lib:remove hook
  await callHook('after:lib:remove', {
    name,
    library: libToRemove,
    projectDir,
    config,
    options
  });

  console.log(chalk.green(`✅ Shared library '${name}' removed successfully`));

  // Show remaining libraries
  const remainingLibs = config.sharedLibs || [];
  if (remainingLibs.length > 0) {
    console.log(chalk.blue('\n📚 Remaining libraries:'));
    for (const lib of remainingLibs) {
      console.log(`  ${chalk.bold(lib.name)} (${lib.type}) - ${chalk.gray(lib.path)}`);
    }
  } else {
    console.log(chalk.yellow('\n📭 No shared libraries remaining in the workspace'));
  }
}
