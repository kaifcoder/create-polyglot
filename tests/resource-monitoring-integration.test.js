import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import http from 'http';

describe('Resource Monitoring Integration', () => {
  const testWorkspace = path.join(process.cwd(), 'test-workspace', 'integration-test');
  let adminProcess = null;

  beforeEach(async () => {
    // Clean up previous test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    
    // Create test workspace
    fs.mkdirSync(testWorkspace, { recursive: true });
    
    // Create a simple polyglot project
    const polyglotConfig = {
      name: 'integration-test',
      services: [
        { name: 'test-node', type: 'node', port: 4001, path: 'services/test-node' }
      ]
    };
    
    fs.writeFileSync(
      path.join(testWorkspace, 'polyglot.json'),
      JSON.stringify(polyglotConfig, null, 2)
    );

    // Create service directory structure
    const serviceDir = path.join(testWorkspace, 'services', 'test-node');
    fs.mkdirSync(serviceDir, { recursive: true });
    
    // Create basic package.json for the service
    const packageJson = {
      name: 'test-node',
      version: '1.0.0',
      scripts: {
        dev: 'node index.js',
        start: 'node index.js'
      },
      dependencies: {}
    };
    
    fs.writeFileSync(
      path.join(serviceDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create basic service file
    const serviceCode = `
const http = require('http');
const port = process.env.PORT || 4001;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Test Node Service Running');
  }
});

server.listen(port, () => {
  console.log(\`Test service running on port \${port}\`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
`;
    
    fs.writeFileSync(path.join(serviceDir, 'index.js'), serviceCode);
  });

  afterEach(async () => {
    // Stop admin dashboard if running
    if (adminProcess && !adminProcess.killed) {
      adminProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  it('should start admin dashboard with resource monitoring enabled', async () => {
    // Start admin dashboard
    adminProcess = execa('node', [
      path.join(process.cwd(), 'bin', 'index.js'),
      'admin',
      '--port', '9999'
    ], {
      cwd: testWorkspace,
      stdio: 'pipe'
    });

    // Wait for dashboard to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    expect(adminProcess.killed).toBe(false);
    
    // Test if dashboard is responding
    const response = await makeRequest('GET', 'http://localhost:9999/', {}, 5000);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Polyglot Admin Dashboard');
    
    // Test if resource monitoring UI is included
    expect(response.body).toContain('Resource Monitoring');
    expect(response.body).toContain('CPU Usage');
    expect(response.body).toContain('Memory Usage');
    expect(response.body).toContain('Network I/O');
    // Disk I/O removed - only 3 tiles now
  }, 15000);

  it('should provide metrics API endpoint', async () => {
    // Start admin dashboard
    adminProcess = execa('node', [
      path.join(process.cwd(), 'bin', 'index.js'),
      'admin',
      '--port', '9998'
    ], {
      cwd: testWorkspace,
      stdio: 'pipe'
    });

    // Wait for dashboard to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test metrics API endpoint
    const response = await makeRequest('GET', 'http://localhost:9998/api/metrics');
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('systemInfo');
    
    if (data.systemInfo) {
      expect(data.systemInfo).toHaveProperty('cpu');
      expect(data.systemInfo).toHaveProperty('memory');
    }
  }, 15000);

  it('should provide service status API with resource monitoring integration', async () => {
    // Start admin dashboard
    adminProcess = execa('node', [
      path.join(process.cwd(), 'bin', 'index.js'),
      'admin',
      '--port', '9997'
    ], {
      cwd: testWorkspace,
      stdio: 'pipe'
    });

    // Wait for dashboard to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test service status API
    const response = await makeRequest('GET', 'http://localhost:9997/api/status');
    expect(response.statusCode).toBe(200);
    
    const services = JSON.parse(response.body);
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(0);
    
    const service = services[0];
    expect(service).toHaveProperty('name');
    expect(service).toHaveProperty('type');
    expect(service).toHaveProperty('port');
    expect(service).toHaveProperty('status');
  }, 15000);

  it('should handle graceful shutdown without errors', async () => {
    // Start admin dashboard
    adminProcess = execa('node', [
      path.join(process.cwd(), 'bin', 'index.js'),
      'admin',
      '--port', '9996'
    ], {
      cwd: testWorkspace,
      stdio: 'pipe'
    });

    // Wait for dashboard to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Send SIGTERM to gracefully shut down
    adminProcess.kill('SIGTERM');
    
    // Wait for process to exit
    const { exitCode } = await adminProcess;
    
    // Should exit cleanly
    expect(exitCode).toBe(0);
  }, 15000);

  it('should include Chart.js library for metrics visualization', async () => {
    // Start admin dashboard
    adminProcess = execa('node', [
      path.join(process.cwd(), 'bin', 'index.js'),
      'admin',
      '--port', '9995'
    ], {
      cwd: testWorkspace,
      stdio: 'pipe'
    });

    // Wait for dashboard to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test if Chart.js is included in the HTML
    const response = await makeRequest('GET', 'http://localhost:9995/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('chart.js');
    // Test that dashboard contains expected chart elements (3-tile layout)
    expect(response.body).toContain('canvas id="cpu-chart"');
    expect(response.body).toContain('canvas id="memory-chart"');
    expect(response.body).toContain('canvas id="network-chart"');
    // Disk chart removed - only 3 tiles now
  }, 15000);
});

// Helper function to make HTTP requests with timeout
function makeRequest(method, url, data = null, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      timeout: timeout,
      headers: {
        'User-Agent': 'test-client',
      }
    };

    if (data && method !== 'GET') {
      const postData = typeof data === 'string' ? data : JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    if (data && method !== 'GET') {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}