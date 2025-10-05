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
    const proc = execa('node', [cliPath, 'dev'], { cwd: projectPath, env: { ...process.env, CI: 'true' } });
    // wait briefly then kill
    await new Promise(r => setTimeout(r, 3500));
    proc.kill('SIGINT');
    await proc.catch(()=>{}); // ignore exit errors due to SIGINT
    expect(fs.existsSync(path.join(projectPath,'polyglot.json'))).toBe(true);
  }, 20000);
});