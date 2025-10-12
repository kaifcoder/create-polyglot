import chalk from 'chalk';

// Simple table renderer without external heavy deps (keep bundle light)
// Falls back to console.table if terminal width is too narrow.
export function renderServicesTable(services, { title = 'Services', showHeader = true } = {}) {
  if (!services || !services.length) {
    console.log(chalk.yellow('No services to display.'));
    return;
  }
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'port', label: 'Port' },
    { key: 'path', label: 'Path' }
  ];
  const rows = services.map(s => ({
    name: chalk.bold.cyan(s.name),
    type: colorType(s.type)(s.type),
    port: chalk.green(String(s.port)),
    path: chalk.dim(s.path || `services/${s.name}`)
  }));

  const termWidth = process.stdout.columns || 80;
  const minWidthNeeded = cols.reduce((a,c)=>a + c.label.length + 5, 0);
  if (termWidth < minWidthNeeded) {
    console.table(services.map(s => ({ name: s.name, type: s.type, port: s.port, path: s.path || `services/${s.name}` })));
    return;
  }

  const colWidths = cols.map(c => Math.max(c.label.length, ...rows.map(r => strip(r[c.key]).length)) + 2);
  const totalWidth = colWidths.reduce((a,b)=>a+b,0) + cols.length + 1;
  const top = '┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const sep = '├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bottom = '└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';

  console.log(chalk.magentaBright(`\n${title}`));
  console.log(top);
  if (showHeader) {
    const header = '│' + cols.map((c,i)=>pad(chalk.bold.white(c.label), colWidths[i])).join('│') + '│';
    console.log(header);
    console.log(sep);
  }
  for (const r of rows) {
    const line = '│' + cols.map((c,i)=>pad(r[c.key], colWidths[i])).join('│') + '│';
    console.log(line);
  }
  console.log(bottom);
  console.log(chalk.gray(`Total: ${services.length}`));
}

function pad(str, width) {
  const raw = strip(str);
  const diff = width - raw.length;
  return str + ' '.repeat(diff);
}

function strip(str) {
  return str.replace(/\x1B\[[0-9;]*m/g,'');
}

function colorType(type) {
  switch(type) {
    case 'node': return chalk.green;
    case 'python': return chalk.yellow;
    case 'go': return chalk.cyan;
    case 'java': return chalk.red;
    case 'frontend': return chalk.blue;
    default: return chalk.white;
  }
}

export function printBoxMessage(lines, { color = chalk.blueBright } = {}) {
  const clean = lines.filter(Boolean);
  const width = Math.min(Math.max(...clean.map(l => l.length))+4, process.stdout.columns || 100);
  const top = '┏' + '━'.repeat(width-2) + '┓';
  const bottom = '┗' + '━'.repeat(width-2) + '┛';
  console.log(color(top));
  for (const l of clean) {
    const truncated = l.length + 4 > width ? l.slice(0,width-5) + '…' : l;
    const pad = width - 2 - truncated.length;
    console.log(color('┃ ' + truncated + ' '.repeat(pad-1) + '┃'));
  }
  console.log(color(bottom));
}
