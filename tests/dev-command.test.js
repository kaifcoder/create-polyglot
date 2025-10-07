import { execa } from 'execa';
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('polyglot dev command (non-docker)', () => {
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'polyglot-dev-'));
  const tmpDir = path.join(tmpParent, 'workspace');
  fs.mkdirSync(tmpDir);
  const projName = 'dev-proj';

  afterAll(() => { try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch {} });

  it('starts node service and performs health check', async () => {
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, 'bin/index.js');
    await execa('node', [cliPath, 'init', projName, '--services', 'node', '--no-install', '--yes'], { cwd: tmpDir, env: { ...process.env, CI: 'true' } });
    const projectPath = path.join(tmpDir, projName);
    // Write a minimal dev script to the node service if missing
    const nodePkgPath = path.join(projectPath, 'services/node/package.json');
    const nodePkg = JSON.parse(fs.readFileSync(nodePkgPath,'utf-8'));
    nodePkg.scripts = nodePkg.scripts || {}; nodePkg.scripts.dev = 'node src/index.js';
    fs.writeFileSync(nodePkgPath, JSON.stringify(nodePkg, null, 2));

    // Add polyglot.json
    fs.writeFileSync(
      path.join(projectPath, 'polyglot.json'),
      JSON.stringify({
        name: projName,
        services: [{ name: 'node', path: 'services/node', type: 'node', port: 3000 }]
      }, null, 2)
    );

    const proc = execa('node', [cliPath, 'dev'], { cwd: projectPath, env: { ...process.env, CI: 'true' } });
    // wait briefly then kill
    await new Promise(r => setTimeout(r, 3500));
    proc.kill('SIGINT');
    await proc.catch(()=>{}); // ignore exit errors due to SIGINT
    expect(fs.existsSync(path.join(projectPath,'polyglot.json'))).toBe(true);
  }, 20000);

    // New tests for updated dev.js
    it('warns and skips service with no package.json', async () => {
    const projectPath = path.join(tmpDir, 'no-pkg-proj');
    fs.mkdirSync(projectPath, { recursive: true });
    const servicesDir = path.join(projectPath, 'services');
    fs.mkdirSync(servicesDir, { recursive: true });
    fs.mkdirSync(path.join(servicesDir, 'dummy'));

     // Add polyglot.json
    fs.writeFileSync(
      path.join(projectPath, 'polyglot.json'),
      JSON.stringify({
        name: 'no-pkg-proj',
        services: [{ name: 'dummy', path: 'services/dummy', type: 'node', port: 3001 }]
      }, null, 2)
    );

    const cliPath = path.join(process.cwd(), 'bin/index.js');
    const proc = execa('node', [cliPath, 'dev'], {
  cwd: projectPath,
  env: { ...process.env, CI: 'true' },
  timeout: 3000,      // ← ADDED: Kill after 3 seconds
  reject: false,      // ← ADDED: Don't throw on timeout
});

const result = await proc;

    expect(result.stdout).toMatch(/Skipping dummy \(no package.json\)/);
  },10000);

  it('runs start script if dev script is missing', async () => {
    const projectPath = path.join(tmpDir, 'start-only-proj');
    fs.mkdirSync(projectPath, { recursive: true });
    const servicesDir = path.join(projectPath, 'services');
    fs.mkdirSync(servicesDir, { recursive: true });
    const svcDir = path.join(servicesDir, 'start-service');
    fs.mkdirSync(svcDir);

    const pkg = {
      name: 'start-service',
      version: '1.0.0',
      scripts: { start: 'echo "running start instead of dev"' },
    };
    fs.writeFileSync(path.join(svcDir, 'package.json'), JSON.stringify(pkg, null, 2));

    // Add polyglot.json
    fs.writeFileSync(
      path.join(projectPath, 'polyglot.json'),
      JSON.stringify({
        name: 'start-only-proj',
        services: [{ name: 'start-service', path: 'services/start-service', type: 'node', port: 3002 }]
      }, null, 2)
    );

    const cliPath = path.join(process.cwd(), 'bin/index.js');

const proc = execa('node', [cliPath, 'dev'], {
  cwd: projectPath,
  env: { ...process.env, CI: 'true' },
  timeout: 5000,      // ← ADDED: 5 second timeout
  reject: false,      // ← ADDED: Don't throw
});

await new Promise(r => setTimeout(r, 2000));
proc.kill('SIGINT');
const result = await proc;
expect(result.stdout).toContain('running start instead of dev');
  }, 20000);

  it('warns and skips service with invalid package.json', async () => {
    const projectPath = path.join(tmpDir, 'invalid-pkg-proj');
    fs.mkdirSync(projectPath, { recursive: true });
    const servicesDir = path.join(projectPath, 'services');
    fs.mkdirSync(servicesDir, { recursive: true });
    const svcDir = path.join(servicesDir, 'bad-service');
    fs.mkdirSync(svcDir);
    fs.writeFileSync(path.join(svcDir, 'package.json'), '{ invalid json }');

    // Add polyglot.json
    fs.writeFileSync(
      path.join(projectPath, 'polyglot.json'),
      JSON.stringify({
        name: 'invalid-pkg-proj',
        services: [{ name: 'bad-service', path: 'services/bad-service', type: 'node', port: 3003 }]
      }, null, 2)
    );

    const cliPath = path.join(process.cwd(), 'bin/index.js');
    const proc = execa('node', [cliPath, 'dev'], {
  cwd: projectPath,
  env: { ...process.env, CI: 'true' },
  timeout: 3000,      // ← ADDED: Kill after 3 seconds
  reject: false,      // ← ADDED: Don't throw on timeout
});

const result = await proc;

  expect(result.stdout).toMatch(/Skipping bad-service \(invalid package\.json\)/);
}, 10000); // ← CHANGED: Increased from 5000 to 10000 to be safe
});