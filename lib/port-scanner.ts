import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildDemoResponse } from './demo-data';
import { isCriticalSystemProcess } from './security';
import type {
  BindScope,
  PortCategory,
  PortEntry,
  PortsApiResponse,
  ProcessInfo,
  ProjectInfo,
  RuntimeInfo,
  SocketConnection,
  WebProbeInfo,
} from './types';

const execFileAsync = promisify(execFile);

interface RawWindowsProcess {
  pid: number;
  name: string;
  executablePath?: string | null;
  commandLine?: string | null;
  parentPid?: number | null;
  parentName?: string | null;
  parentCommandLine?: string | null;
  memoryBytes?: number | null;
  owner?: string | null;
  windowTitle?: string | null;
  startedAt?: string | null;
  cpuSeconds?: number | null;
  company?: string | null;
  fileDescription?: string | null;
  productName?: string | null;
}

interface RawWindowsSnapshot {
  tcp: Array<{
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
    pid: number;
    createdAt?: string | null;
  }>;
  udp: Array<{
    localAddress: string;
    localPort: number;
    pid: number;
    createdAt?: string | null;
  }>;
  processes: Record<string, RawWindowsProcess>;
}

const KNOWN_DB_PORTS: Record<number, string> = {
  1433: 'SQL Server (MSSQL)',
  1521: 'Oracle DB',
  3306: 'MySQL / MariaDB',
  5432: 'PostgreSQL',
  5984: 'CouchDB',
  6379: 'Redis',
  7474: 'Neo4j',
  7687: 'Neo4j Bolt',
  9042: 'Cassandra',
  9200: 'Elasticsearch',
  11211: 'Memcached',
  27017: 'MongoDB',
  28015: 'RethinkDB',
};

const KNOWN_OS_BINARY_PORTS: Record<number, string> = {
  135: 'Windows RPC Endpoint Mapper',
  137: 'NetBIOS Name Service',
  138: 'NetBIOS Datagram Service',
  139: 'NetBIOS Session Service',
  445: 'Windows SMB / File Sharing',
  500: 'IKEv2 / IPsec',
  1900: 'SSDP / UPnP',
  3389: 'Remote Desktop (RDP)',
  4500: 'IPsec NAT-T',
  5040: 'Windows Connected Devices',
  5353: 'mDNS / Bonjour',
  5355: 'LLMNR',
  7680: 'Windows Delivery Optimization',
};

const KNOWN_DEV_PORTS: Record<number, string> = {
  3000: 'App Web / Next.js / React',
  3001: 'App Web Secundaria / API',
  4000: 'Backend / GraphQL / Phoenix',
  4200: 'Angular Dev Server',
  4321: 'Astro Dev Server',
  4949: 'PortViewer Dashboard',
  5000: 'Flask / .NET / API Local',
  5173: 'Vite Dev Server',
  5174: 'Vite Dev Server (Alt)',
  5500: 'Live Server',
  8000: 'Django / FastAPI / Python HTTP',
  8080: 'HTTP Proxy / Tomcat / Spring',
  8081: 'Metro / Expo / Admin',
  8443: 'HTTPS Local',
  8888: 'Jupyter / Local HTTP',
  9000: 'SonarQube / PHP-FPM / MinIO',
  9090: 'Prometheus / Cockpit',
};

const NON_HTTP_PROBE_SKIP_PORTS = new Set([
  ...Object.keys(KNOWN_OS_BINARY_PORTS).map(Number),
  1433,
  1521,
  3306,
  5432,
  6379,
  11211,
  27017,
]);

function getLocalIpv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return Array.from(new Set(ips));
}

function formatUptime(startedAtIso?: string | null): string | undefined {
  if (!startedAtIso) return undefined;
  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) return undefined;
  const diffSec = Math.max(0, Math.floor((Date.now() - started) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function determineBindScope(addresses: string[]): BindScope {
  const hasWildcard = addresses.some((a) => a === '0.0.0.0' || a === '::' || a === '*');
  if (hasWildcard) return 'network';
  const allLoopback = addresses.every(
    (a) => a === '127.0.0.1' || a === '::1' || a.startsWith('127.'),
  );
  return allLoopback ? 'localhost' : 'specific';
}

function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

async function collectWindowsProcessMap(
  targetPids: number[],
): Promise<Record<string, RawWindowsProcess>> {
  if (targetPids.length === 0) return {};

  const pidLiteral = targetPids.join(',');
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$targetPids = @(${pidLiteral})
$cimAll = Get-CimInstance Win32_Process -Property ProcessId,Name,ExecutablePath,CommandLine,ParentProcessId,WorkingSetSize,CreationDate
$cimById = @{}
foreach ($p in $cimAll) {
  $cimById[[int]$p.ProcessId] = $p
}

$gpById = @{}
foreach ($gp in (Get-Process)) {
  $gpById[[int]$gp.Id] = $gp
}

$viCache = @{}
$procMap = @{}
foreach ($pidVal in $targetPids) {
  $cim = $cimById[$pidVal]
  $gp = $gpById[$pidVal]

  $parentPid = if ($cim -and $null -ne $cim.ParentProcessId) { [int]$cim.ParentProcessId } else { $null }
  $parentCim = if ($null -ne $parentPid) { $cimById[$parentPid] } else { $null }

  $procName = if ($cim -and $cim.Name) { [string]$cim.Name } elseif ($gp -and $gp.ProcessName) { "$($gp.ProcessName).exe" } else { "PID $pidVal" }
  $exePath = if ($cim -and $cim.ExecutablePath) { [string]$cim.ExecutablePath } else { try { $gp.Path } catch { $null } }

  $ownerStr = $null
  if ($pidVal -le 4 -or $procName -eq 'svchost.exe') {
    $ownerStr = 'NT AUTHORITY\\SYSTEM'
  } elseif ($gp) {
    try {
      if ($gp.SessionId -eq 0) {
        $ownerStr = 'Servicio / SYSTEM (Sesión 0)'
      } else {
        $ownerStr = "$env:USERDOMAIN\\$env:USERNAME"
      }
    } catch {}
  }

  $startedAt = $null
  if ($cim -and $cim.CreationDate) {
    try { $startedAt = ([DateTime]$cim.CreationDate).ToString('o') } catch {}
  } elseif ($gp) {
    try { $startedAt = $gp.StartTime.ToString('o') } catch {}
  }

  $cpuSec = $null
  if ($gp) {
    try { $cpuSec = [math]::Round([double]$gp.CPU, 2) } catch {}
  }

  $company = $null
  $fileDesc = $null
  $prodName = $null
  if ($exePath) {
    if (-not $viCache.ContainsKey($exePath)) {
      try {
        $viCache[$exePath] = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exePath)
      } catch {
        $viCache[$exePath] = $null
      }
    }
    $vi = $viCache[$exePath]
    if ($vi) {
      $company = $vi.CompanyName
      $fileDesc = $vi.FileDescription
      $prodName = $vi.ProductName
    }
  }

  $memBytes = if ($cim -and $null -ne $cim.WorkingSetSize) { [double]$cim.WorkingSetSize } elseif ($gp) { [double]$gp.WorkingSet64 } else { $null }
  $winTitle = if ($gp -and $gp.MainWindowTitle) { [string]$gp.MainWindowTitle } else { $null }

  $procMap[[string]$pidVal] = [PSCustomObject]@{
    pid = $pidVal
    name = $procName
    executablePath = $exePath
    commandLine = if ($cim) { $cim.CommandLine } else { $null }
    parentPid = $parentPid
    parentName = if ($parentCim) { [string]$parentCim.Name } else { $null }
    parentCommandLine = if ($parentCim) { $parentCim.CommandLine } else { $null }
    memoryBytes = $memBytes
    owner = $ownerStr
    windowTitle = $winTitle
    startedAt = $startedAt
    cpuSeconds = $cpuSec
    company = $company
    fileDescription = $fileDesc
    productName = $prodName
  }
}

$procMap | ConvertTo-Json -Depth 4 -Compress
`.trim();

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodePowerShellCommand(psScript),
      ],
      {
        maxBuffer: 15 * 1024 * 1024,
        timeout: 8000,
        windowsHide: true,
      },
    );
    const trimmed = stdout.trim();
    if (!trimmed) return {};
    const parsed = JSON.parse(trimmed) as Record<string, RawWindowsProcess>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function collectWindowsSnapshot(): Promise<RawWindowsSnapshot> {
  const netstatData = await collectWindowsNetstatFallback();
  const pidSet = new Set<number>([process.pid]);
  for (const item of netstatData.tcp) {
    if (item.pid > 0) pidSet.add(item.pid);
  }
  for (const item of netstatData.udp) {
    if (item.pid > 0) pidSet.add(item.pid);
  }

  const processes = await collectWindowsProcessMap(Array.from(pidSet));
  return {
    tcp: netstatData.tcp,
    udp: netstatData.udp,
    processes,
  };
}

function parseNetstatAddress(token: string): { address: string; port: number } | null {
  const trimmed = token.trim();
  if (!trimmed || trimmed === '*:*') return null;
  if (trimmed.startsWith('[')) {
    const closingIdx = trimmed.indexOf(']:');
    if (closingIdx === -1) return null;
    const address = trimmed.slice(1, closingIdx);
    const port = Number(trimmed.slice(closingIdx + 2));
    return Number.isFinite(port) ? { address, port } : null;
  }
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon === -1) return null;
  const address = trimmed.slice(0, lastColon);
  const portRaw = trimmed.slice(lastColon + 1);
  if (portRaw === '*') return { address, port: 0 };
  const port = Number(portRaw);
  return Number.isFinite(port) ? { address, port } : null;
}

function normalizeNetstatState(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper === 'LISTENING' || upper === 'ESCUCHANDO') return 'Listen';
  if (upper === 'ESTABLISHED' || upper === 'ESTABLECIDO') return 'Established';
  if (upper === 'TIME_WAIT') return 'TimeWait';
  if (upper === 'CLOSE_WAIT') return 'CloseWait';
  if (upper === 'SYN_SENT') return 'SynSent';
  if (upper === 'SYN_RECEIVED') return 'SynReceived';
  return raw;
}

async function collectWindowsNetstatFallback(): Promise<RawWindowsSnapshot> {
  const { stdout } = await execFileAsync('netstat', ['-ano'], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 8000,
    windowsHide: true,
  });

  const tcp: RawWindowsSnapshot['tcp'] = [];
  const udp: RawWindowsSnapshot['udp'] = [];

  for (const line of stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const proto = parts[0]?.toUpperCase();
    if (proto === 'TCP' && parts.length >= 5) {
      const local = parseNetstatAddress(parts[1]);
      const remote = parseNetstatAddress(parts[2]);
      const state = normalizeNetstatState(parts[3]);
      const pid = Number(parts[4]);
      if (local && Number.isFinite(pid)) {
        tcp.push({
          localAddress: local.address,
          localPort: local.port,
          remoteAddress: remote?.address ?? '0.0.0.0',
          remotePort: remote?.port ?? 0,
          state,
          pid,
        });
      }
    } else if (proto === 'UDP' && parts.length >= 4) {
      const local = parseNetstatAddress(parts[1]);
      const pid = Number(parts[parts.length - 1]);
      if (local && Number.isFinite(pid)) {
        udp.push({
          localAddress: local.address,
          localPort: local.port,
          pid,
        });
      }
    }
  }

  return { tcp, udp, processes: {} };
}

function extractCandidatePaths(text?: string | null): string[] {
  if (!text) return [];
  const matches = new Set<string>();

  const quotedRegex = /"([A-Za-z]:\\[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = quotedRegex.exec(text)) !== null) {
    matches.add(m[1]);
  }

  const unquotedRegex = /([A-Za-z]:\\[^\s"';|><]+)/g;
  while ((m = unquotedRegex.exec(text)) !== null) {
    matches.add(m[1]);
  }

  const unixRegex = /(\/[^\s"';|><]+)/g;
  while ((m = unixRegex.exec(text)) !== null) {
    if (m[1].length > 3) matches.add(m[1]);
  }

  return Array.from(matches);
}

function isIgnoredSystemRoot(dirPath: string): boolean {
  const norm = path.normalize(dirPath).toLowerCase();
  const root = path.parse(norm).root.toLowerCase();
  if (norm === root) return true;
  if (
    norm === 'c:\\windows' ||
    norm.startsWith('c:\\windows\\') ||
    norm === 'c:\\program files' ||
    norm === 'c:\\program files (x86)' ||
    norm === 'c:\\users' ||
    norm === '/usr' ||
    norm === '/bin' ||
    norm === '/etc'
  ) {
    return true;
  }
  return false;
}

function detectFrameworkFromPackageJson(pkg: Record<string, unknown>): string | undefined {
  const deps = {
    ...(typeof pkg.dependencies === 'object' && pkg.dependencies ? pkg.dependencies : {}),
    ...(typeof pkg.devDependencies === 'object' && pkg.devDependencies ? pkg.devDependencies : {}),
  } as Record<string, string>;

  if (deps.next) return `Next.js ${deps.next.replace(/^[\^~]/, '')}`;
  if (deps.nuxt) return 'Nuxt';
  if (deps.astro) return 'Astro';
  if (deps['@remix-run/react']) return 'Remix';
  if (deps['@nestjs/core']) return 'NestJS';
  if (deps.vite && deps.react) return 'Vite + React';
  if (deps.vite && deps.vue) return 'Vite + Vue';
  if (deps.vite) return 'Vite';
  if (deps['react-scripts']) return 'Create React App';
  if (deps.react) return 'React';
  if (deps.fastify) return 'Fastify';
  if (deps.express) return 'Express';
  if (deps.hono) return 'Hono';
  if (deps.electron) return 'Electron';
  return undefined;
}

async function readGitBranch(projectRoot: string): Promise<string | undefined> {
  try {
    const head = await fs.readFile(path.join(projectRoot, '.git', 'HEAD'), 'utf8');
    const trimmed = head.trim();
    if (trimmed.startsWith('ref:')) {
      return trimmed.replace(/^ref:\s*refs\/heads\//, '');
    }
    return trimmed.slice(0, 7);
  } catch {
    return undefined;
  }
}

async function inspectDirectoryForProject(
  startDir: string,
  dirCache: Map<string, ProjectInfo | null>,
): Promise<ProjectInfo | undefined> {
  const normalizedStart = path.normalize(startDir);
  if (dirCache.has(normalizedStart)) {
    return dirCache.get(normalizedStart) ?? undefined;
  }

  let current = normalizedStart;
  const nodeModulesSegment = `${path.sep}node_modules${path.sep}`;
  const nmIndex = current.toLowerCase().indexOf(nodeModulesSegment);
  if (nmIndex !== -1) {
    current = current.slice(0, nmIndex);
  }
  const venvSegment = `${path.sep}.venv${path.sep}`;
  const venvIndex = current.toLowerCase().indexOf(venvSegment);
  if (venvIndex !== -1) {
    current = current.slice(0, venvIndex);
  }

  for (let depth = 0; depth < 5; depth++) {
    if (!current || isIgnoredSystemRoot(current)) break;

    if (dirCache.has(current)) {
      const cached = dirCache.get(current);
      if (cached) {
        dirCache.set(normalizedStart, cached);
        return cached;
      }
    }

    try {
      const stat = await fs.stat(current);
      if (stat.isFile()) {
        current = path.dirname(current);
        continue;
      }
    } catch {
      current = path.dirname(current);
      continue;
    }

    const pkgPath = path.join(current, 'package.json');
    try {
      const rawPkg = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(rawPkg) as Record<string, unknown>;
      const gitBranch = await readGitBranch(current);
      const scripts =
        typeof pkg.scripts === 'object' && pkg.scripts
          ? (pkg.scripts as Record<string, string>)
          : undefined;
      let packageManager: string | undefined;
      for (const [lockfile, pm] of [
        ['pnpm-lock.yaml', 'pnpm'],
        ['yarn.lock', 'yarn'],
        ['bun.lockb', 'bun'],
        ['package-lock.json', 'npm'],
      ] as const) {
        try {
          await fs.access(path.join(current, lockfile));
          packageManager = pm;
          break;
        } catch {
          // continue
        }
      }

      const info: ProjectInfo = {
        name: typeof pkg.name === 'string' && pkg.name ? pkg.name : path.basename(current),
        path: current,
        framework: detectFrameworkFromPackageJson(pkg),
        version: typeof pkg.version === 'string' ? pkg.version : undefined,
        description: typeof pkg.description === 'string' ? pkg.description : undefined,
        packageManager,
        gitBranch,
        scripts,
        markerFile: 'package.json',
      };
      dirCache.set(current, info);
      dirCache.set(normalizedStart, info);
      return info;
    } catch {
      // Not a package.json project at this level
    }

    for (const [marker, defaultFramework] of [
      ['pyproject.toml', 'Python'],
      ['manage.py', 'Django / Python'],
      ['requirements.txt', 'Python'],
      ['Cargo.toml', 'Rust'],
      ['go.mod', 'Go'],
      ['pom.xml', 'Java / Maven'],
      ['build.gradle', 'Java / Gradle'],
    ] as const) {
      try {
        await fs.access(path.join(current, marker));
        const gitBranch = await readGitBranch(current);
        const info: ProjectInfo = {
          name: path.basename(current),
          path: current,
          framework: defaultFramework,
          gitBranch,
          markerFile: marker,
        };
        dirCache.set(current, info);
        dirCache.set(normalizedStart, info);
        return info;
      } catch {
        // continue
      }
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  dirCache.set(normalizedStart, null);
  return undefined;
}

async function detectProjectForProcess(
  raw: RawWindowsProcess | undefined,
  dirCache: Map<string, ProjectInfo | null>,
): Promise<ProjectInfo | undefined> {
  if (!raw) return undefined;
  const candidates = [
    ...extractCandidatePaths(raw.commandLine),
    ...extractCandidatePaths(raw.parentCommandLine),
    ...(raw.executablePath ? [raw.executablePath] : []),
  ];

  for (const candidate of candidates) {
    if (isIgnoredSystemRoot(candidate)) continue;
    const lower = candidate.toLowerCase();
    if (
      lower.endsWith('\\node.exe') ||
      lower.endsWith('\\python.exe') ||
      lower.endsWith('\\powershell.exe') ||
      lower.endsWith('\\cmd.exe')
    ) {
      continue;
    }
    const found = await inspectDirectoryForProject(candidate, dirCache);
    if (found) return found;
  }

  return undefined;
}

async function probeSingleHttp(
  port: number,
  protocol: 'http' | 'https',
  lanIps: string[],
): Promise<WebProbeInfo | null> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const client = protocol === 'https' ? https : http;
    const req = client.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        timeout: 380,
        rejectUnauthorized: false,
        headers: {
          Accept: 'text/html,application/json,*/*;q=0.8',
          'User-Agent': 'PortViewer/1.0',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          if (totalBytes < 16384) {
            chunks.push(chunk);
            totalBytes += chunk.length;
          } else {
            res.destroy();
          }
        });

        const finalize = () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const cleanTitle = titleMatch
            ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 120)
            : undefined;

          resolve({
            isWeb: true,
            protocol,
            url: `${protocol}://localhost:${port}`,
            lanUrls: lanIps.map((ip) => `${protocol}://${ip}:${port}`),
            statusCode: res.statusCode,
            statusText: res.statusMessage,
            title: cleanTitle || undefined,
            contentType:
              typeof res.headers['content-type'] === 'string'
                ? res.headers['content-type']
                : undefined,
            serverHeader:
              typeof res.headers.server === 'string' ? res.headers.server : undefined,
            poweredBy:
              typeof res.headers['x-powered-by'] === 'string'
                ? res.headers['x-powered-by']
                : undefined,
            redirectLocation:
              typeof res.headers.location === 'string' ? res.headers.location : undefined,
            responseTimeMs: Date.now() - startedAt,
          });
        };

        res.on('end', finalize);
        res.on('close', finalize);
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.on('error', () => {
      resolve(null);
    });

    req.end();
  });
}

async function probeLocalWebService(
  port: number,
  bindScope: BindScope,
  lanIps: string[],
): Promise<WebProbeInfo | undefined> {
  if (port <= 0 || NON_HTTP_PROBE_SKIP_PORTS.has(port)) return undefined;
  const effectiveLanIps = bindScope === 'network' ? lanIps : [];
  const httpRes = await probeSingleHttp(port, 'http', effectiveLanIps);
  if (httpRes) return httpRes;

  if (port === 443 || port === 8443 || port === 3443 || port === 9443) {
    const httpsRes = await probeSingleHttp(port, 'https', effectiveLanIps);
    if (httpsRes) return httpsRes;
  }
  return undefined;
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex++;
      results[current] = await tasks[current]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function classifyPort(
  port: number,
  processInfo: ProcessInfo,
  project: ProjectInfo | undefined,
  web: WebProbeInfo | undefined,
  commandLine?: string | null,
): { category: PortCategory; serviceHint?: string } {
  if (processInfo.isSelf) {
    return { category: 'web', serviceHint: 'PortViewer (Este panel)' };
  }
  if (KNOWN_DB_PORTS[port]) {
    return { category: 'database', serviceHint: KNOWN_DB_PORTS[port] };
  }
  if (KNOWN_OS_BINARY_PORTS[port] || processInfo.isSystemCritical) {
    return {
      category: 'system',
      serviceHint: KNOWN_OS_BINARY_PORTS[port] ?? processInfo.fileDescription ?? 'Servicio Windows',
    };
  }

  const procLower = processInfo.name.toLowerCase();
  const cmdLower = (commandLine ?? '').toLowerCase();

  if (procLower.includes('postgres')) return { category: 'database', serviceHint: 'PostgreSQL' };
  if (procLower.includes('mysqld') || procLower.includes('mariadb')) {
    return { category: 'database', serviceHint: 'MySQL / MariaDB' };
  }
  if (procLower.includes('mongod')) return { category: 'database', serviceHint: 'MongoDB' };
  if (procLower.includes('redis')) return { category: 'database', serviceHint: 'Redis' };

  if (web?.isWeb) {
    let hint = project?.framework ?? KNOWN_DEV_PORTS[port];
    if (!hint && cmdLower.includes('next')) hint = 'Next.js';
    if (!hint && cmdLower.includes('vite')) hint = 'Vite';
    if (!hint && cmdLower.includes('uvicorn')) hint = 'FastAPI / Uvicorn';
    if (!hint && web.poweredBy) hint = web.poweredBy;
    if (!hint && web.serverHeader) hint = web.serverHeader;
    return { category: 'web', serviceHint: hint ?? 'Servicio Web HTTP' };
  }

  if (
    project ||
    procLower.includes('node') ||
    procLower.includes('python') ||
    procLower.includes('java') ||
    procLower.includes('docker') ||
    procLower.includes('ruby') ||
    procLower.includes('go') ||
    procLower.includes('dotnet') ||
    procLower.includes('php') ||
    KNOWN_DEV_PORTS[port]
  ) {
    return {
      category: 'dev',
      serviceHint: project?.framework ?? KNOWN_DEV_PORTS[port] ?? processInfo.displayName,
    };
  }

  return {
    category: 'other',
    serviceHint:
      processInfo.fileDescription ??
      (processInfo.displayName !== processInfo.name ? processInfo.displayName : undefined),
  };
}

export async function scanLocalPorts(options?: {
  probeHttp?: boolean;
  demo?: boolean;
}): Promise<PortsApiResponse> {
  const startedAt = Date.now();
  const isVercel = process.env.VERCEL === '1';

  if (options?.demo) {
    return buildDemoResponse({
      isVercel,
      mode: 'demo',
      warning:
        'Modo Demo activado: los puertos mostrados son de ejemplo para explorar la interfaz.',
    });
  }

  if (isVercel) {
    return buildDemoResponse({
      isVercel: true,
      mode: 'cloud-readonly',
      warning:
        'Estás viendo PortViewer desplegado en Vercel (contenedor cloud). Desde la nube no es posible inspeccionar los puertos de tu PC; para usar tus datos reales, ejecuta este proyecto en tu computadora con `npm run dev:viewer`.',
    });
  }

  if (process.platform !== 'win32') {
    return buildDemoResponse({
      isVercel: false,
      mode: 'cloud-readonly',
      warning: `Sistema detectado (${process.platform}). Esta versión está optimizada para Windows; se muestra vista de ejemplo.`,
    });
  }

  const snapshot = await collectWindowsSnapshot();

  const lanIps = getLocalIpv4Addresses();
  const dirCache = new Map<string, ProjectInfo | null>();

  // Find PIDs belonging to PortViewer's own process or parent launcher
  const selfPids = new Set<number>([process.pid]);
  const selfProc = snapshot.processes[String(process.pid)];
  if (selfProc?.parentPid) {
    selfPids.add(selfProc.parentPid);
  }

  // Group listening / UDP endpoints by protocol + port + pid + state
  interface GroupBucket {
    id: string;
    port: number;
    protocol: 'TCP' | 'UDP';
    state: string;
    pid: number;
    localAddresses: Set<string>;
  }

  const groupMap = new Map<string, GroupBucket>();
  const establishedByPortPid = new Map<
    string,
    Array<{ remoteAddress: string; remotePort: number; state: string }>
  >();

  const allSockets: SocketConnection[] = [];

  for (const conn of snapshot.tcp) {
    allSockets.push({
      protocol: 'TCP',
      localAddress: conn.localAddress,
      localPort: conn.localPort,
      remoteAddress: conn.remoteAddress,
      remotePort: conn.remotePort,
      state: conn.state,
      pid: conn.pid,
      createdAt: conn.createdAt ?? undefined,
    });

    if (conn.state === 'Listen') {
      const key = `TCP-${conn.localPort}-${conn.pid}-Listen`;
      let bucket = groupMap.get(key);
      if (!bucket) {
        bucket = {
          id: key,
          port: conn.localPort,
          protocol: 'TCP',
          state: 'Listen',
          pid: conn.pid,
          localAddresses: new Set(),
        };
        groupMap.set(key, bucket);
      }
      bucket.localAddresses.add(conn.localAddress);
    } else if (conn.state === 'Established' || conn.state === 'CloseWait') {
      const peerKey = `${conn.localPort}-${conn.pid}`;
      const arr = establishedByPortPid.get(peerKey) ?? [];
      arr.push({
        remoteAddress: conn.remoteAddress,
        remotePort: conn.remotePort,
        state: conn.state,
      });
      establishedByPortPid.set(peerKey, arr);
    }
  }

  for (const ep of snapshot.udp) {
    allSockets.push({
      protocol: 'UDP',
      localAddress: ep.localAddress,
      localPort: ep.localPort,
      state: 'Bound',
      pid: ep.pid,
      createdAt: ep.createdAt ?? undefined,
    });

    const key = `UDP-${ep.localPort}-${ep.pid}-Bound`;
    let bucket = groupMap.get(key);
    if (!bucket) {
      bucket = {
        id: key,
        port: ep.localPort,
        protocol: 'UDP',
        state: 'Bound',
        pid: ep.pid,
        localAddresses: new Set(),
      };
      groupMap.set(key, bucket);
    }
    bucket.localAddresses.add(ep.localAddress);
  }

  // Enrich unique PIDs with project info once
  const uniquePids = Array.from(new Set(Array.from(groupMap.values()).map((g) => g.pid)));
  const projectByPid = new Map<number, ProjectInfo | undefined>();

  await runWithConcurrency(
    uniquePids.map((pid) => async () => {
      const raw = snapshot.processes[String(pid)];
      const proj = await detectProjectForProcess(raw, dirCache);
      projectByPid.set(pid, proj);
    }),
    6,
  );

  // Probe HTTP/HTTPS on listening TCP ports (optional, enabled by default)
  const shouldProbe = options?.probeHttp !== false;
  const webByGroupId = new Map<string, WebProbeInfo | undefined>();
  const buckets = Array.from(groupMap.values());

  if (shouldProbe) {
    const probeBuckets = buckets
      .filter((b) => b.protocol === 'TCP' && b.state === 'Listen' && b.port > 0)
      .slice(0, 60);

    await runWithConcurrency(
      probeBuckets.map((b) => async () => {
        const bindScope = determineBindScope(Array.from(b.localAddresses));
        const probe = await probeLocalWebService(b.port, bindScope, lanIps);
        webByGroupId.set(b.id, probe);
      }),
      8,
    );
  }

  const entries: PortEntry[] = buckets.map((bucket) => {
    const raw = snapshot.processes[String(bucket.pid)];
    const name = raw?.name ?? `PID ${bucket.pid}`;
    const isSelf =
      selfPids.has(bucket.pid) ||
      (raw?.commandLine?.toLowerCase().includes('portviewer') ?? false);
    const isCritical = isCriticalSystemProcess(bucket.pid, name);

    const processInfo: ProcessInfo = {
      pid: bucket.pid,
      name,
      displayName: raw?.fileDescription || raw?.productName || name,
      executablePath: raw?.executablePath ?? undefined,
      commandLine: raw?.commandLine ?? undefined,
      owner: raw?.owner ?? undefined,
      parentPid: raw?.parentPid ?? undefined,
      parentName: raw?.parentName ?? undefined,
      memoryMb:
        typeof raw?.memoryBytes === 'number'
          ? Math.round((raw.memoryBytes / (1024 * 1024)) * 10) / 10
          : undefined,
      cpuSeconds: raw?.cpuSeconds ?? undefined,
      startedAt: raw?.startedAt ?? undefined,
      uptimeLabel: formatUptime(raw?.startedAt),
      windowTitle: raw?.windowTitle ?? undefined,
      company: raw?.company ?? undefined,
      fileDescription: raw?.fileDescription ?? undefined,
      isSystemCritical: isCritical,
      isSelf,
    };

    const addresses = Array.from(bucket.localAddresses);
    const bindScope = determineBindScope(addresses);
    const project = projectByPid.get(bucket.pid);
    const web = webByGroupId.get(bucket.id);
    const { category, serviceHint } = classifyPort(
      bucket.port,
      processInfo,
      project,
      web,
      raw?.commandLine,
    );

    const remotePeers = establishedByPortPid.get(`${bucket.port}-${bucket.pid}`) ?? [];

    let canKill = true;
    let killBlockReason: string | undefined;
    if (isCritical) {
      canKill = false;
      killBlockReason = 'Proceso crítico de Windows protegido.';
    } else if (bucket.pid === process.pid) {
      canKill = false;
      killBlockReason = 'Es el servidor actual de PortViewer.';
    }

    return {
      id: bucket.id,
      port: bucket.port,
      protocol: bucket.protocol,
      state: bucket.state,
      localAddresses: addresses,
      bindScope,
      category,
      serviceHint,
      process: processInfo,
      project,
      web,
      activeConnectionsCount: remotePeers.length,
      remotePeers: remotePeers.slice(0, 25),
      canKill,
      killBlockReason,
    };
  });

  // Sort: Web & Dev first, then by port number ascending
  const categoryWeight: Record<PortCategory, number> = {
    web: 0,
    dev: 1,
    database: 2,
    other: 3,
    system: 4,
  };
  entries.sort((a, b) => {
    const catDiff = categoryWeight[a.category] - categoryWeight[b.category];
    if (catDiff !== 0) return catDiff;
    return a.port - b.port;
  });

  const userInfo = os.userInfo();
  const runtime: RuntimeInfo = {
    platform: process.platform,
    hostname: os.hostname(),
    username: userInfo.username,
    isVercel: false,
    isWindows: true,
    isLocalSupported: true,
    mode: 'live',
    portViewerPid: process.pid,
    localIps: lanIps,
    nodeVersion: process.version,
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startedAt,
  };

  return {
    runtime,
    entries,
    allSockets,
    stats: {
      totalListening: entries.length,
      totalWeb: entries.filter((e) => e.web?.isWeb).length,
      totalProjects: entries.filter((e) => Boolean(e.project)).length,
      totalEstablished: allSockets.filter((s) => s.state === 'Established').length,
      uniqueProcesses: new Set(entries.map((e) => e.process.pid)).size,
    },
  };
}
