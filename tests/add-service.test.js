import { execa } from 'execa';
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('add service command', () => {
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'polyglot-addsvc-'));
  const tmpDir = path.join(tmpParent, 'workspace');
  fs.mkdirSync(tmpDir);
  const projName = 'addsvc-proj';

  afterAll(() => { try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch {} });

  it('adds a python service after init', async () => {
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, 'bin/index.js');
    await execa('node', [cliPath, 'init', projName, '--services', 'node', '--no-install', '--yes'], { cwd: tmpDir, env: { ...process.env, CI: 'true' } });
    const projectPath = path.join(tmpDir, projName);
    await execa('node', [cliPath, 'add', 'service', 'pyapi', '--type', 'python', '--port', '5055', '--yes'], { cwd: projectPath, env: { ...process.env, CI: 'true' } });
    expect(fs.existsSync(path.join(projectPath, 'services/pyapi'))).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(path.join(projectPath, 'polyglot.json'), 'utf-8'));
    expect(cfg.services.find(s => s.name === 'pyapi')).toBeTruthy();
  }, 60000);
});
