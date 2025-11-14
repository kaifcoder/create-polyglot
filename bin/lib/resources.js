import pidusage from 'pidusage';
import si from 'systeminformation';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Resource monitoring class for collecting system metrics per service
 */
export class ResourceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.collectInterval = options.collectInterval || 5000; // 5 seconds default
    this.maxHistorySize = options.maxHistorySize || 720; // 1 hour at 5s intervals
    this.isCollecting = false;
    this.intervalId = null;
    this.currentServices = []; // Store current services being monitored
    
    // In-memory storage for metrics history
    this.metricsHistory = new Map(); // service name -> array of metrics
    
    // Cache for system-wide info
    this.systemInfo = {
      cpu: { cores: 0, model: '' },
      memory: { total: 0 },
      disk: { total: 0, available: 0 },
      network: { interfaces: [] }
    };
    
    this.lastNetworkStats = new Map();
  }
  
  /**
   * Initialize the resource monitor
   */
  async initialize() {
    console.log('🔧 ResourceMonitor.initialize() called');
    try {
      console.log('🔧 Getting system information...');
      // Get basic system information
      const [cpu, memory, disk, networkInterfaces] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.networkInterfaces()
      ]);
      
      console.log('🔧 System info collected:', {
        cores: cpu.cores,
        memory: `${(memory.total / 1024 / 1024 / 1024).toFixed(1)}GB`
      });
      
      this.systemInfo = {
        cpu: { cores: cpu.cores, model: cpu.model },
        memory: { total: memory.total },
        disk: { 
          total: disk.reduce((acc, d) => acc + d.size, 0),
          available: disk.reduce((acc, d) => acc + d.available, 0)
        },
        network: { 
          interfaces: networkInterfaces.filter(iface => 
            !iface.internal && iface.operstate === 'up'
          ).map(iface => ({ name: iface.iface, type: iface.type }))
        }
      };
      
      console.log('🔍 Resource monitor initialized');
      return this.systemInfo;
    } catch (error) {
      console.warn('⚠️  Failed to initialize resource monitor:', error.message);
      throw error;
    }
  }
  
  /**
   * Find PIDs for services by process name and port
   */
  async findServicePids(services) {
    const servicesWithPids = [];
    
    for (const service of services) {
      let pid = service.pid;
      
      // If no PID provided, try to find it by process name and port
      if (!pid) {
        try {
          // Try to find Node.js processes on the service port
          if (service.type === 'node' || service.type === 'frontend') {
            const { stdout } = await execAsync(`lsof -t -i:${service.port} 2>/dev/null || echo ""`);
            const pids = stdout.trim().split('\n').filter(p => p && p !== '');
            if (pids.length > 0) {
              pid = parseInt(pids[0]); // Take the first PID
            }
          }
        } catch (error) {
          // Ignore errors, pid will remain null
        }
      }
      
      servicesWithPids.push({ ...service, pid });
    }
    
    return servicesWithPids;
  }

  /**
   * Start collecting metrics for services
   */
  async startCollecting(services = []) {
    if (this.isCollecting) {
      console.log('Resource monitoring already running');
      return;
    }
    
    this.isCollecting = true;
    console.log(`📊 Starting resource monitoring for ${services.length} services`);
    
    // Find actual PIDs for services
    this.currentServices = await this.findServicePids(services);
    
    // Collect metrics immediately, then on interval
    this.collectMetrics(this.currentServices);
    this.intervalId = setInterval(async () => {
      // Re-detect PIDs on each collection in case services restart
      this.currentServices = await this.findServicePids(this.currentServices);
      this.collectMetrics(this.currentServices);
    }, this.collectInterval);
  }
  
  /**
   * Update the services being monitored (e.g., when PIDs change)
   */
  async updateServices(services = []) {
    this.currentServices = await this.findServicePids(services); // Find PIDs for updated services
  }
  
  /**
   * Stop collecting metrics
   */
  stopCollecting() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isCollecting = false;
    this.currentServices = [];
    console.log('📊 Resource monitoring stopped');
  }
  
  /**
   * Collect metrics for all services
   */
  async collectMetrics(services) {
    const timestamp = new Date();
    const metricsCollection = [];
    
    console.log(`📊 Starting metrics collection for ${services.length} services at ${timestamp}`);
    
    try {
      // Get system-wide metrics
      const [systemCpu, systemMemory, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkStats()
      ]);
      
      console.log('📊 System metrics collected:', {
        cpu: systemCpu.currentload,
        memory: `${(systemMemory.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(systemMemory.total / 1024 / 1024 / 1024).toFixed(1)}GB`,
        networkInterfaces: networkStats?.length || 0
      });
      
      // Process each service
      for (const service of services) {
        try {
          const serviceMetrics = await this.collectServiceMetrics(
            service, 
            systemCpu, 
            systemMemory, 
            networkStats,
            timestamp
          );
          
          if (serviceMetrics) {
            metricsCollection.push(serviceMetrics);
            this.storeMetrics(service.name, serviceMetrics);
            console.log(`📊 Stored metrics for ${service.name} in history`);
          }
        } catch (error) {
          // Don't fail entire collection if one service fails
          console.debug(`❌ Failed to collect metrics for ${service.name}:`, error.message);
        }
      }
      
      // Emit metrics update event
      if (metricsCollection.length > 0) {
        console.log(`📊 Emitting metrics update with ${metricsCollection.length} services`);
        this.emit('metricsUpdate', {
          timestamp,
          services: metricsCollection,
          system: {
            cpu: systemCpu.currentload,
            memory: {
              used: systemMemory.used,
              total: systemMemory.total,
              percentage: (systemMemory.used / systemMemory.total) * 100
            }
          }
        });
      } else {
        console.log('⚠️ No metrics collected - empty metricsCollection');
      }
      
    } catch (error) {
      console.error('❌ Error collecting system metrics:', error.message);
    }
  }
  
  /**
   * Collect metrics for a specific service
   */
  async collectServiceMetrics(service, systemCpu, systemMemory, networkStats, timestamp) {
    const { name, type, port, pid } = service;
    
    console.log(`🔍 Collecting metrics for ${name}: pid=${pid}, type=${type}`);
    
    if (!pid) {
      console.log(`⚠️ No PID for service ${name}, returning stopped status`);
      return {
        serviceName: name,
        type,
        port,
        timestamp,
        status: 'stopped',
        cpu: { usage: 0 },
        memory: { usage: 0, percentage: 0 },
        network: { rx: 0, tx: 0 }
      };
    }

    try {
      // Get process-specific metrics using pidusage
      console.log(`📊 Getting pidusage for PID ${pid}`);
      const processStats = await pidusage(pid);
      console.log(`📊 Process stats for ${name}:`, { cpu: processStats.cpu, memory: processStats.memory });
      
      // Calculate network metrics for the service (approximation)
      const networkMetrics = this.calculateNetworkMetrics(service, networkStats);
      
      const result = {
        serviceName: name,
        type,
        port,
        pid,
        timestamp,
        status: 'running',
        cpu: {
          usage: processStats.cpu, // CPU percentage
          time: processStats.ctime // CPU time in ms
        },
        memory: {
          usage: processStats.memory, // Memory in bytes
          percentage: (processStats.memory / systemMemory.total) * 100
        },
        network: networkMetrics,
        uptime: Date.now() - processStats.elapsed // Process uptime in ms
      };
      
      console.log(`✅ Collected metrics for ${name}:`, {
        cpu: result.cpu.usage,
        memory: result.memory.percentage,
        status: result.status,
        network: result.network
      });
      
      return result;    } catch (error) {
      // Process might have stopped
      return {
        serviceName: name,
        type,
        port,
        timestamp,
        status: 'error',
        error: error.message,
        cpu: { usage: 0 },
        memory: { usage: 0, percentage: 0 },
        network: { rx: 0, tx: 0 }
      };
    }
  }
  
  /**
   * Calculate network metrics (approximation based on port usage)
   */
  calculateNetworkMetrics(service, networkStats) {
    const { port } = service;
    
    console.log(`🌐 Calculating network metrics for ${service.name}, interfaces: ${networkStats?.length || 0}`);
    
    // This is an approximation - in a real implementation, you might want to
    // use more sophisticated methods to track per-process network usage
    let totalRx = 0;
    let totalTx = 0;
    
    if (networkStats && networkStats.length > 0) {
      // Sum up network stats from all active interfaces
      networkStats.forEach(stat => {
        totalRx += stat.rx_bytes || 0;
        totalTx += stat.tx_bytes || 0;
      });
      console.log(`🌐 Total network bytes: RX=${totalRx}, TX=${totalTx}`);
    }
    
    const key = `${service.name}_${port}`;
    const lastStats = this.lastNetworkStats.get(key);
    
    let rxRate = 0;
    let txRate = 0;
    
    if (lastStats) {
      const timeDiff = (Date.now() - lastStats.timestamp) / 1000; // seconds
      rxRate = Math.max(0, (totalRx - lastStats.rx) / timeDiff);
      txRate = Math.max(0, (totalTx - lastStats.tx) / timeDiff);
    }
    
    this.lastNetworkStats.set(key, {
      rx: totalRx,
      tx: totalTx,
      timestamp: Date.now()
    });
    
    const result = {
      rx: rxRate, // bytes per second received
      tx: txRate  // bytes per second transmitted
    };
    
    console.log(`🌐 Network rates for ${service.name}: RX=${rxRate.toFixed(2)} B/s, TX=${txRate.toFixed(2)} B/s`);
    
    return result;
  }
  
  /**
   * Store metrics in history with size limit
   */
  storeMetrics(serviceName, metrics) {
    if (!this.metricsHistory.has(serviceName)) {
      this.metricsHistory.set(serviceName, []);
    }
    
    const history = this.metricsHistory.get(serviceName);
    history.push(metrics);
    
    // Keep only the last N metrics
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }
  
  /**
   * Get historical metrics for a service
   */
  getMetricsHistory(serviceName, options = {}) {
    const { since, limit } = options;
    let history = this.metricsHistory.get(serviceName) || [];
    
    if (since) {
      const sinceTime = new Date(since);
      history = history.filter(metric => new Date(metric.timestamp) >= sinceTime);
    }
    
    if (limit) {
      history = history.slice(-limit);
    }
    
    return history;
  }
  
    /**
   * Get current metrics for all services or a specific service
   */
  getCurrentMetrics(serviceName = null) {
    console.log('📊 getCurrentMetrics called');
    console.log('📊 metricsHistory size:', this.metricsHistory.size);
    
    if (serviceName) {
      // Return metrics for a specific service
      const history = this.metricsHistory.get(serviceName);
      const latest = history ? history[history.length - 1] : null;
      console.log(`📊 Service ${serviceName}: ${history ? history.length : 0} entries, latest:`, latest ? latest.status : 'none');
      return latest;
    }
    
    // Return metrics for all services
    const result = {};
    for (const [serviceName, history] of this.metricsHistory.entries()) {
      const latest = history[history.length - 1];
      if (latest) {
        result[serviceName] = latest;
      }
      console.log(`📊 Service ${serviceName}: ${history.length} entries, latest:`, latest ? latest.status : 'none');
    }
    
    console.log('📊 Returning metrics for services:', Object.keys(result));
    return result;
  }
  
  /**
   * Clear metrics history for a service or all services
   */
  clearMetricsHistory(serviceName = null) {
    if (serviceName) {
      this.metricsHistory.delete(serviceName);
    } else {
      this.metricsHistory.clear();
    }
  }
  
  /**
   * Get system information
   */
  getSystemInfo() {
    return this.systemInfo;
  }
  
  /**
   * Format bytes for human reading
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * Format percentage for display
   */
  static formatPercentage(value, decimals = 1) {
    return `${value.toFixed(decimals)}%`;
  }
}

// Export singleton instance
let resourceMonitor = null;

export function getResourceMonitor(options = {}) {
  if (!resourceMonitor) {
    resourceMonitor = new ResourceMonitor(options);
  }
  return resourceMonitor;
}