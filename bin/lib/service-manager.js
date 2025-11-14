import { spawn, exec } from 'node:child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

// Store running service processes
const runningProcesses = new Map();

// Get the correct package manager command for a service
function getPackageManagerCommand(serviceDir) {
  // Check for different package manager lock files
  if (fs.existsSync(path.join(serviceDir, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(serviceDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(serviceDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(serviceDir, 'bun.lockb'))) return 'bun';
  return 'npm'; // default
}

// Get the start command for different service types
function getStartCommand(service, serviceDir) {
  const { type, name } = service;
  
  switch (type) {
    case 'node':
    case 'frontend':
      const pm = getPackageManagerCommand(serviceDir);
      return {
        command: pm,
        args: ['run', 'dev'],
        shell: process.platform === 'win32'
      };
      
    case 'python':
      // Check if requirements.txt exists and install if needed
      return {
        command: 'python',
        args: ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', service.port.toString()],
        shell: process.platform === 'win32'
      };
      
    case 'go':
      return {
        command: 'go',
        args: ['run', 'main.go'],
        shell: process.platform === 'win32',
        env: { ...process.env, PORT: service.port.toString() }
      };
      
    case 'java':
      return {
        command: './mvnw',
        args: ['spring-boot:run'],
        shell: process.platform === 'win32',
        fallback: {
          command: 'mvn',
          args: ['spring-boot:run']
        }
      };
      
    default:
      throw new Error(`Unsupported service type: ${type}`);
  }
}

// Start a service
export async function startService(service, options = {}) {
  const { name, type, port } = service;
  
  if (runningProcesses.has(name)) {
    throw new Error(`Service ${name} is already running`);
  }
  
  // Check for both new 'services' and legacy 'apps' directory structures
  let serviceDir = path.join(process.cwd(), 'services', name);
  if (!fs.existsSync(serviceDir)) {
    serviceDir = path.join(process.cwd(), 'apps', name);
  }
  
  if (!fs.existsSync(serviceDir)) {
    throw new Error(`Service directory not found: ${serviceDir}`);
  }
  
  try {
    const startConfig = getStartCommand(service, serviceDir);
    let child;
    
    // Try primary command
    try {
      child = spawn(startConfig.command, startConfig.args, {
        cwd: serviceDir,
        stdio: options.stdio || 'pipe',
        shell: startConfig.shell,
        env: startConfig.env || process.env
      });
    } catch (e) {
      // Try fallback if available
      if (startConfig.fallback) {
        child = spawn(startConfig.fallback.command, startConfig.fallback.args, {
          cwd: serviceDir,
          stdio: options.stdio || 'pipe',
          shell: startConfig.shell,
          env: startConfig.env || process.env
        });
      } else {
        throw e;
      }
    }
    
    // Store process reference
    runningProcesses.set(name, {
      process: child,
      service,
      startTime: new Date(),
      status: 'starting'
    });
    
    // Handle process events
    child.on('spawn', () => {
      const processInfo = runningProcesses.get(name);
      if (processInfo) {
        processInfo.status = 'running';
        console.log(chalk.green(`✅ Service ${name} started successfully`));
      }
    });
    
    child.on('error', (error) => {
      console.error(chalk.red(`❌ Service ${name} failed to start:`, error.message));
      runningProcesses.delete(name);
    });
    
    child.on('exit', (code, signal) => {
      console.log(chalk.yellow(`⚠️  Service ${name} exited with code ${code}, signal ${signal}`));
      runningProcesses.delete(name);
    });
    
    // Capture output for logging (if not inherited)
    if (options.stdio !== 'inherit') {
      child.stdout?.on('data', (data) => {
        // Could log to service logs here
        if (options.verbose) {
          console.log(chalk.blue(`[${name}]`), data.toString().trim());
        }
      });
      
      child.stderr?.on('data', (data) => {
        if (options.verbose) {
          console.error(chalk.red(`[${name}]`), data.toString().trim());
        }
      });
    }
    
    return {
      success: true,
      message: `Service ${name} is starting`,
      pid: child.pid
    };
    
  } catch (error) {
    throw new Error(`Failed to start service ${name}: ${error.message}`);
  }
}

// Stop a service
export async function stopService(serviceName) {
  const processInfo = runningProcesses.get(serviceName);
  
  if (!processInfo) {
    throw new Error(`Service ${serviceName} is not running`);
  }
  
  const { process: child } = processInfo;
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      // Force kill if graceful shutdown takes too long
      child.kill('SIGKILL');
      runningProcesses.delete(serviceName);
      resolve({
        success: true,
        message: `Service ${serviceName} force stopped`
      });
    }, 10000); // 10 second timeout
    
    child.on('exit', () => {
      clearTimeout(timeout);
      runningProcesses.delete(serviceName);
      console.log(chalk.green(`✅ Service ${serviceName} stopped successfully`));
      resolve({
        success: true,
        message: `Service ${serviceName} stopped`
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      runningProcesses.delete(serviceName);
      reject(new Error(`Failed to stop service ${serviceName}: ${error.message}`));
    });
    
    // Try graceful shutdown first
    if (process.platform === 'win32') {
      child.kill('SIGTERM');
    } else {
      child.kill('SIGTERM');
    }
  });
}

// Restart a service
export async function restartService(service, options = {}) {
  try {
    if (runningProcesses.has(service.name)) {
      await stopService(service.name);
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return await startService(service, options);
  } catch (error) {
    throw new Error(`Failed to restart service ${service.name}: ${error.message}`);
  }
}

// Get service status
export function getServiceStatus(serviceName) {
  const processInfo = runningProcesses.get(serviceName);
  
  if (!processInfo) {
    return {
      name: serviceName,
      status: 'stopped',
      pid: null,
      uptime: 0
    };
  }
  
  const uptime = Date.now() - processInfo.startTime.getTime();
  
  return {
    name: serviceName,
    status: processInfo.status,
    pid: processInfo.process.pid,
    uptime: Math.floor(uptime / 1000), // in seconds
    startTime: processInfo.startTime.toISOString()
  };
}

// Get all service statuses
export function getAllServiceStatuses() {
  const statuses = {};
  
  runningProcesses.forEach((processInfo, serviceName) => {
    statuses[serviceName] = getServiceStatus(serviceName);
  });
  
  return statuses;
}

// Stop all running services
export async function stopAllServices() {
  const promises = [];
  
  for (const serviceName of runningProcesses.keys()) {
    promises.push(stopService(serviceName).catch(err => ({
      service: serviceName,
      error: err.message
    })));
  }
  
  const results = await Promise.all(promises);
  return results;
}

// Check if service directory has necessary files to run
export function validateServiceCanRun(service, serviceDir) {
  const { type } = service;
  
  switch (type) {
    case 'node':
    case 'frontend':
      return fs.existsSync(path.join(serviceDir, 'package.json'));
      
    case 'python':
      return fs.existsSync(path.join(serviceDir, 'app', 'main.py')) || 
             fs.existsSync(path.join(serviceDir, 'main.py'));
             
    case 'go':
      return fs.existsSync(path.join(serviceDir, 'main.go'));
      
    case 'java':
      return fs.existsSync(path.join(serviceDir, 'pom.xml')) ||
             fs.existsSync(path.join(serviceDir, 'build.gradle'));
             
    default:
      return false;
  }
}

// Install dependencies for a service
export async function installServiceDependencies(service, serviceDir) {
  const { type } = service;
  
  switch (type) {
    case 'node':
    case 'frontend':
      const pm = getPackageManagerCommand(serviceDir);
      return new Promise((resolve, reject) => {
        const child = spawn(pm, ['install'], {
          cwd: serviceDir,
          stdio: 'pipe'
        });
        
        child.on('exit', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            reject(new Error(`${pm} install failed with code ${code}`));
          }
        });
        
        child.on('error', reject);
      });
      
    case 'python':
      if (fs.existsSync(path.join(serviceDir, 'requirements.txt'))) {
        return new Promise((resolve, reject) => {
          const child = spawn('pip', ['install', '-r', 'requirements.txt'], {
            cwd: serviceDir,
            stdio: 'pipe'
          });
          
          child.on('exit', (code) => {
            if (code === 0) {
              resolve({ success: true });
            } else {
              reject(new Error(`pip install failed with code ${code}`));
            }
          });
          
          child.on('error', reject);
        });
      }
      return { success: true }; // No requirements file
      
    case 'go':
      return new Promise((resolve, reject) => {
        const child = spawn('go', ['mod', 'tidy'], {
          cwd: serviceDir,
          stdio: 'pipe'
        });
        
        child.on('exit', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            reject(new Error(`go mod tidy failed with code ${code}`));
          }
        });
        
        child.on('error', reject);
      });
      
    case 'java':
      // For Java, dependencies are managed by Maven/Gradle automatically
      return { success: true };
      
    default:
      return { success: true };
  }
}

// Helper functions for registering externally started processes
export function registerRunningProcess(serviceName, process, serviceConfig) {
  runningProcesses.set(serviceName, {
    process,
    service: serviceConfig,
    startTime: new Date(),
    status: 'running'
  });
}

export function unregisterRunningProcess(serviceName) {
  runningProcesses.delete(serviceName);
}