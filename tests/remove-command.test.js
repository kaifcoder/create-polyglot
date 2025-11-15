import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CLI_PATH = path.join(process.cwd(), 'bin/index.js');

describe('Remove Commands', () => {
  let tempDir;
  let projectPath;

  beforeEach(async () => {
    // Create a temporary project directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'polyglot-test-'));
    projectPath = path.join(tempDir, 'test-project');
    
    // Create a minimal project structure
    await fs.mkdirp(projectPath);
    await fs.mkdirp(path.join(projectPath, 'services'));
    await fs.mkdirp(path.join(projectPath, 'plugins'));
    
    // Create polyglot.json
    await fs.writeJSON(path.join(projectPath, 'polyglot.json'), {
      name: 'test-project',
      services: [
        { name: 'api', type: 'node', port: 3001, path: 'services/api' },
        { name: 'web', type: 'frontend', port: 3000, path: 'services/web' },
        { name: 'worker', type: 'python', port: 3004, path: 'services/worker' }
      ],
      plugins: {
        'test-plugin': {
          enabled: true,
          type: 'local'
        }
      }
    }, { spaces: 2 });

    // Create mock service directories
    await fs.mkdirp(path.join(projectPath, 'services/api'));
    await fs.mkdirp(path.join(projectPath, 'services/web'));
    await fs.mkdirp(path.join(projectPath, 'services/worker'));
    
    // Create mock service files
    await fs.writeFile(path.join(projectPath, 'services/api/package.json'), JSON.stringify({
      name: '@test-project/api',
      version: '1.0.0'
    }, null, 2));
    
    // Create mock plugin directory
    await fs.mkdirp(path.join(projectPath, 'plugins/test-plugin'));
    await fs.writeFile(path.join(projectPath, 'plugins/test-plugin/index.js'), `
      export default {
        name: 'test-plugin',
        version: '1.0.0'
      };
    `);

    // Create compose.yaml
    await fs.writeFile(path.join(projectPath, 'compose.yaml'), `
version: '3.8'
services:
  api:
    build: ./services/api
    ports:
      - "3001:3001"
    networks:
      - app-net
  web:
    build: ./services/web
    ports:
      - "3000:3000"
    networks:
      - app-net
  worker:
    build: ./services/worker
    ports:
      - "3004:3004"
    networks:
      - app-net

networks:
  app-net:
    driver: bridge
`);
  });

  describe('remove service', () => {
    it('should remove a service with confirmation', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'service', 'api', '--yes'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Service \'api\' removed successfully');

      // Check that service was removed from config
      const config = await fs.readJSON(path.join(projectPath, 'polyglot.json'));
      expect(config.services.find(s => s.name === 'api')).toBeUndefined();
      expect(config.services).toHaveLength(2);

      // Check that service directory was removed
      expect(await fs.pathExists(path.join(projectPath, 'services/api'))).toBe(false);
    });

    it('should keep files when --keep-files option is used', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'service', 'api', '--yes', '--keep-files'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Service files kept');

      // Check that service was removed from config
      const config = await fs.readJSON(path.join(projectPath, 'polyglot.json'));
      expect(config.services.find(s => s.name === 'api')).toBeUndefined();

      // Check that service directory still exists
      expect(await fs.pathExists(path.join(projectPath, 'services/api'))).toBe(true);
    });

    it('should fail when service does not exist', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'service', 'nonexistent', '--yes'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        reject: false
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Service \'nonexistent\' not found');
    });

    it('should fail when not in a create-polyglot project', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'service', 'api', '--yes'], {
        cwd: tempDir, // Not the project directory
        stdio: ['pipe', 'pipe', 'pipe'],
        reject: false
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('polyglot.json not found');
    });

    it('should update compose.yaml when removing service', async () => {
      await execa('node', [CLI_PATH, 'remove', 'service', 'api', '--yes'], {
        cwd: projectPath
      });

      const composeContent = await fs.readFile(path.join(projectPath, 'compose.yaml'), 'utf-8');
      expect(composeContent).not.toContain('api:');
      expect(composeContent).toContain('web:');
      expect(composeContent).toContain('worker:');
    });
  });

  describe('remove plugin', () => {
    it('should remove a plugin with confirmation', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'plugin', 'test-plugin', '--yes'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Plugin \'test-plugin\' removed successfully');

      // Check that plugin was removed from config
      const config = await fs.readJSON(path.join(projectPath, 'polyglot.json'));
      expect(config.plugins['test-plugin']).toBeUndefined();

      // Check that plugin directory was removed
      expect(await fs.pathExists(path.join(projectPath, 'plugins/test-plugin'))).toBe(false);
    });

    it('should keep files when --keep-files option is used', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'plugin', 'test-plugin', '--yes', '--keep-files'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Plugin files kept');

      // Check that plugin was removed from config
      const config = await fs.readJSON(path.join(projectPath, 'polyglot.json'));
      expect(config.plugins['test-plugin']).toBeUndefined();

      // Check that plugin directory still exists
      expect(await fs.pathExists(path.join(projectPath, 'plugins/test-plugin'))).toBe(true);
    });

    it('should fail when plugin does not exist', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'plugin', 'nonexistent', '--yes'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        reject: false
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Plugin \'nonexistent\' not found');
    });

    it('should use plugin remove subcommand', async () => {
      const result = await execa('node', [CLI_PATH, 'plugin', 'remove', 'test-plugin', '--yes'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Plugin \'test-plugin\' removed successfully');
    });
  });

  describe('remove command validation', () => {
    it('should fail with unknown entity type', async () => {
      const result = await execa('node', [CLI_PATH, 'remove', 'unknown', 'test'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        reject: false
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown entity \'unknown\'. Use service or plugin.');
    });
  });

  // Cleanup
  afterEach(async () => {
    await fs.remove(tempDir);
  });
});