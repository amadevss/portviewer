export type PortCategory = 'web' | 'dev' | 'database' | 'system' | 'other';

export type BindScope = 'localhost' | 'network' | 'specific';

export interface ProjectInfo {
  name: string;
  path: string;
  framework?: string;
  version?: string;
  description?: string;
  packageManager?: string;
  gitBranch?: string;
  scripts?: Record<string, string>;
  markerFile: string;
}

export interface WebProbeInfo {
  isWeb: boolean;
  protocol: 'http' | 'https';
  url: string;
  lanUrls: string[];
  statusCode?: number;
  statusText?: string;
  title?: string;
  contentType?: string;
  serverHeader?: string;
  poweredBy?: string;
  redirectLocation?: string;
  responseTimeMs?: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  displayName: string;
  executablePath?: string;
  commandLine?: string;
  owner?: string;
  parentPid?: number;
  parentName?: string;
  memoryMb?: number;
  cpuSeconds?: number;
  startedAt?: string;
  uptimeLabel?: string;
  windowTitle?: string;
  company?: string;
  fileDescription?: string;
  isSystemCritical: boolean;
  isSelf: boolean;
}

export interface SocketConnection {
  protocol: 'TCP' | 'UDP';
  localAddress: string;
  localPort: number;
  remoteAddress?: string;
  remotePort?: number;
  state: string;
  pid: number;
  createdAt?: string;
}

export interface PortEntry {
  id: string;
  port: number;
  protocol: 'TCP' | 'UDP';
  state: string;
  localAddresses: string[];
  bindScope: BindScope;
  category: PortCategory;
  serviceHint?: string;
  process: ProcessInfo;
  project?: ProjectInfo;
  web?: WebProbeInfo;
  activeConnectionsCount: number;
  remotePeers: Array<{
    remoteAddress: string;
    remotePort: number;
    state: string;
  }>;
  canKill: boolean;
  killBlockReason?: string;
}

export interface RuntimeInfo {
  platform: string;
  hostname: string;
  username: string;
  isVercel: boolean;
  isWindows: boolean;
  isLocalSupported: boolean;
  mode: 'live' | 'cloud-readonly' | 'demo';
  portViewerPid: number;
  localIps: string[];
  nodeVersion: string;
  scannedAt: string;
  scanDurationMs: number;
  warning?: string;
}

export interface PortsApiResponse {
  runtime: RuntimeInfo;
  entries: PortEntry[];
  allSockets: SocketConnection[];
  stats: {
    totalListening: number;
    totalWeb: number;
    totalProjects: number;
    totalEstablished: number;
    uniqueProcesses: number;
  };
}
