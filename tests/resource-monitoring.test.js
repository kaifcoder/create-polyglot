import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getResourceMonitor, ResourceMonitor } from '../bin/lib/resources.js';
import fs from 'fs';
import path from 'path';

describe('Resource Monitoring', () => {
  let resourceMonitor;
  const testWorkspace = path.join(process.cwd(), 'test-workspace', 'resource-test');
  
  beforeEach(async () => {
    // Create test workspace
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }
    
    // Create basic polyglot.json
    const polyglotConfig = {
      projectName: 'resource-test',
      services: [
        { name: 'test-service', type: 'node', port: 3001 }
      ]
    };
    
    fs.writeFileSync(
      path.join(testWorkspace, 'polyglot.json'),
      JSON.stringify(polyglotConfig, null, 2)
    );
    
    resourceMonitor = getResourceMonitor({
      collectInterval: 1000, // 1 second for faster testing
      maxHistorySize: 10
    });
  });
  
  afterEach(() => {
    if (resourceMonitor) {
      resourceMonitor.stopCollecting();
      resourceMonitor.clearMetricsHistory();
    }
    
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });
  
  it('should initialize resource monitor', async () => {
    expect(resourceMonitor).toBeDefined();
    
    const systemInfo = await resourceMonitor.initialize();
    expect(systemInfo).toBeDefined();
    expect(systemInfo.cpu).toBeDefined();
    expect(systemInfo.memory).toBeDefined();
    expect(systemInfo.cpu.cores).toBeGreaterThan(0);
    expect(systemInfo.memory.total).toBeGreaterThan(0);
  });
  
  it('should start and stop collecting metrics', () => {
    const services = [{ name: 'test-service', type: 'node', port: 3001, pid: process.pid }];
    
    expect(resourceMonitor.isCollecting).toBe(false);
    
    resourceMonitor.startCollecting(services);
    expect(resourceMonitor.isCollecting).toBe(true);
    
    resourceMonitor.stopCollecting();
    expect(resourceMonitor.isCollecting).toBe(false);
  });
  
  it('should collect metrics for a running process', async () => {
    const services = [{ name: 'test-service', type: 'node', port: 3001, pid: process.pid }];
    
    // Set up event listener to capture metrics
    let metricsReceived = false;
    let metricsData = null;
    
    resourceMonitor.on('metricsUpdate', (data) => {
      metricsReceived = true;
      metricsData = data;
    });
    
    await resourceMonitor.initialize();
    resourceMonitor.startCollecting(services);
    
    // Wait for metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    expect(metricsReceived).toBe(true);
    expect(metricsData).toBeDefined();
    expect(metricsData.services).toBeDefined();
    expect(metricsData.services.length).toBeGreaterThan(0);
    
    const serviceMetrics = metricsData.services[0];
    expect(serviceMetrics.serviceName).toBe('test-service');
    expect(serviceMetrics.status).toBe('running');
    expect(serviceMetrics.cpu).toBeDefined();
    expect(serviceMetrics.memory).toBeDefined();
    expect(serviceMetrics.cpu.usage).toBeGreaterThanOrEqual(0);
    expect(serviceMetrics.memory.usage).toBeGreaterThan(0);
  });
  
  it('should store and retrieve metrics history', async () => {
    const services = [{ name: 'test-service', type: 'node', port: 3001, pid: process.pid }];
    
    await resourceMonitor.initialize();
    
    // Manually store some test metrics
    const testMetrics = {
      serviceName: 'test-service',
      timestamp: new Date(),
      status: 'running',
      cpu: { usage: 25.5 },
      memory: { usage: 1024 * 1024, percentage: 10.0 },
      disk: { read: 100, write: 200 },
      network: { rx: 500, tx: 300 }
    };
    
    resourceMonitor.storeMetrics('test-service', testMetrics);
    
    const history = resourceMonitor.getMetricsHistory('test-service');
    expect(history).toBeDefined();
    expect(history.length).toBe(1);
    expect(history[0]).toEqual(testMetrics);
    
    const current = resourceMonitor.getCurrentMetrics('test-service');
    expect(current).toEqual(testMetrics);
  });
  
  it('should format bytes correctly', () => {
    expect(ResourceMonitor.formatBytes).toBeDefined();
    
    expect(ResourceMonitor.formatBytes(0)).toBe('0 Bytes');
    expect(ResourceMonitor.formatBytes(1024)).toBe('1 KB');
    expect(ResourceMonitor.formatBytes(1024 * 1024)).toBe('1 MB');
    expect(ResourceMonitor.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });
  
  it('should format percentage correctly', () => {
    expect(ResourceMonitor.formatPercentage).toBeDefined();
    
    expect(ResourceMonitor.formatPercentage(25.5)).toBe('25.5%');
    expect(ResourceMonitor.formatPercentage(100.0)).toBe('100.0%');
    expect(ResourceMonitor.formatPercentage(0.0)).toBe('0.0%');
  });
  
  it('should handle missing process ID gracefully', async () => {
    const services = [{ name: 'test-service', type: 'node', port: 3001 }]; // No PID
    
    await resourceMonitor.initialize();
    
    const mockSystemCpu = { currentload: 50 };
    const mockSystemMemory = { used: 1024 * 1024, total: 8 * 1024 * 1024 * 1024 };
    const mockNetworkStats = [];
    const timestamp = new Date();
    
    const metrics = await resourceMonitor.collectServiceMetrics(
      services[0],
      mockSystemCpu,
      mockSystemMemory,
      mockNetworkStats,
      timestamp
    );
    
    expect(metrics).toBeDefined();
    expect(metrics.status).toBe('stopped');
    expect(metrics.cpu.usage).toBe(0);
    expect(metrics.memory.usage).toBe(0);
  });
  
  it('should clear metrics history', async () => {
    await resourceMonitor.initialize();
    
    // Add some test data
    const testMetrics = {
      serviceName: 'test-service',
      timestamp: new Date(),
      cpu: { usage: 25.5 },
      memory: { usage: 1024 * 1024 }
    };
    
    resourceMonitor.storeMetrics('test-service', testMetrics);
    resourceMonitor.storeMetrics('other-service', testMetrics);
    
    expect(resourceMonitor.getMetricsHistory('test-service').length).toBe(1);
    expect(resourceMonitor.getMetricsHistory('other-service').length).toBe(1);
    
    // Clear specific service
    resourceMonitor.clearMetricsHistory('test-service');
    expect(resourceMonitor.getMetricsHistory('test-service').length).toBe(0);
    expect(resourceMonitor.getMetricsHistory('other-service').length).toBe(1);
    
    // Clear all
    resourceMonitor.clearMetricsHistory();
    expect(resourceMonitor.getMetricsHistory('other-service').length).toBe(0);
  });
}, 15000); // 15 second timeout for integration tests