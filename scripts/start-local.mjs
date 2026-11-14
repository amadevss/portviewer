import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const noBrowser = args.includes('--no-browser') || args.includes('-NoBrowser');

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
  const psScript = path.join(__dirname, 'Start-PortViewer.ps1');
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript];
  if (noBrowser) psArgs.push('-NoBrowser');
  run('powershell.exe', psArgs);
} else if (process.platform === 'darwin' || process.platform === 'linux') {
  const shScript = path.join(__dirname, 'start-portviewer.sh');
  try {
    fs.chmodSync(shScript, 0o755);
  } catch {
    // ignore
  }
  const shArgs = [shScript];
  if (noBrowser) shArgs.push('--no-browser');
  run('bash', shArgs);
} else {
  console.error(`Plataforma no soportada: ${process.platform}`);
  process.exit(1);
}
