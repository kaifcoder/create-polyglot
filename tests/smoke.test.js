import { execa } from 'execa';
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Basic smoke test: run the CLI with a temp directory and ensure it creates expected folders.

describe('create-polyglot CLI smoke', () => {
  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'polyglot-smoke-'));
  let tmpDir = path.join(tmpParent, 'workspace');
  fs.mkdirSync(tmpDir);
  const projName = 'smoke-proj';

  afterAll(() => {
    // Cleanup temp directory
    try { fs.rmSync(tmpParent, { recursive: true, force: true }); } catch {}
  });

  it('scaffolds a project with a node service', async () => {
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, 'bin/index.js');
    await execa('node', [cliPath, projName, '--services', 'node', '--no-install', '--yes'], { cwd: tmpDir });
    const projectPath = path.join(tmpDir, projName);
    expect(fs.existsSync(path.join(projectPath, 'apps/node'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
  }, 30000);
});
