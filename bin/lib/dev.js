import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import http from 'http';

function colorFor(name) {
  const colors = [chalk.cyan, chalk.magenta, chalk.green, chalk.blue, chalk.yellow, chalk.redBright];
  let sum = 0; for (let i=0;i<name.length;i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
}

async function waitForHealth(url, timeoutMs=15000, interval=500) {
  const start = Date.now();
  return new Promise(resolve => {
    const check = () => {
      const req = http.get(url, res => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(true); req.destroy(); return;
        }
        res.resume();
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, interval);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, interval);
      });
    };
    check();
  });
}

export async function runDev({ docker=false } = {}) {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'polyglot.json');
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red('polyglot.json not found. Run inside a generated workspace.'));
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const servicesDir = path.join(cwd, 'services');
  if (!fs.existsSync(servicesDir)) {
  console.log(chalk.yellow('⚠️  services/ directory not found. No local services will be started.'));
  //no return - continue to check cfg.services
}
  if (docker) {
    console.log(chalk.cyan('🛳  Starting via docker compose...'));
    const compose = spawn('docker', ['compose', 'up', '--build'], { stdio: 'inherit' });
    compose.on('exit', code => process.exit(code || 0));
    return;
  }
  console.log(chalk.cyan('🚀 Starting services locally (best effort)...'));
  const procs = [];
  const healthPromises = [];

if (fs.existsSync(servicesDir)) {
  for (const svc of cfg.services) {
    const svcPath = path.join(cwd, svc.path);

    if (!fs.existsSync(svcPath)) continue;
    // Only auto-run node & frontend services (others require language runtime dev tasks)
    if (!['node','frontend'].includes(svc.type)) continue;

    const pkgPath = path.join(svcPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
  console.log(`Skipping ${svc.name} (no package.json)`);
  continue;
}

let pkg; 
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath,'utf-8'));
} catch {
  console.log(chalk.yellow(`Skipping ${svc.name} (invalid package.json)`));
    continue;
}

// Determine which script to run
const useScript = pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : null;
if (!useScript) {
   console.log(chalk.yellow(`Skipping ${svc.name} (no "dev" or "start" script)`));
    continue;
}
if (useScript === 'start') {
  console.log(`running start instead of dev for ${svc.name}`);
}

const color = colorFor(svc.name);
const pm = detectPM(svcPath);
const cmd = pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : pm === 'bun' ? 'bun' : 'npm';
const args = ['run', useScript]; 

    const child = spawn(cmd, args, { cwd: svcPath, env: { ...process.env, PORT: String(svc.port) }, shell: true });
    procs.push(child);
    child.stdout.on('data', d => process.stdout.write(color(`[${svc.name}] `) + d.toString()));
    child.stderr.on('data', d => process.stderr.write(color(`[${svc.name}] `) + d.toString()));
    child.on('exit', code => {
      process.stdout.write(color(`[${svc.name}] exited with code ${code}\n`));
    });
    // health check
    const healthUrl = `http://localhost:${svc.port}/health`;
    const hp = waitForHealth(healthUrl,30000).then(ok => {
      const msg = ok ? chalk.green(`✔ health OK ${svc.name} ${healthUrl}`) : chalk.yellow(`⚠ health timeout ${svc.name} ${healthUrl}`);
      console.log(msg);
    });
    healthPromises.push(hp);
  }
}

  if (!procs.length) {
    console.log(chalk.yellow('No auto-runnable Node/Frontend services found. Use --docker to start all via compose.'));
    // ✅ FIXED: Exit cleanly when running in CI/test mode
    if (process.env.CI === 'true') {
      process.exit(0);
    }
  }
  await Promise.all(healthPromises);

  if (procs.length > 0) {
    console.log(chalk.blue('Watching services. Press Ctrl+C to exit.'));
    process.on('SIGINT', () => { procs.forEach(p => p.kill('SIGINT')); process.exit(0); });
  }
}

function detectPM(root) {
  if (fs.existsSync(path.join(root,'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root,'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root,'bun.lockb'))) return 'bun';
  return 'npm';
}
