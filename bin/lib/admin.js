import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import http from 'http';
import { spawn } from 'node:child_process';
 
// Simple service status checker
async function checkServiceStatus(service) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ status: 'down', error: 'Timeout' });
    }, 3000);
 
    const req = http.get(`http://localhost:${service.port}`, (res) => {
      clearTimeout(timeout);
      resolve({
        status: res.statusCode < 400 ? 'up' : 'error',
        statusCode: res.statusCode
      });
      req.destroy();
    });
 
    req.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        status: 'down',
        error: error.code || error.message
      });
    });
  });
}
 
// Check status of all services
export async function getServicesStatus(services) {
  const statusPromises = services.map(async (service) => {
    const status = await checkServiceStatus(service);
    return {
      ...service,
      ...status,
      lastChecked: new Date().toISOString()
    };
  });
 
  return Promise.all(statusPromises);
}
 
// Generate HTML dashboard
function generateDashboardHTML(servicesWithStatus, refreshInterval = 5000) {
  const statusColor = (status) => {
    switch (status) {
      case 'up': return '#0d9488'; // teal
      case 'down': return '#dc2626'; // red
      case 'error': return '#d97706'; // amber
      default: return '#64748b'; // slate
    }
  };
 
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Polyglot Admin Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif; background:#f1f5f9; color:#0f172a; }
    a { text-decoration:none; color:#0369a1; }
    header { background:#0f172a; color:#fff; padding:16px 28px; display:flex; align-items:center; justify-content:space-between; }
    header h1 { font-size:1.25rem; font-weight:600; letter-spacing:.5px; margin:0; }
    header .meta { font-size:.75rem; opacity:.8; }
    .layout { display:flex; min-height:calc(100vh - 56px); }
    .sidebar { width:240px; background:#1e293b; color:#e2e8f0; padding:20px 16px; display:flex; flex-direction:column; gap:18px; }
    .sidebar h2 { font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0 0 4px; color:#94a3b8; }
    .service-list { list-style:none; margin:0; padding:0; }
    .service-list li { margin:0 0 6px; }
    .svc-link { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; font-size:.85rem; line-height:1.2; background:#334155; transition:background .15s ease; }
    .svc-link:hover { background:#475569; }
    .dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; box-shadow:0 0 0 2px rgba(0,0,0,0.15) inset; }
    .dot.up { background:#0d9488; }
    .dot.down { background:#dc2626; }
    .dot.error { background:#d97706; }
    main { flex:1; padding:28px 34px; overflow:auto; }
    .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
    .toolbar .refresh { font-size:.75rem; color:#475569; background:#e2e8f0; padding:6px 10px; border-radius:4px; }
    table { width:100%; border-collapse:separate; border-spacing:0 6px; }
    thead th { text-align:left; font-size:.70rem; font-weight:600; color:#475569; text-transform:uppercase; letter-spacing:.75px; padding:10px 12px; }
    tbody td { background:#fff; padding:12px 12px; font-size:.8rem; vertical-align:middle; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; }
    tbody tr td:first-child { border-left:1px solid #e2e8f0; border-top-left-radius:6px; border-bottom-left-radius:6px; }
    tbody tr td:last-child { border-right:1px solid #e2e8f0; border-top-right-radius:6px; border-bottom-right-radius:6px; }
    tbody tr { transition:transform .12s ease, box-shadow .12s ease; }
    tbody tr:hover { transform:translateY(-2px); box-shadow:0 4px 24px -4px rgba(0,0,0,0.10); }
    .status-badge { display:inline-flex; align-items:center; gap:6px; font-size:.65rem; font-weight:600; letter-spacing:.5px; padding:4px 8px; border-radius:4px; background:#e2e8f0; color:#0f172a; }
    .status-badge.up { background:#0d9488; color:#fff; }
    .status-badge.down { background:#dc2626; color:#fff; }
    .status-badge.error { background:#d97706; color:#fff; }
    .path { font-family:monospace; font-size:.7rem; color:#334155; }
    .footer { margin-top:40px; font-size:.65rem; color:#64748b; text-align:center; }
    .empty { margin-top:80px; text-align:center; font-size:1rem; color:#475569; }
    @media (max-width: 920px) { .layout { flex-direction:column; } .sidebar { width:100%; flex-direction:row; flex-wrap:wrap; } .service-list { display:flex; flex-wrap:wrap; gap:8px; } .service-list li { margin:0; } }
  </style>
  <script>
    const REFRESH_MS = ${refreshInterval};
    let nextRefreshLabel;
    function scheduleCountdown() {
      const el = document.querySelector('.refresh');
      if (!el) return;
      let remaining = REFRESH_MS/1000;
      el.textContent = 'Next refresh in ' + remaining.toFixed(1) + 's';
      clearInterval(nextRefreshLabel);
      nextRefreshLabel = setInterval(()=>{
        remaining -= 0.5;
        if (remaining <= 0) { clearInterval(nextRefreshLabel); }
        else { el.textContent = 'Next refresh in ' + remaining.toFixed(1) + 's'; }
      }, 500);
    }
 
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('HTTP '+res.status);
        const data = await res.json();
        updateUI(data);
        hideError();
      } catch (e) {
        showError('Failed to refresh: ' + e.message);
      } finally {
        scheduleCountdown();
        setTimeout(fetchStatus, REFRESH_MS);
      }
    }
 
    function updateUI(services) {
      const tbody = document.querySelector('tbody');
      if (!tbody) return;
      // Update sidebar count
      const meta = document.querySelector('header .meta');
      if (meta) meta.textContent = 'Auto-refresh: ' + (REFRESH_MS/1000).toFixed(1) + 's | Services: ' + services.length;
 
      // Build rows HTML
      const rows = services.map(s => (
        '<tr id="row-'+s.name+'">'
        + '<td><strong>'+s.name+'</strong></td>'
        + '<td>'+s.type+'</td>'
        + '<td>'+s.port+'</td>'
        + '<td><span class="status-badge '+s.status+'"><span class="dot '+s.status+'" style="box-shadow:none;width:8px;height:8px;"></span>'+s.status.toUpperCase()+'</span></td>'
        + '<td><span class="path">'+(s.path || 'services/'+s.name)+'</span></td>'
        + '<td>'+new Date(s.lastChecked).toLocaleTimeString()+'</td>'
        + '<td><a href="http://localhost:'+s.port+'" target="_blank">Open</a></td>'
        + '</tr>'
      )).join('');
      tbody.innerHTML = rows;
 
      // Update sidebar dots
      services.forEach(s => {
        const link = document.querySelector('.svc-link[href="#row-'+s.name+'"] .dot');
        if (link) {
          link.className = 'dot ' + s.status; // replace classes
        }
      });
    }
 
    function showError(msg) {
      let bar = document.querySelector('#error-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'error-bar';
        bar.style.cssText = 'position:fixed;left:0;right:0;top:56px;background:#dc2626;color:#fff;padding:6px 14px;font-size:12px;font-weight:500;z-index:50;box-shadow:0 2px 6px -2px rgba(0,0,0,0.3);';
        document.body.appendChild(bar);
      }
      bar.textContent = msg;
    }
    function hideError() {
      const bar = document.querySelector('#error-bar');
      if (bar) bar.remove();
    }
 
    window.addEventListener('DOMContentLoaded', () => {
      scheduleCountdown();
      setTimeout(fetchStatus, REFRESH_MS); // initial schedule
    });
  </script>
</head>
<body>
  <header>
    <h1>Polyglot Admin Dashboard</h1>
    <div class="meta">Auto-refresh: ${(refreshInterval/1000).toFixed(1)}s | Services: ${servicesWithStatus.length}</div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <div>
        <h2>Services</h2>
        <ul class="service-list">
          ${servicesWithStatus.map(s => `<li><a class="svc-link" href="#row-${s.name}"><span class="dot ${s.status}"></span><span>${s.name}</span></a></li>`).join('') || '<li style="font-size:.8rem;color:#64748b;">No services</li>'}
        </ul>
      </div>
      <div>
        <h2>Status Legend</h2>
        <ul class="service-list" style="font-size:.65rem;">
          <li class="svc-link" style="background:#334155"><span class="dot up"></span>UP</li>
          <li class="svc-link" style="background:#334155"><span class="dot down"></span>DOWN</li>
          <li class="svc-link" style="background:#334155"><span class="dot error"></span>ERROR</li>
        </ul>
      </div>
    </aside>
    <main>
      <div class="toolbar">
        <div style="font-size:.8rem; font-weight:500; color:#334155;">Service Overview</div>
        <div class="refresh">Next refresh in ${(refreshInterval/1000).toFixed(1)}s</div>
      </div>
      ${servicesWithStatus.length === 0 ? `<div class="empty">No services found. Run inside a generated polyglot workspace.</div>` : `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Port</th>
            <th>Status</th>
            <th>Path</th>
            <th>Last Checked</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          ${servicesWithStatus.map(s => `
            <tr id="row-${s.name}">
              <td><strong>${s.name}</strong></td>
              <td>${s.type}</td>
              <td>${s.port}</td>
              <td><span class="status-badge ${s.status}"><span class="dot ${s.status}" style="box-shadow:none;width:8px;height:8px;"></span>${s.status.toUpperCase()}</span></td>
              <td><span class="path">${s.path || `services/${s.name}`}</span></td>
              <td>${new Date(s.lastChecked).toLocaleTimeString()}</td>
              <td><a href="http://localhost:${s.port}" target="_blank">Open</a></td>
            </tr>`).join('')}
        </tbody>
      </table>`}
      <div class="footer">Polyglot Admin · Generated by create-polyglot</div>
    </main>
  </div>
</body>
</html>`;
}
 
// Start admin dashboard server
export async function startAdminDashboard(options = {}) {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'polyglot.json');
  
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red('❌ polyglot.json not found. Run inside a generated workspace.'));
    process.exit(1);
  }
  
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const port = options.port || 8080;
  const refreshInterval = options.refresh || 5000;
  
  console.log(chalk.cyan('🚀 Starting Admin Dashboard...'));
  console.log(chalk.gray(`   Monitoring ${cfg.services.length} services`));
  console.log(chalk.gray(`   Dashboard URL: http://localhost:${port}`));
  console.log(chalk.gray(`   Refresh interval: ${refreshInterval / 1000}s`));
  console.log(chalk.yellow('   Press Ctrl+C to stop\n'));
  
  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/status') {
      // API endpoint for service status
      const servicesWithStatus = await getServicesStatus(cfg.services);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(servicesWithStatus, null, 2));
      return;
    }
    
    // Serve dashboard HTML
    const servicesWithStatus = await getServicesStatus(cfg.services);
    const html = generateDashboardHTML(servicesWithStatus, refreshInterval);
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  
  server.listen(port, () => {
    console.log(chalk.green(`✅ Admin Dashboard running at http://localhost:${port}`));
    
    // Auto-open browser if requested
    if (options.open !== false) {
      const openCmd = process.platform === 'darwin' ? 'open' :
                     process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(openCmd, [`http://localhost:${port}`], { detached: true, stdio: 'ignore' });
    }
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down Admin Dashboard...'));
    server.close(() => {
      console.log(chalk.green('✅ Dashboard stopped'));
      process.exit(0);
    });
  });
  
  // Log service status updates periodically
  setInterval(async () => {
    const servicesWithStatus = await getServicesStatus(cfg.services);
    const upCount = servicesWithStatus.filter(s => s.status === 'up').length;
    const downCount = servicesWithStatus.filter(s => s.status === 'down').length;
    const errorCount = servicesWithStatus.filter(s => s.status === 'error').length;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${timestamp}] Services: ${chalk.green(upCount + ' up')}, ${chalk.red(downCount + ' down')}, ${chalk.yellow(errorCount + ' error')}`));
  }, refreshInterval);
  
  return server;
}