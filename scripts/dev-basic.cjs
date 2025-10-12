const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const servicesDir = path.join(root, 'services');

if (!fs.existsSync(servicesDir)) {
  console.warn('⚠️  services/ directory not found. No local services will be started.');
  process.exit(0);
}

const services = fs.readdirSync(servicesDir);

// Determine the root package manager heuristically
function detectPM() {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun';
  return 'npm';
}
const pm = detectPM();

if (services.length === 0) {
  console.warn('⚠️  No services found inside services/.');
  process.exit(0);
}

console.log(`Using package manager: ${pm}`);
console.log(`Discovered services: ${services.join(', ')}`);

const procs = [];

function prefix(name, data) {
  process.stdout.write(`[${name}] ${data}`);
}

services.forEach((svc) => {
  const svcPath = path.join(servicesDir, svc);
  const pkgPath = path.join(svcPath, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.warn(`⚠️  Skipping ${svc} (no package.json; likely non-Node service)`);
    return;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const script = pkg.scripts?.dev || pkg.scripts?.start;

    if (!script) {
      console.warn(`⚠️  Skipping ${svc} (no "dev" or "start" script in package.json)`);
      return;
    }

    const cmd = pm === 'bun' ? 'bun' : pm;
    const args =
      pm === 'yarn'
        ? ['run', script === pkg.scripts.dev ? 'dev' : 'start']
        : pm === 'bun'
        ? ['run', script === pkg.scripts.dev ? 'dev' : 'start']
        : ['run', script === pkg.scripts.dev ? 'dev' : 'start'];

    const child = spawn(cmd, args, {
      cwd: svcPath,
      shell: true,
      env: process.env,
    });

    procs.push(child);
    child.stdout.on('data', (d) => prefix(svc, d));
    child.stderr.on('data', (d) => prefix(svc, d));
    child.on('exit', (code) => {
      console.log(`[${svc}] exited with code ${code}`);
    });
  } catch (e) {
    console.error(`❌ Failed to start ${svc}:`, e.message);
  }
});

process.on('SIGINT', () => {
  procs.forEach((p) => p.kill('SIGINT'));
  process.exit(0);
});
