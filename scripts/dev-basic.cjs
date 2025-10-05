#!/usr/bin/env node
// Simple multi-service dev runner (no turborepo / nx)
// Starts each workspace's dev script concurrently.
// Basic, no restart on file change; rely on each service's own dev behavior.
// CommonJS to ensure compatibility regardless of root type/module settings.

const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
// Updated to new structure: services directory replaces apps
const servicesDir = path.join(root, 'services');
if (!fs.existsSync(servicesDir)) {
  console.error('No services directory found.');
  process.exit(1);
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
  console.log('No Node-based services with package.json to run.');
  process.exit(0);
}

console.log(`Using package manager: ${pm}`);
console.log(`Discovered services: ${services.join(', ')}`);

const procs = [];

function prefix(name, data) {
  process.stdout.write(`[${name}] ${data}`);
}

services.forEach(svc => {
  const svcPath = path.join(servicesDir, svc);
  const pkgPath = path.join(svcPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.log(`Skipping ${svc} (no package.json; likely non-Node service)`);
    return;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts || !pkg.scripts.dev) {
      console.log(`Skipping ${svc} (no dev script)`);
      return;
    }
    const cmd = pm === 'bun' ? 'bun' : pm;
    const args = pm === 'yarn' ? ['run', 'dev'] : pm === 'bun' ? ['run', 'dev'] : ['run', 'dev'];
    const child = spawn(cmd, args, { cwd: svcPath, shell: true, env: process.env });
    procs.push(child);
    child.stdout.on('data', d => prefix(svc, d));
    child.stderr.on('data', d => prefix(svc, d));
    child.on('exit', code => {
      console.log(`[${svc}] exited with code ${code}`);
    });
  } catch (e) {
    console.log(`Failed to start ${svc}:`, e.message);
  }
});

process.on('SIGINT', () => {
  procs.forEach(p => p.kill('SIGINT'));
  process.exit(0);
});
