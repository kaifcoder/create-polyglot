import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { escapeRegExp } from 'lodash-es';
import chokidar from 'chokidar';

// Log levels and their colors
const LOG_LEVELS = {
  error: { color: chalk.red, priority: 4 },
  warn: { color: chalk.yellow, priority: 3 },
  info: { color: chalk.blue, priority: 2 },
  debug: { color: chalk.gray, priority: 1 }
};

// Get logs directory for a service
function getLogsDir(serviceDir) {
  return path.join(serviceDir, '.logs');
}

// Get log file path for a service
function getLogFile(serviceDir, date = new Date()) {
  const logsDir = getLogsDir(serviceDir);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `${dateStr}.log`);
}

// Ensure logs directory exists
function ensureLogsDir(serviceDir) {
  const logsDir = getLogsDir(serviceDir);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

// Parse time filter (supports relative like "1h", "30m" or ISO timestamps)
function parseTimeFilter(timeStr) {
  if (!timeStr) return null;
  
  // Check if it's a relative time (e.g., "1h", "30m", "2d")
  const relativeMatch = timeStr.match(/^(\d+)([hmsd])$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const now = new Date();
    
    switch (unit) {
      case 's': return new Date(now.getTime() - value * 1000);
      case 'm': return new Date(now.getTime() - value * 60 * 1000);
      case 'h': return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'd': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    }
  }
  
  // Try to parse as ISO timestamp
  try {
    return new Date(timeStr);
  } catch (e) {
    throw new Error(`Invalid time format: ${timeStr}. Use ISO format or relative time like "1h", "30m", "2d"`);
  }
}

// Parse a log line and extract structured data
function parseLogLine(line) {
  if (!line.trim()) return null;
  
  // Try to parse structured JSON logs
  try {
    const parsed = JSON.parse(line);
    if (parsed.timestamp && parsed.level && parsed.message) {
      return {
        timestamp: new Date(parsed.timestamp),
        level: parsed.level.toLowerCase(),
        message: parsed.message,
        service: parsed.service || 'unknown',
        data: parsed.data || {},
        raw: line
      };
    }
  } catch (e) {
    // Not JSON, fall through to text parsing
  }
  
  // Try to parse common log formats
  const timestampRegex = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/;
  const levelRegex = /(ERROR|WARN|INFO|DEBUG|error|warn|info|debug)/i;
  
  const timestampMatch = line.match(timestampRegex);
  const levelMatch = line.match(levelRegex);
  
  return {
    timestamp: timestampMatch ? new Date(timestampMatch[1]) : new Date(),
    level: levelMatch ? levelMatch[1].toLowerCase() : 'info',
    message: line.trim(),
    service: 'unknown',
    data: {},
    raw: line
  };
}

// Read logs from file with filtering
async function readLogsFromFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  let logs = lines.map(parseLogLine).filter(Boolean);
  
  // Apply filters
  if (options.since) {
    const sinceDate = parseTimeFilter(options.since);
    logs = logs.filter(log => log.timestamp >= sinceDate);
  }
  
  if (options.level) {
    const targetLevel = options.level.toLowerCase();
    const targetPriority = LOG_LEVELS[targetLevel]?.priority || 0;
    logs = logs.filter(log => (LOG_LEVELS[log.level]?.priority || 0) >= targetPriority);
  }
  
  if (options.filter) {
    const safeFilter = escapeRegExp(options.filter);
    const regex = new RegExp(safeFilter, 'i');
    logs = logs.filter(log => regex.test(log.message) || regex.test(log.raw));
  }
  
  // Apply tail limit
  if (options.tail) {
    const tailCount = parseInt(options.tail);
    logs = logs.slice(-tailCount);
  }
  
  return logs;
}

// Get all log files for a service (across all dates)
function getServiceLogFiles(serviceDir) {
  const logsDir = getLogsDir(serviceDir);
  if (!fs.existsSync(logsDir)) {
    return [];
  }
  
  return fs.readdirSync(logsDir)
    .filter(file => file.endsWith('.log'))
    .map(file => path.join(logsDir, file))
    .sort();
}

// Read all logs for a service
async function readServiceLogs(serviceDir, options = {}) {
  const logFiles = getServiceLogFiles(serviceDir);
  let allLogs = [];
  
  for (const file of logFiles) {
    const logs = await readLogsFromFile(file, options);
    allLogs = allLogs.concat(logs);
  }
  
  // Sort by timestamp
  allLogs.sort((a, b) => a.timestamp - b.timestamp);
  
  // Apply tail limit after combining all files
  if (options.tail) {
    const tailCount = parseInt(options.tail);
    allLogs = allLogs.slice(-tailCount);
  }
  
  return allLogs;
}

// Format log entry for display
function formatLogEntry(log, options = {}) {
  const timestamp = log.timestamp.toISOString();
  const level = log.level.toUpperCase().padEnd(5);
  const levelColored = LOG_LEVELS[log.level]?.color(level) || level;
  
  if (options.json) {
    return JSON.stringify({
      timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      data: log.data
    });
  }
  
  return `${chalk.gray(timestamp)} ${levelColored} ${log.message}`;
}

// Export logs to different formats
async function exportLogs(logs, format, outputPath) {
  switch (format.toLowerCase()) {
    case 'json':
      const jsonData = logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        service: log.service,
        message: log.message,
        data: log.data
      }));
      fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
      break;
      
    case 'csv':
      const csvHeader = 'timestamp,level,service,message\n';
      const csvRows = logs.map(log => {
        const escapedMessage = `"${log.message.replace(/"/g, '""')}"`;
        return `${log.timestamp.toISOString()},${log.level},${log.service},${escapedMessage}`;
      }).join('\n');
      fs.writeFileSync(outputPath, csvHeader + csvRows);
      break;
      
    case 'txt':
    default:
      const txtData = logs.map(log => formatLogEntry(log)).join('\n');
      fs.writeFileSync(outputPath, txtData);
      break;
  }
}

// Clear logs for a service
async function clearServiceLogs(serviceDir) {
  const logsDir = getLogsDir(serviceDir);
  if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      fs.unlinkSync(path.join(logsDir, file));
    }
  }
}

// Watch log file for changes (for follow mode)
function watchLogFile(filePath, callback) {
  if (!fs.existsSync(filePath)) {
    // Create empty file if it doesn't exist
    fs.writeFileSync(filePath, '');
  }
  
  let lastSize = fs.statSync(filePath).size;
  
  const watcher = fs.watchFile(filePath, { interval: 500 }, (curr) => {
    if (curr.size > lastSize) {
      const stream = fs.createReadStream(filePath, { start: lastSize, end: curr.size });
      let buffer = '';
      
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        lines.forEach(line => {
          if (line.trim()) {
            const log = parseLogLine(line);
            if (log) callback(log);
          }
        });
      });
      
      lastSize = curr.size;
    }
  });
  
  return () => fs.unwatchFile(filePath);
}

// Main logs viewing function
export async function viewLogs(serviceName, options = {}) {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'polyglot.json');
  
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red('❌ polyglot.json not found. Run inside a generated workspace.'));
    process.exit(1);
  }
  
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  let targetServices = cfg.services;
  
  // Filter to specific service if requested
  if (serviceName) {
    targetServices = cfg.services.filter(s => s.name === serviceName);
    if (targetServices.length === 0) {
      console.error(chalk.red(`❌ Service '${serviceName}' not found.`));
      console.log(chalk.gray('Available services:'), cfg.services.map(s => s.name).join(', '));
      process.exit(1);
    }
  }
  
  // Handle clear operation
  if (options.clear) {
    console.log(chalk.yellow('🧹 Clearing logs...'));
    for (const service of targetServices) {
      const serviceDir = path.join(cwd, 'apps', service.name);
      await clearServiceLogs(serviceDir);
      console.log(chalk.green(`✅ Cleared logs for ${service.name}`));
    }
    return;
  }
  
  // Handle export operation
  if (options.export) {
    console.log(chalk.cyan('📦 Exporting logs...'));
    let allLogs = [];
    
    for (const service of targetServices) {
      const serviceDir = path.join(cwd, 'apps', service.name);
      const logs = await readServiceLogs(serviceDir, options);
      logs.forEach(log => log.service = service.name);
      allLogs = allLogs.concat(logs);
    }
    
    allLogs.sort((a, b) => a.timestamp - b.timestamp);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const serviceSuffix = serviceName ? `-${serviceName}` : '-all';
    const outputPath = path.join(cwd, `logs${serviceSuffix}-${timestamp}.${options.export}`);
    
    await exportLogs(allLogs, options.export, outputPath);
    console.log(chalk.green(`✅ Logs exported to ${outputPath}`));
    return;
  }
  
  // Handle follow mode
  if (options.follow) {
    console.log(chalk.cyan('📡 Following logs (Ctrl+C to stop)...'));
    console.log(chalk.gray(`Watching ${targetServices.length} service(s): ${targetServices.map(s => s.name).join(', ')}\n`));
    
    const unwatchers = [];
    
    for (const service of targetServices) {
      const serviceDir = path.join(cwd, 'apps', service.name);
      ensureLogsDir(serviceDir);
      const logFile = getLogFile(serviceDir);
      
      const unwatcher = watchLogFile(logFile, (log) => {
        log.service = service.name;
        
        // Apply filters
        if (options.level) {
          const targetLevel = options.level.toLowerCase();
          const targetPriority = LOG_LEVELS[targetLevel]?.priority || 0;
          if ((LOG_LEVELS[log.level]?.priority || 0) < targetPriority) return;
        }
        
        if (options.filter) {
          const regex = new RegExp(options.filter, 'i');
          if (!regex.test(log.message) && !regex.test(log.raw)) return;
        }
        
        console.log(`${chalk.magenta(service.name.padEnd(12))} ${formatLogEntry(log)}`);
      });
      
      unwatchers.push(unwatcher);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Stopping log following...'));
      unwatchers.forEach(unwatcher => unwatcher());
      process.exit(0);
    });
    
    // Keep process alive
    return new Promise(() => {});
  }
  
  // Default: show recent logs
  console.log(chalk.cyan('📋 Recent logs'));
  console.log(chalk.gray(`Services: ${targetServices.map(s => s.name).join(', ')}`));
  if (options.since) console.log(chalk.gray(`Since: ${options.since}`));
  if (options.level) console.log(chalk.gray(`Level: ${options.level}+`));
  if (options.filter) console.log(chalk.gray(`Filter: ${options.filter}`));
  console.log(chalk.gray(`Tail: ${options.tail} lines\n`));
  
  let allLogs = [];
  
  for (const service of targetServices) {
    const serviceDir = path.join(cwd, 'apps', service.name);
    const logs = await readServiceLogs(serviceDir, options);
    logs.forEach(log => log.service = service.name);
    allLogs = allLogs.concat(logs);
  }
  
  allLogs.sort((a, b) => a.timestamp - b.timestamp);
  
  if (allLogs.length === 0) {
    console.log(chalk.yellow('📭 No logs found matching the criteria.'));
    console.log(chalk.gray('   Try running services first or adjusting filters.'));
    return;
  }
  
  allLogs.forEach(log => {
    console.log(`${chalk.magenta(log.service.padEnd(12))} ${formatLogEntry(log)}`);
  });
  
  console.log(chalk.gray(`\n📊 Showing ${allLogs.length} log entries`));
}

// Log appender function for services to use
export function appendLog(serviceDir, level, message, data = {}) {
  try {
    ensureLogsDir(serviceDir);
    const logFile = getLogFile(serviceDir);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toLowerCase(),
      message,
      data
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFile, logLine);
    
    // Check if log rotation is needed
    rotateLogsIfNeeded(serviceDir);
  } catch (e) {
    // Fail silently to avoid breaking services
    console.error('Failed to write log:', e.message);
  }
}

// Log rotation to prevent files from growing too large
function rotateLogsIfNeeded(serviceDir) {
  try {
    const logFile = getLogFile(serviceDir);
    
    if (!fs.existsSync(logFile)) return;
    
    const stats = fs.statSync(logFile);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > maxSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFile = logFile.replace('.log', `-${timestamp}.log`);
      
      // Move current log to archive
      fs.renameSync(logFile, archiveFile);
      
      // Clean up old archives (keep only last 10)
      cleanupOldLogs(serviceDir);
    }
  } catch (e) {
    console.error('Failed to rotate logs:', e.message);
  }
}

// Clean up old log files
function cleanupOldLogs(serviceDir) {
  try {
    const logsDir = getLogsDir(serviceDir);
    if (!fs.existsSync(logsDir)) return;
    
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        mtime: fs.statSync(path.join(logsDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
    
    // Keep only the most recent 10 log files
    const filesToDelete = files.slice(10);
    
    filesToDelete.forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error(`Failed to delete old log file ${file.name}:`, e.message);
      }
    });
  } catch (e) {
    console.error('Failed to cleanup old logs:', e.message);
  }
}

// Initialize logs directory for a service
export function initializeServiceLogs(serviceDir) {
  ensureLogsDir(serviceDir);
  
  // Create a simple logging helper file for the service
  const loggerHelperPath = path.join(serviceDir, '.logs', 'logger.js');
  const loggerHelper = `// Auto-generated logger helper for polyglot services
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_LEVELS = {
  error: 4,
  warn: 3,
  info: 2,
  debug: 1
};

export class Logger {
  constructor(serviceName = 'unknown') {
    this.serviceName = serviceName;
    this.logsDir = __dirname;
  }
  
  log(level, message, data = {}) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toLowerCase(),
        service: this.serviceName,
        message: String(message),
        data
      };
      
      const dateStr = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logsDir, \`\${dateStr}.log\`);
      const logLine = JSON.stringify(logEntry) + '\\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (e) {
      console.error('Failed to write log:', e.message);
    }
  }
  
  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  info(message, data) { this.log('info', message, data); }
  debug(message, data) { this.log('debug', message, data); }
}
`;
  
  if (!fs.existsSync(loggerHelperPath)) {
    fs.writeFileSync(loggerHelperPath, loggerHelper);
  }
}

// Get logs for API endpoints (used by admin dashboard)
export async function getLogsForAPI(serviceName = null, options = {}) {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'polyglot.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('polyglot.json not found');
  }
  
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  let targetServices = cfg.services;
  
  if (serviceName) {
    targetServices = cfg.services.filter(s => s.name === serviceName);
  }
  
  let allLogs = [];
  
  for (const service of targetServices) {
    // Check both services/ (new) and apps/ (legacy) directories
    let serviceDir = path.join(cwd, 'services', service.name);
    if (!fs.existsSync(serviceDir)) {
      serviceDir = path.join(cwd, 'apps', service.name);
    }
    
    if (fs.existsSync(serviceDir)) {
      const logs = await readServiceLogs(serviceDir, options);
      logs.forEach(log => log.service = service.name);
      allLogs = allLogs.concat(logs);
    }
  }
  
  allLogs.sort((a, b) => a.timestamp - b.timestamp);
  
  return allLogs.map(log => ({
    timestamp: log.timestamp.toISOString(),
    level: log.level,
    service: log.service,
    message: log.message,
    data: log.data
  }));
}

// Chokidar-based log file watcher for real-time monitoring
export class LogFileWatcher {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.watcher = null;
    this.listeners = new Set();
    this.serviceLogsCache = new Map(); // Cache for current logs per service
    this.isWatching = false;
  }

  // Start watching log files
  async startWatching() {
    if (this.isWatching) return;
    
    const configPath = path.join(this.workspacePath, 'polyglot.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('polyglot.json not found in workspace');
    }

    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const watchPaths = [];

    // Determine watch paths for all services
    for (const service of cfg.services) {
      // Determine service directory (supports legacy apps/)
      let serviceDir = path.join(this.workspacePath, 'services', service.name);
      if (!fs.existsSync(serviceDir)) {
        serviceDir = path.join(this.workspacePath, 'apps', service.name);
      }
      if (fs.existsSync(serviceDir)) {
        // Ensure .logs directory exists so watcher can subscribe immediately
        const logsDir = ensureLogsDir(serviceDir);
        // Watch the directory itself, not glob pattern - more reliable
        const watchPath = logsDir.replace(/\\/g, '/');
        watchPaths.push(watchPath);
      }
    }

    if (watchPaths.length === 0) {
      console.warn('No log directories found to watch');
      return;
    }

    console.log(chalk.cyan('[LogWatcher] Watch paths:'), watchPaths);

    // Initialize cache with current logs
    await this.loadInitialLogs(cfg.services);

    // Start chokidar watcher - watch directories, filter for .log files in handlers
    this.watcher = chokidar.watch(watchPaths, {
      ignored: ['**/node_modules/**', '**/.git/**', '**/.DS_Store'],
      persistent: true,
      ignoreInitial: false,
      usePolling: true, // Enable polling for more reliable file watching on Windows
      interval: 1000,   // Poll every second
      depth: 0          // Only watch files in the immediate directory, not subdirectories
    });

    this.watcher
      .on('add', (filePath) => {
        if (!filePath.endsWith('.log')) return; // Only process .log files
        this.handleFileChange('add', filePath);
      })
      .on('change', (filePath) => {
        if (!filePath.endsWith('.log')) return; // Only process .log files
        this.handleFileChange('change', filePath);
      })
      .on('unlink', (filePath) => {
        if (!filePath.endsWith('.log')) return; // Only process .log files
        this.handleFileChange('unlink', filePath);
      })
      .on('error', (error) => console.error(chalk.red('Log watcher error:'), error));

    this.isWatching = true;
    console.log(chalk.green('📁 Started watching log files with chokidar'));
  }

  // Stop watching log files
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    this.listeners.clear();
    this.serviceLogsCache.clear();
    console.log(chalk.yellow('📁 Stopped watching log files'));
  }

  // Load initial logs for all services
  async loadInitialLogs(services) {
    for (const service of services) {
      // Check both services/ (new) and apps/ (legacy) directories
      let serviceDir = path.join(this.workspacePath, 'services', service.name);
      if (!fs.existsSync(serviceDir)) {
        serviceDir = path.join(this.workspacePath, 'apps', service.name);
      }
      
      if (fs.existsSync(serviceDir)) {
        try {
          const logs = await readServiceLogs(serviceDir, { tail: 100 });
          logs.forEach(log => log.service = service.name);
          this.serviceLogsCache.set(service.name, logs);
        } catch (error) {
          console.error(`Failed to load initial logs for ${service.name}:`, error);
        }
      }
    }
  }

  // Handle file changes
  async handleFileChange(event, filePath) {
    try {
      const serviceName = this.getServiceNameFromLogPath(filePath);
      if (!serviceName) {
        return;
      }

      if (event === 'unlink') {
        // File deleted - clear cache for this service
        this.serviceLogsCache.delete(serviceName);
        this.notifyListeners('logsCleared', { service: serviceName });
        return;
      }

      // Read new logs and update cache
      const logs = await this.readLogsFromPath(filePath, serviceName);
      const existingLogs = this.serviceLogsCache.get(serviceName) || [];
      
      if (event === 'add') {
        // New log file - replace existing logs
        this.serviceLogsCache.set(serviceName, logs);
        this.notifyListeners('logsUpdated', { 
          service: serviceName, 
          logs, 
          event: 'add' 
        });
      } else if (event === 'change') {
        // File changed - find new logs since last read
        const newLogs = this.findNewLogs(existingLogs, logs);
        if (newLogs.length > 0) {
          const updatedLogs = [...existingLogs, ...newLogs].slice(-1000); // Keep latest 1000 logs
          this.serviceLogsCache.set(serviceName, updatedLogs);
          this.notifyListeners('logsUpdated', { 
            service: serviceName, 
            logs: newLogs, 
            event: 'change',
            allLogs: updatedLogs
          });
        }
      }
    } catch (error) {
      console.error('Error handling log file change:', error);
    }
  }

  // Extract service name from log file path
  getServiceNameFromLogPath(filePath) {
    const parts = filePath.split(path.sep);
    const logsIndex = parts.findIndex(part => part === '.logs');
    if (logsIndex > 0) {
      return parts[logsIndex - 1];
    }
    return null;
  }

  // Read logs from specific file path
  async readLogsFromPath(filePath, serviceName) {
    try {
      const logs = await readLogsFromFile(filePath);
      return logs.map(log => ({ ...log, service: serviceName }));
    } catch (error) {
      console.error(`Failed to read logs from ${filePath}:`, error);
      return [];
    }
  }

  // Find new logs that weren't in the previous set
  findNewLogs(existingLogs, newLogs) {
    if (existingLogs.length === 0) return newLogs;
    
    const lastExistingTimestamp = existingLogs[existingLogs.length - 1]?.timestamp;
    if (!lastExistingTimestamp) return newLogs;
    
    return newLogs.filter(log => log.timestamp > lastExistingTimestamp);
  }

  // Get current logs for a service (or all services)
  getCurrentLogs(serviceName = null, options = {}) {
    if (serviceName) {
      const logs = this.serviceLogsCache.get(serviceName) || [];
      return this.applyFilters(logs, options);
    }
    
    // Return logs from all services
    let allLogs = [];
    for (const [service, logs] of this.serviceLogsCache) {
      allLogs = allLogs.concat(logs);
    }
    
    // Sort by timestamp
    allLogs.sort((a, b) => a.timestamp - b.timestamp);
    
    return this.applyFilters(allLogs, options);
  }

  // Apply filters to logs
  applyFilters(logs, options = {}) {
    let filteredLogs = [...logs];
    
    // Apply level filter
    if (options.level) {
      const targetLevel = options.level.toLowerCase();
      const targetPriority = LOG_LEVELS[targetLevel]?.priority || 0;
      filteredLogs = filteredLogs.filter(log => 
        (LOG_LEVELS[log.level]?.priority || 0) >= targetPriority
      );
    }
    
    // Apply text filter
    if (options.filter) {
      const safeFilter = escapeRegExp(options.filter);
      const regex = new RegExp(safeFilter, 'i');
      filteredLogs = filteredLogs.filter(log => 
        regex.test(log.message) || regex.test(log.raw || '')
      );
    }
    
    // Apply since filter
    if (options.since) {
      const sinceDate = parseTimeFilter(options.since);
      if (sinceDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= sinceDate);
      }
    }
    
    // Apply tail limit
    if (options.tail) {
      const tailCount = parseInt(options.tail);
      filteredLogs = filteredLogs.slice(-tailCount);
    }
    
    return filteredLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      service: log.service,
      message: log.message,
      data: log.data
    }));
  }

  // Add listener for log updates
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners of log updates
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error notifying log listener:', error);
      }
    });
  }
}