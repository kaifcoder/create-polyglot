import { execa } from 'execa';
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('create-polyglot init subcommand', () => {
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'polyglot-init-'));
  let tmpDir = path.join(tmpParent, 'workspace');
  fs.mkdirSync(tmpDir);
  const projName = 'init-proj';

  afterAll(() => {
    try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch {}
  });

  it('scaffolds a project via init subcommand', async () => {
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, 'bin/index.js');
    await execa('node', [cliPath, 'init', projName, '--services', 'node', '--no-install', '--yes'], {
      cwd: tmpDir,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0' }
    });
    const projectPath = path.join(tmpDir, projName);
    expect(fs.existsSync(path.join(projectPath, 'services/node'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'polyglot.json'))).toBe(true);
  }, 45000);
});
