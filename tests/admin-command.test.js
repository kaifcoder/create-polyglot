import { test, expect } from 'vitest';
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
 
const TEST_DIR = path.join(process.cwd(), 'test-workspace', 'admin-command-test');
const CLI_PATH = path.join(process.cwd(), 'bin', 'index.js');
 
test('admin command shows help correctly', async () => {
  const helpResult = await execa('node', [CLI_PATH, 'admin', '--help']);
  expect(helpResult.stdout).toContain('Launch admin dashboard to monitor service status');
  expect(helpResult.stdout).toContain('--port');
  expect(helpResult.stdout).toContain('--refresh');
  expect(helpResult.stdout).toContain('--no-open');
});
 
test('admin command fails outside polyglot workspace', async () => {
  const emptyDir = path.join(TEST_DIR, 'empty');
  if (fs.existsSync(emptyDir)) {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
  fs.mkdirSync(emptyDir, { recursive: true });
 
  // Should fail when no polyglot.json exists
  await expect(
    execa('node', [CLI_PATH, 'admin', '--no-open'], {
      cwd: emptyDir,
      timeout: 10000
    })
  ).rejects.toThrow();
}, 30000);
 
test('admin command validates port options', async () => {
  // Create test workspace first
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
 
  // Create a minimal polyglot.json for testing
  const testConfigPath = path.join(TEST_DIR, 'polyglot.json');
  fs.writeFileSync(testConfigPath, JSON.stringify({
    services: [
      { name: 'test-service', type: 'node', port: 3001, path: 'services/test-service' }
    ]
  }, null, 2));
 
  // Test invalid port
  await expect(
    execa('node', [CLI_PATH, 'admin', '--port', 'invalid', '--no-open'], {
      cwd: TEST_DIR,
      timeout: 10000
    })
  ).rejects.toThrow();
 
  // Test invalid refresh interval
  await expect(
    execa('node', [CLI_PATH, 'admin', '--refresh', '500', '--no-open'], {
      cwd: TEST_DIR,
      timeout: 10000
    })
  ).rejects.toThrow();
}, 30000);
 
test('admin command works with valid polyglot config', async () => {
  // Create test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
 
  // Create a valid polyglot.json
  const testConfigPath = path.join(TEST_DIR, 'polyglot.json');
  fs.writeFileSync(testConfigPath, JSON.stringify({
    services: [
      { name: 'api-service', type: 'node', port: 3001, path: 'services/api-service' },
      { name: 'web-service', type: 'frontend', port: 3000, path: 'services/web-service' }
    ]
  }, null, 2));
 
  // Start admin dashboard in background with high port to avoid conflicts
  const adminProcess = execa('node', [CLI_PATH, 'admin', '--port', '9191', '--no-open'], {
    cwd: TEST_DIR,
    timeout: 15000
  });
 
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
 
  try {
    // Test that server is responding
    const response = await fetch('http://localhost:9191', {
      signal: AbortSignal.timeout(5000)
    });
    expect(response.ok).toBe(true);
    
    const html = await response.text();
    expect(html).toContain('Polyglot Admin Dashboard');
    expect(html).toContain('api-service');
    expect(html).toContain('web-service');
 
  } finally {
    // Clean up
    adminProcess.kill('SIGINT');
    try {
      await adminProcess;
    } catch (error) {
      // Expected when killing process
    }
  }
}, 30000);
 