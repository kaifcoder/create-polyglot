#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
 
import { scaffoldMonorepo, addService, scaffoldPlugin, removeService, removePlugin } from './lib/scaffold.js';
import fs from 'fs';
import path from 'path';
import { renderServicesTable } from './lib/ui.js';
import { runDev } from './lib/dev.js';
import { startAdminDashboard } from './lib/admin.js';
import { runHotReload } from './lib/hotreload.js';
import { viewLogs } from './lib/logs.js';
 
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
  .option('--with-actions', 'Generate a GitHub Actions CI workflow (ci.yml)')
  .option('--yes', 'Skip confirmation (assume yes) for non-interactive use')
  .action(async (...args) => {
    const projectNameArg = args[0];
    const command = args[args.length - 1];
    const options = command.opts();
    
    await scaffoldMonorepo(projectNameArg, options);
  });
 
// Backward compatibility: calling the root command directly still scaffolds (deprecated path).
// Simplified to avoid option conflicts with subcommands
program
  .argument('[project-name]', '(Deprecated: call `create-polyglot init <name>` instead) Project name')
  .action(async (projectNameArg) => {
    console.log(chalk.yellow('⚠️  Direct invocation is deprecated. Use `create-polyglot init` going forward.'));
    console.log(chalk.yellow('   Example: create-polyglot init ' + (projectNameArg || 'my-project')));
    process.exit(1);
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
        console.error(chalk.red(`Unknown entity '${entity}'. Use service or plugin.`));
        process.exit(1);
      }
    } catch (e) {
      console.error(chalk.red('Failed to add:'), e.message);
      process.exit(1);
    }
  });

program
  .command('remove')
  .description('Remove a service or plugin')
  .argument('<entity>', 'service | plugin')
  .argument('<name>', 'Name of the service or plugin')
  .option('--keep-files', 'Keep service files, only remove from configuration')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (entity, name, opts) => {
    const projectDir = process.cwd();
    try {
      if (entity === 'service') {
        await removeService(projectDir, name, opts);
      } else if (entity === 'plugin') {
        await removePlugin(projectDir, name, opts);
      } else {
        console.error(chalk.red(`Unknown entity '${entity}'. Use service or plugin.`));
        process.exit(1);
      }
    } catch (e) {
      console.error(chalk.red('Failed to remove:'), e.message);
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

// Unified hot reload aggregator
program
  .command('hot')
  .description('Unified hot reload across services (auto-restart / HMR)')
  .option('-s, --services <list>', 'Subset of services (comma names or types)')
  .option('--dry-run', 'Show what would run without starting processes')
  .action(async (opts) => {
    try {
      const filter = opts.services ? opts.services.split(',').map(s => s.trim()).filter(Boolean) : [];
      await runHotReload({ servicesFilter: filter, dryRun: !!opts.dryRun });
    } catch (e) {
      console.error(chalk.red('Failed to start hot reload:'), e.message);
      process.exit(1);
    }
  });

// Service logs viewer and management
program
  .command('logs')
  .description('View and manage service logs')
  .argument('[service]', 'Specific service name (optional, shows all services if omitted)')
  .option('-f, --follow', 'Follow log output in real-time')
  .option('-t, --tail <lines>', 'Number of recent lines to show (default: 50)', '50')
  .option('--since <time>', 'Show logs since timestamp (ISO format or relative like "1h", "30m")')
  .option('--filter <pattern>', 'Filter logs by pattern (regex supported)')
  .option('--level <level>', 'Filter by log level (error, warn, info, debug)')
  .option('--export <format>', 'Export logs to file (json, csv, txt)')
  .option('--clear', 'Clear all logs for the specified service(s)')
  .action(async (serviceName, opts) => {
    try {
      await viewLogs(serviceName, opts);
    } catch (e) {
      console.error(chalk.red('Failed to view logs:'), e.message);
      process.exit(1);
    }
  });

// Plugin management commands
const pluginCmd = program
  .command('plugin')
  .description('Manage plugins');

pluginCmd
  .command('list')
  .description('List all plugins in the current workspace')
  .option('--json', 'Output as JSON')
  .option('--enabled-only', 'Show only enabled plugins')
  .action(async (opts) => {
    try {
      const { pluginSystem } = await import('./lib/plugin-system.js');
      const cwd = process.cwd();
      
      await pluginSystem.initialize(cwd);
      const plugins = pluginSystem.getAllPlugins();
      
      let filteredPlugins = plugins;
      if (opts.enabledOnly) {
        filteredPlugins = plugins.filter(p => p.enabled);
      }
      
      if (opts.json) {
        console.log(JSON.stringify(filteredPlugins, null, 2));
      } else {
        if (filteredPlugins.length === 0) {
          console.log(chalk.yellow('No plugins found.'));
          return;
        }
        
        console.log(chalk.blue(`\n📦 Found ${filteredPlugins.length} plugin(s):\n`));
        for (const plugin of filteredPlugins) {
          const status = plugin.enabled ? chalk.green('enabled') : chalk.red('disabled');
          const type = plugin.type === 'local' ? chalk.cyan('local') : chalk.magenta('external');
          console.log(`  ${chalk.bold(plugin.name)} [${status}] (${type})`);
          if (plugin.plugin?.description) {
            console.log(`    ${chalk.gray(plugin.plugin.description)}`);
          }
          if (plugin.plugin?.version) {
            console.log(`    ${chalk.gray('v' + plugin.plugin.version)}`);
          }
          console.log();
        }
      }
    } catch (e) {
      console.error(chalk.red('Failed to list plugins:'), e.message);
      process.exit(1);
    }
  });

pluginCmd
  .command('enable')
  .description('Enable a plugin')
  .argument('<name>', 'Plugin name')
  .action(async (name) => {
    try {
      const { pluginSystem } = await import('./lib/plugin-system.js');
      const cwd = process.cwd();
      
      await pluginSystem.initialize(cwd);
      await pluginSystem.enablePlugin(name);
      
      console.log(chalk.green(`✅ Plugin '${name}' enabled successfully`));
    } catch (e) {
      console.error(chalk.red('Failed to enable plugin:'), e.message);
      process.exit(1);
    }
  });

pluginCmd
  .command('disable')
  .description('Disable a plugin')
  .argument('<name>', 'Plugin name')
  .action(async (name) => {
    try {
      const { pluginSystem } = await import('./lib/plugin-system.js');
      const cwd = process.cwd();
      
      await pluginSystem.initialize(cwd);
      await pluginSystem.disablePlugin(name);
      
      console.log(chalk.green(`✅ Plugin '${name}' disabled successfully`));
    } catch (e) {
      console.error(chalk.red('Failed to disable plugin:'), e.message);
      process.exit(1);
    }
  });

pluginCmd
  .command('info')
  .description('Show detailed information about a plugin')
  .argument('<name>', 'Plugin name')
  .option('--json', 'Output as JSON')
  .action(async (name, opts) => {
    try {
      const { pluginSystem, HOOK_POINTS } = await import('./lib/plugin-system.js');
      const cwd = process.cwd();
      
      await pluginSystem.initialize(cwd);
      const plugin = pluginSystem.getPlugin(name);
      
      if (!plugin) {
        console.log(chalk.yellow(`Plugin '${name}' not found.`));
        process.exit(1);
      }
      
      if (opts.json) {
        const info = {
          name: plugin.name,
          type: plugin.type,
          enabled: plugin.enabled,
          loadedAt: plugin.loadedAt,
          plugin: plugin.plugin,
          config: plugin.config
        };
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log(chalk.blue(`\n📦 Plugin: ${chalk.bold(plugin.name)}\n`));
        console.log(`Type: ${plugin.type === 'local' ? chalk.cyan('Local') : chalk.magenta('External')}`);
        console.log(`Status: ${plugin.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
        console.log(`Loaded: ${plugin.loadedAt ? new Date(plugin.loadedAt).toLocaleString() : 'Not loaded'}`);
        
        if (plugin.plugin) {
          if (plugin.plugin.version) {
            console.log(`Version: ${plugin.plugin.version}`);
          }
          if (plugin.plugin.description) {
            console.log(`Description: ${plugin.plugin.description}`);
          }
          
          if (plugin.plugin.hooks) {
            console.log(`\nHooks (${Object.keys(plugin.plugin.hooks).length}):`);
            for (const [hookName, handler] of Object.entries(plugin.plugin.hooks)) {
              const description = HOOK_POINTS[hookName] || 'Custom hook';
              console.log(`  ${chalk.cyan(hookName)} - ${chalk.gray(description)}`);
            }
          }
          
          if (plugin.plugin.methods) {
            console.log(`\nMethods (${Object.keys(plugin.plugin.methods).length}):`);
            for (const methodName of Object.keys(plugin.plugin.methods)) {
              console.log(`  ${chalk.cyan(methodName)}`);
            }
          }
        }
        
        if (plugin.config) {
          console.log(`\nConfiguration:`);
          console.log(JSON.stringify(plugin.config, null, 2));
        }
        console.log();
      }
    } catch (e) {
      console.error(chalk.red('Failed to get plugin info:'), e.message);
      process.exit(1);
    }
  });

pluginCmd
  .command('configure')
  .description('Configure a plugin')
  .argument('<name>', 'Plugin name')
  .option('--config <json>', 'Configuration as JSON string')
  .option('--priority <number>', 'Plugin loading priority (higher = loads first)')
  .option('--external <path>', 'Set external plugin path or npm package')
  .action(async (name, opts) => {
    try {
      const { pluginSystem } = await import('./lib/plugin-system.js');
      const cwd = process.cwd();
      
      await pluginSystem.initialize(cwd);
      
      const config = {};
      
      if (opts.config) {
        try {
          Object.assign(config, JSON.parse(opts.config));
        } catch (e) {
          console.error(chalk.red('Invalid JSON in --config option'));
          process.exit(1);
        }
      }
      
      if (opts.priority !== undefined) {
        config.priority = parseInt(opts.priority);
      }
      
      if (opts.external) {
        config.external = opts.external;
      }
      
      if (Object.keys(config).length === 0) {
        console.log(chalk.yellow('No configuration options provided. Use --config, --priority, or --external.'));
        process.exit(1);
      }
      
      await pluginSystem.configurePlugin(name, config);
      
      console.log(chalk.green(`✅ Plugin '${name}' configured successfully`));
      console.log('New configuration:', JSON.stringify(config, null, 2));
    } catch (e) {
      console.error(chalk.red('Failed to configure plugin:'), e.message);
      process.exit(1);
    }
  });

pluginCmd
  .command('remove')
  .description('Remove a plugin')
  .argument('<name>', 'Plugin name')
  .option('--keep-files', 'Keep plugin files, only remove from configuration')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (name, opts) => {
    try {
      const { removePlugin } = await import('./lib/scaffold.js');
      const cwd = process.cwd();
      await removePlugin(cwd, name, opts);
    } catch (e) {
      console.error(chalk.red('Failed to remove plugin:'), e.message);
      process.exit(1);
    }
  });

pluginCmd
  .command('stats')
  .description('Show plugin system statistics')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const { pluginSystem } = await import('./lib/plugin-system.js');
      const cwd = process.cwd();
      
      await pluginSystem.initialize(cwd);
      const stats = pluginSystem.getStats();
      
      if (opts.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.blue('\n📊 Plugin System Statistics\n'));
        console.log(`Initialized: ${stats.initialized ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`Project Directory: ${stats.projectDir || 'N/A'}`);
        console.log(`Total Plugins: ${stats.totalPlugins}`);
        console.log(`Enabled Plugins: ${stats.enabledPlugins}`);
        console.log(`Available Hook Points: ${stats.hookPoints}`);
        
        console.log('\nRegistered Hooks:');
        for (const [hookName, count] of Object.entries(stats.registeredHooks)) {
          console.log(`  ${chalk.cyan(hookName)}: ${count} handler(s)`);
        }
        
        if (Object.keys(stats.config).length > 0) {
          console.log('\nPlugin Configuration:');
          for (const [pluginName, config] of Object.entries(stats.config)) {
            console.log(`  ${chalk.bold(pluginName)}:`);
            console.log(`    ${JSON.stringify(config, null, 4).replace(/^/gm, '    ')}`);
          }
        }
        console.log();
      }
    } catch (e) {
      console.error(chalk.red('Failed to get plugin stats:'), e.message);
      process.exit(1);
    }
  });
 
program.parse();
 
 