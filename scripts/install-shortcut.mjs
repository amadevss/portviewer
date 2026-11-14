import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const shouldStart = args.includes('--start') || args.includes('-Start');

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoDir,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

if (process.platform === 'win32') {
  const psScript = path.join(__dirname, 'Install-PortViewerShortcut.ps1');
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript];
  if (shouldStart) psArgs.push('-Start');
  run('powershell.exe', psArgs);
} else if (process.platform === 'darwin' || process.platform === 'linux') {
  const shScript = path.join(__dirname, 'install-portviewer-shortcut.sh');
  try {
    fs.chmodSync(shScript, 0o755);
  } catch {
    // ignore if chmod fails
  }
  const shArgs = [shScript];
  if (shouldStart) shArgs.push('--start');
  run('bash', shArgs);
} else {
  console.error(`Plataforma no soportada para acceso directo automático: ${process.platform}`);
  process.exit(1);
}
