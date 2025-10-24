#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
 
import { scaffoldMonorepo, addService, scaffoldPlugin } from './lib/scaffold.js';
import fs from 'fs';
import path from 'path';
import { renderServicesTable } from './lib/ui.js';
import { runDev } from './lib/dev.js';
import { startAdminDashboard } from './lib/admin.js';
 
const program = new Command();
 
 
program
  .name('create-polyglot')
  .description('Scaffold a polyglot microservice monorepo');
 
// New explicit init subcommand (Task: add-init-command)
program
  .command('init')
  .argument('[project-name]', 'Name of the project (optional, will prompt if omitted)')
  .option('-s, --services <services>', 'Comma separated list of services (node,python,go,java,frontend)')
  .option('--preset <preset>', 'Add preset: turborepo | nx')
  .option('--no-install', 'Skip installing dependencies at the root')
  .option('--git', 'Initialize a git repository')
  .option('--force', 'Overwrite if directory exists and not empty')
  .option('--package-manager <pm>', 'npm | pnpm | yarn | bun (default: npm)')
  .option('--frontend-generator', 'Use create-next-app to scaffold the frontend instead of the bundled template')
  .option('--yes', 'Skip confirmation (assume yes) for non-interactive use')
  .action(async (projectNameArg, options) => {
    await scaffoldMonorepo(projectNameArg, options);
  });
 
// Backward compatibility: calling the root command directly still scaffolds (deprecated path).
program
  .argument('[project-name]', '(Deprecated: call `create-polyglot init <name>` instead) Project name')
  .option('-s, --services <services>', '(Deprecated) Services list')
  .option('--preset <preset>', '(Deprecated) Preset turborepo|nx')
  .option('--no-install', '(Deprecated) Skip install')
  .option('--git', '(Deprecated) Init git')
  .option('--force', '(Deprecated) Overwrite directory')
  .option('--package-manager <pm>', '(Deprecated) Package manager')
  .option('--frontend-generator', '(Deprecated) Use create-next-app for frontend')
  .option('--yes', '(Deprecated) Assume yes for prompts')
  .action(async (projectNameArg, options) => {
    if (!options._deprecatedNoticeShown) {
      console.log(chalk.yellow('⚠️  Direct invocation is deprecated. Use `create-polyglot init` going forward.'));
      options._deprecatedNoticeShown = true;
    }
    await scaffoldMonorepo(projectNameArg, options);
  });
 
// Additional commands must be registered before final parse.
program
  .command('add')
  .description('Add a new service or plugin')
  .argument('<entity>', 'service | plugin')
  .argument('<name>', 'Name of the service or plugin')
  .option('--type <type>', 'Service type (node|python|go|java|frontend)')
  .option('--lang <type>', '(Deprecated) Alias of --type')
  .option('--port <port>', 'Service port')
  .option('--yes', 'Non-interactive defaults')
  .action(async (entity, name, opts) => {
    const projectDir = process.cwd();
    try {
      if (entity === 'service') {
        let type = opts.type || opts.lang;
        let port = opts.port ? Number(opts.port) : undefined;
        if (!opts.yes) {
          const promptsMod = await import('prompts');
          const p = promptsMod.default;
          if (!type) {
            const ans = await p({ type: 'select', name: 'type', message: 'Service type:', choices: [
              { title: 'Node.js', value: 'node' },
              { title: 'Python', value: 'python' },
              { title: 'Go', value: 'go' },
              { title: 'Java', value: 'java' },
              { title: 'Frontend (Next.js)', value: 'frontend' }
            ] });
            type = ans.type;
          }
          if (!port) {
            const ans = await p({ type: 'text', name: 'port', message: 'Port (leave blank for default):', validate: v => !v || (/^\d+$/.test(v) && +v>0 && +v<=65535) ? true : 'Invalid port' });
            if (ans.port) port = Number(ans.port);
          }
        }
        const defaultPorts = { frontend: 3000, node: 3001, go: 3002, java: 3003, python: 3004 };
        if (!type) throw new Error('Service type required');
        if (!port) port = defaultPorts[type];
        await addService(projectDir, { type, name, port }, opts);
      } else if (entity === 'plugin') {
        await scaffoldPlugin(projectDir, name);
      } else {
        console.log(chalk.red(`Unknown entity '${entity}'. Use service or plugin.`));
        process.exit(1);
      }
    } catch (e) {
      console.error(chalk.red('Failed to add:'), e.message);
      process.exit(1);
    }
  });
 
program
  .command('dev')
  .description('Run services locally (Node & frontend) or use --docker for compose')
  .option('--docker', 'Use docker compose up --build to start all services')
  .action(async (opts) => {
    await runDev({ docker: !!opts.docker });
  });
 
program
  .command('services')
  .description('List services in the current workspace (table)')
  .option('--json', 'Output raw JSON instead of table')
  .action(async (opts) => {
    try {
      const cwd = process.cwd();
      const cfgPath = path.join(cwd, 'polyglot.json');
      if (!fs.existsSync(cfgPath)) {
        console.log(chalk.red('polyglot.json not found. Run inside a generated workspace.'));
        process.exit(1);
      }
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (opts.json) {
        console.log(JSON.stringify(cfg.services, null, 2));
      } else {
        renderServicesTable(cfg.services, { title: 'Workspace Services' });
      }
    } catch (e) {
      console.error(chalk.red('Failed to list services:'), e.message);
      process.exit(1);
    }
  });
 
program
  .command('admin')
  .description('Launch admin dashboard to monitor service status')
  .option('-p, --port <port>', 'Dashboard port (default: 8080)', '8080')
  .option('-r, --refresh <ms>', 'Refresh interval in milliseconds (default: 5000)', '5000')
  .option('--no-open', 'Don\'t auto-open browser')
  .action(async (opts) => {
    try {
      const port = parseInt(opts.port);
      const refresh = parseInt(opts.refresh);
      
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red('Invalid port number. Must be between 1-65535.'));
        process.exit(1);
      }
      
      if (isNaN(refresh) || refresh < 1000) {
        console.error(chalk.red('Invalid refresh interval. Must be at least 1000ms.'));
        process.exit(1);
      }
      
      await startAdminDashboard({
        port,
        refresh,
        open: opts.open
      });
    } catch (e) {
      console.error(chalk.red('Failed to start admin dashboard:'), e.message);
      process.exit(1);
    }
  });
 
program.parse();
 
 