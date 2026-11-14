'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortCategory, PortEntry, PortsApiResponse } from '@/lib/types';
import {
  AlertIcon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FolderIcon,
  GlobeIcon,
  InfoIcon,
  PowerIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  TerminalIcon,
} from './icons';
import { PortDetailDrawer } from './port-detail-drawer';
import { usePortViewerInstall } from './usePortViewerInstall';

type TabFilter = 'all' | 'web' | 'dev' | 'database' | 'system' | 'raw';
type ProtocolFilter = 'ALL' | 'TCP' | 'UDP';
type SortOption = 'smart' | 'port-asc' | 'memory-desc' | 'project-asc' | 'process-asc';

interface ToastState {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const CATEGORY_BADGE: Record<
  PortCategory,
  { label: string; className: string }
> = {
  web: {
    label: 'Web',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  dev: {
    label: 'Dev',
    className: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  database: {
    label: 'Base de datos',
    className: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
  system: {
    label: 'Sistema',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  other: {
    label: 'Otro',
    className: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/50',
  },
};

export function PortDashboard() {
  const [data, setData] = useState<PortsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabFilter>('all');
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('smart');
  const [probeHttp, setProbeHttp] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(10);

  const [selectedEntry, setSelectedEntry] = useState<PortEntry | null>(null);
  const [killTarget, setKillTarget] = useState<PortEntry | null>(null);
  const [killIncludeTree, setKillIncludeTree] = useState(true);
  const [killingPid, setKillingPid] = useState<number | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const installation = usePortViewerInstall();

  const showToast = useCallback((type: ToastState['type'], message: string) => {
    const id = Date.now();
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  const fetchPorts = useCallback(
    async (silent = false) => {
      if (!silent) {
        setRefreshing(true);
      }
      try {
        const params = new URLSearchParams();
        params.set('probe', probeHttp ? '1' : '0');
        if (demoMode) params.set('demo', '1');

        const res = await fetch(`/api/ports?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = (await res.json()) as PortsApiResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Error HTTP ${res.status}`);
        }
        setData(json);
        setError(null);

        setSelectedEntry((prev) => {
          if (!prev) return null;
          return json.entries.find((e) => e.id === prev.id) ?? prev;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo consultar /api/ports';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [probeHttp, demoMode],
  );

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    params.set('probe', probeHttp ? '1' : '0');
    if (demoMode) params.set('demo', '1');

    fetch(`/api/ports?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json()) as PortsApiResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Error HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
        setSelectedEntry((prev) => {
          if (!prev) return null;
          return json.entries.find((e) => e.id === prev.id) ?? prev;
        });
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'No se pudo consultar /api/ports';
        setError(msg);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [probeHttp, demoMode]);

  useEffect(() => {
    if (autoRefreshSec <= 0) return;
    const timer = setInterval(() => {
      void fetchPorts(true);
    }, autoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshSec, fetchPorts]);

  const handleCopy = useCallback(
    async (label: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedKey(`${label}:${value}`);
        showToast('success', `${label} copiado al portapapeles`);
        setTimeout(() => setCopiedKey(null), 1500);
      } catch {
        showToast('error', 'No se pudo copiar al portapapeles');
      }
    },
    [showToast],
  );

  const handleOpenFolder = useCallback(
    async (targetPath: string, action: 'explorer' | 'vscode') => {
      try {
        const res = await fetch('/api/ports/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetPath, action }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          throw new Error(json.error || 'No se pudo abrir la carpeta');
        }
        showToast(
          'success',
          action === 'vscode' ? 'Abriendo proyecto en VS Code…' : 'Abriendo carpeta en Explorador…',
        );
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Error al abrir ruta');
      }
    },
    [showToast],
  );

  const openKillModal = useCallback((entry: PortEntry) => {
    setKillTarget(entry);
    setKillIncludeTree(entry.category === 'web' || entry.category === 'dev');
  }, []);

  const handleConfirmKill = useCallback(async () => {
    if (!killTarget) return;
    const target = killTarget;
    setKillingPid(target.process.pid);

    try {
      const res = await fetch('/api/ports/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pid: target.process.pid,
          processName: target.process.name,
          includeTree: killIncludeTree,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo terminar el proceso');
      }
      showToast('success', json.message || `Proceso PID ${target.process.pid} cerrado.`);
      setKillTarget(null);
      if (selectedEntry?.process.pid === target.process.pid) {
        setSelectedEntry(null);
      }
      setTimeout(() => {
        void fetchPorts(false);
      }, 350);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al cerrar proceso');
    } finally {
      setKillingPid(null);
    }
  }, [killTarget, killIncludeTree, selectedEntry, fetchPorts, showToast]);

  const isLiveLocal = data?.runtime.mode === 'live' && data?.runtime.isLocalSupported;

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();

    const list = data.entries.filter((entry) => {
      if (protocolFilter !== 'ALL' && entry.protocol !== protocolFilter) return false;

      if (tab === 'web' && !entry.web?.isWeb && entry.category !== 'web') return false;
      if (tab === 'dev' && entry.category !== 'dev' && entry.category !== 'web' && !entry.project) {
        return false;
      }
      if (tab === 'database' && entry.category !== 'database') return false;
      if (tab === 'system' && entry.category !== 'system') return false;

      if (!q) return true;

      const haystack = [
        String(entry.port),
        entry.protocol,
        entry.process.name,
        entry.process.displayName,
        String(entry.process.pid),
        entry.process.owner,
        entry.process.commandLine,
        entry.process.executablePath,
        entry.project?.name,
        entry.project?.path,
        entry.project?.framework,
        entry.web?.title,
        entry.web?.url,
        entry.serviceHint,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });

    const sorted = [...list];
    if (sortBy === 'port-asc') {
      sorted.sort((a, b) => a.port - b.port);
    } else if (sortBy === 'memory-desc') {
      sorted.sort((a, b) => (b.process.memoryMb ?? -1) - (a.process.memoryMb ?? -1));
    } else if (sortBy === 'project-asc') {
      sorted.sort((a, b) =>
        (a.project?.name ?? a.serviceHint ?? a.process.name).localeCompare(
          b.project?.name ?? b.serviceHint ?? b.process.name,
        ),
      );
    } else if (sortBy === 'process-asc') {
      sorted.sort((a, b) => a.process.name.localeCompare(b.process.name));
    }
    return sorted;
  }, [data, protocolFilter, tab, search, sortBy]);

  const filteredRawSockets = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const processByPid = new Map(data.entries.map((e) => [e.process.pid, e.process]));

    return data.allSockets
      .filter((sock) => {
        if (protocolFilter !== 'ALL' && sock.protocol !== protocolFilter) return false;
        if (!q) return true;
        const proc = processByPid.get(sock.pid);
        return (
          String(sock.localPort).includes(q) ||
          String(sock.remotePort ?? '').includes(q) ||
          sock.localAddress.toLowerCase().includes(q) ||
          (sock.remoteAddress ?? '').toLowerCase().includes(q) ||
          sock.state.toLowerCase().includes(q) ||
          String(sock.pid).includes(q) ||
          (proc?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 300);
  }, [data, protocolFilter, search]);

  const processByPid = useMemo(() => {
    const map = new Map<number, PortEntry>();
    if (!data) return map;
    for (const entry of data.entries) {
      if (!map.has(entry.process.pid)) {
        map.set(entry.process.pid, entry);
      }
    }
    return map;
  }, [data]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/90 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-sky-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <TerminalIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                  PortViewer
                </h1>
                {data?.runtime.mode === 'live' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Local · {data.runtime.hostname}
                  </span>
                )}
                {data?.runtime.mode === 'cloud-readonly' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Vercel Cloud · Solo lectura
                  </span>
                )}
                {data?.runtime.mode === 'demo' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    Modo Demo
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Puertos activos, procesos, proyectos locales y control rápido
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Probe HTTP Toggle */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={probeHttp}
                onChange={(e) => setProbeHttp(e.target.checked)}
                className="accent-emerald-500 rounded cursor-pointer"
              />
              Detectar Web (HTTP)
            </label>

            {/* Demo Toggle */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="accent-sky-500 rounded cursor-pointer"
              />
              Demo
            </label>

            {/* Auto-refresh */}
            <select
              value={autoRefreshSec}
              onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              aria-label="Intervalo de auto-actualización"
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value={0}>Auto: Off</option>
              <option value={3}>Auto: 3s</option>
              <option value={5}>Auto: 5s</option>
              <option value={10}>Auto: 10s</option>
              <option value={30}>Auto: 30s</option>
            </select>

            <button
              type="button"
              onClick={() => void fetchPorts(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            {installation.installed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-emerald-300">
                <CheckIcon className="w-3.5 h-3.5" />
                PWA instalada
              </span>
            ) : (
              <button
                type="button"
                aria-expanded={installation.showHelp}
                onClick={() => void installation.install()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
              >
                Instalar app
              </button>
            )}
          </div>
        </div>
        {installation.showHelp && !installation.installed && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <p className="text-xs text-zinc-300 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2">
              Si tu navegador no muestra el cuadro de instalación automática, abre el menú del
              navegador (Chrome o Edge) y elige <strong>Instalar PortViewer</strong> o{' '}
              <strong>Guardar y compartir → Instalar página como aplicación</strong>.
            </p>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Cloud / Warning Banner */}
        {data?.runtime.warning && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-100/90 space-y-1">
              <p className="font-medium text-amber-200">{data.runtime.warning}</p>
              {data.runtime.isVercel && (
                <p className="text-xs text-amber-200/80">
                  En esta vista de Vercel se muestran datos de ejemplo para que puedas revisar la
                  interfaz. En tu PC ejecuta{' '}
                  <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-amber-100">
                    npm run dev:viewer
                  </code>{' '}
                  (puerto <code className="font-mono">4949</code>) para inspeccionar y controlar
                  tus puertos reales.
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-rose-200">
              <AlertIcon className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchPorts(false)}
              className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-xs text-rose-100 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* KPI Summary */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
              tab === 'all'
                ? 'border-zinc-600 bg-zinc-900'
                : 'border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900'
            }`}
          >
            <div className="text-xs text-zinc-400">Puertos abiertos</div>
            <div className="mt-1 text-2xl font-semibold font-mono text-white">
              {data?.stats.totalListening ?? '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">TCP Listen + UDP</div>
          </button>

          <button
            type="button"
            onClick={() => setTab('web')}
            className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
              tab === 'web'
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900'
            }`}
          >
            <div className="text-xs text-emerald-400 flex items-center gap-1.5">
              <GlobeIcon className="w-3.5 h-3.5" />
              Servicios Web
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-emerald-300">
              {data?.stats.totalWeb ?? '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">Con enlace al navegador</div>
          </button>

          <button
            type="button"
            onClick={() => setTab('dev')}
            className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
              tab === 'dev'
                ? 'border-sky-500/50 bg-sky-950/20'
                : 'border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900'
            }`}
          >
            <div className="text-xs text-sky-400 flex items-center gap-1.5">
              <FolderIcon className="w-3.5 h-3.5" />
              Proyectos detectados
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono text-sky-300">
              {data?.stats.totalProjects ?? '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">Carpeta + framework</div>
          </button>

          <button
            type="button"
            onClick={() => setTab('raw')}
            className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
              tab === 'raw'
                ? 'border-zinc-600 bg-zinc-900'
                : 'border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900'
            }`}
          >
            <div className="text-xs text-zinc-400">Conexiones activas</div>
            <div className="mt-1 text-2xl font-semibold font-mono text-zinc-100">
              {data?.stats.totalEstablished ?? '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">Estado Established</div>
          </button>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-3.5 col-span-2 sm:col-span-1">
            <div className="text-xs text-zinc-400">Procesos únicos</div>
            <div className="mt-1 text-2xl font-semibold font-mono text-zinc-100">
              {data?.stats.uniqueProcesses ?? '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {data ? `Escaneo en ${data.runtime.scanDurationMs} ms` : '—'}
            </div>
          </div>
        </section>

        {/* Controls & Filters */}
        <section className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', 'Todos en escucha'],
                  ['web', 'Servicios Web'],
                  ['dev', 'Proyectos / Dev'],
                  ['database', 'Bases de datos'],
                  ['system', 'Sistema'],
                  ['raw', 'Sockets (Raw)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    tab === key
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Protocol & Sort */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                {(['ALL', 'TCP', 'UDP'] as const).map((proto) => (
                  <button
                    key={proto}
                    type="button"
                    onClick={() => setProtocolFilter(proto)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                      protocolFilter === proto
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {proto === 'ALL' ? 'Todos' : proto}
                  </button>
                ))}
              </div>

              {tab !== 'raw' && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Ordenar resultados"
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  <option value="smart">Orden: Web/Dev primero</option>
                  <option value="port-asc">Orden: Puerto ↑</option>
                  <option value="memory-desc">Orden: Memoria RAM ↓</option>
                  <option value="project-asc">Orden: Proyecto A-Z</option>
                  <option value="process-asc">Orden: Proceso A-Z</option>
                </select>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por puerto (ej. 3000), proyecto, proceso (node.exe), título web, usuario o comando…"
              className="w-full pl-10 pr-20 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/60"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </section>

        {/* Main Content */}
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
            Escaneando puertos y procesos locales…
          </div>
        ) : tab === 'raw' ? (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>Mostrando {filteredRawSockets.length} sockets individuales</span>
              <span className="font-mono">TCP + UDP</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 bg-zinc-900/60">
                    <th className="py-2.5 px-4">Proto</th>
                    <th className="py-2.5 px-4">Local</th>
                    <th className="py-2.5 px-4">Remoto</th>
                    <th className="py-2.5 px-4">Estado</th>
                    <th className="py-2.5 px-4">PID</th>
                    <th className="py-2.5 px-4">Proceso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 text-xs font-mono">
                  {filteredRawSockets.map((sock, idx) => {
                    const entry = processByPid.get(sock.pid);
                    return (
                      <tr
                        key={`${sock.protocol}-${sock.localAddress}-${sock.localPort}-${sock.remotePort}-${sock.pid}-${idx}`}
                        className="hover:bg-zinc-900/60"
                      >
                        <td className="py-2 px-4 text-zinc-300">{sock.protocol}</td>
                        <td className="py-2 px-4 text-emerald-300">
                          {sock.localAddress}:{sock.localPort}
                        </td>
                        <td className="py-2 px-4 text-zinc-400">
                          {sock.remoteAddress ? `${sock.remoteAddress}:${sock.remotePort ?? 0}` : '—'}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              sock.state === 'Listen'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : sock.state === 'Established'
                                  ? 'bg-sky-500/15 text-sky-300'
                                  : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {sock.state}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-zinc-300">{sock.pid}</td>
                        <td className="py-2 px-4 font-sans text-zinc-200">
                          {entry?.process.name ?? `PID ${sock.pid}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-200">
              No hay puertos que coincidan con el filtro actual.
            </p>
            <p className="text-xs text-zinc-400">
              Prueba limpiando la búsqueda o cambiando la pestaña a &ldquo;Todos en escucha&rdquo;.
            </p>
          </div>
        ) : (
          <section className="space-y-2.5">
            {filteredEntries.map((entry) => {
              const cat = CATEGORY_BADGE[entry.category];
              const webUrl = entry.web?.url ?? `http://localhost:${entry.port}`;
              const folderTarget = entry.project?.path ?? entry.process.executablePath;
              const copyCmdKey = `Cmd:${entry.process.commandLine ?? ''}`;

              return (
                <article
                  key={entry.id}
                  className={`rounded-xl border transition-colors p-4 ${
                    entry.process.isSelf
                      ? 'border-sky-500/35 bg-sky-950/15'
                      : 'border-zinc-800/90 bg-zinc-900/45 hover:border-zinc-700 hover:bg-zinc-900/75'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Port + Project/Service + Process */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Port Column */}
                      <div className="shrink-0 w-24">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-mono text-white">
                            :{entry.port}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {entry.protocol}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cat.className}`}
                          >
                            {cat.label}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[11px] text-zinc-500 font-mono truncate">
                          {entry.bindScope === 'network'
                            ? '0.0.0.0 (Red)'
                            : entry.bindScope === 'localhost'
                              ? '127.0.0.1'
                              : entry.localAddresses[0]}
                        </div>
                      </div>

                      {/* Middle Info */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Top title line */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                            {entry.project?.name ||
                              entry.web?.title ||
                              entry.serviceHint ||
                              entry.process.displayName}
                          </h3>

                          {entry.project?.framework && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25">
                              {entry.project.framework}
                            </span>
                          )}

                          {entry.web?.isWeb && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                              HTTP {entry.web.statusCode}
                              {entry.web.responseTimeMs !== undefined &&
                                ` · ${entry.web.responseTimeMs}ms`}
                            </span>
                          )}

                          {entry.category === 'database' && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                              <DatabaseIcon className="w-3 h-3" />
                              {entry.serviceHint}
                            </span>
                          )}

                          {entry.process.isSelf && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30">
                              Este panel
                            </span>
                          )}

                          {entry.process.isSystemCritical && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                              <ShieldIcon className="w-3 h-3" />
                              Sistema protegido
                            </span>
                          )}
                        </div>

                        {/* Web URL / Title */}
                        {entry.web?.isWeb && (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <a
                              href={webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-emerald-400 hover:text-emerald-300 hover:underline"
                            >
                              <GlobeIcon className="w-3.5 h-3.5" />
                              {webUrl}
                            </a>
                            {entry.web.title && (
                              <span className="text-zinc-400 truncate max-w-md">
                                — {entry.web.title}
                              </span>
                            )}
                            {entry.web.lanUrls.length > 0 && (
                              <span className="text-[11px] font-mono text-zinc-500">
                                (LAN: {entry.web.lanUrls[0]})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Project Path */}
                        {entry.project && (
                          <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-300">
                            <span className="inline-flex items-center gap-1 font-mono text-zinc-400 truncate max-w-xl">
                              <FolderIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              {entry.project.path}
                            </span>
                            {entry.project.gitBranch && (
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                git:{entry.project.gitBranch}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Process metadata line */}
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-zinc-400">
                          <span>
                            Proceso:{' '}
                            <strong className="text-zinc-200 font-mono">
                              {entry.process.name}
                            </strong>
                          </span>
                          <span className="font-mono">PID: {entry.process.pid}</span>
                          {entry.process.owner && (
                            <span className="truncate max-w-xs">
                              Usuario: <span className="text-zinc-300">{entry.process.owner}</span>
                            </span>
                          )}
                          {entry.process.memoryMb !== undefined && (
                            <span className="font-mono">RAM: {entry.process.memoryMb} MB</span>
                          )}
                          {entry.process.uptimeLabel && (
                            <span>Activo: {entry.process.uptimeLabel}</span>
                          )}
                          {entry.process.parentName && (
                            <span className="text-zinc-500">
                              Padre: {entry.process.parentName}
                            </span>
                          )}
                          {entry.activeConnectionsCount > 0 && (
                            <span className="text-sky-300">
                              {entry.activeConnectionsCount} conexión(es)
                            </span>
                          )}
                        </div>

                        {/* Command Line preview */}
                        {entry.process.commandLine && (
                          <p className="text-[11px] font-mono text-zinc-500 truncate max-w-3xl">
                            {entry.process.commandLine}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-wrap lg:shrink-0">
                      {entry.web?.isWeb && (
                        <a
                          href={webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors"
                        >
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                          Abrir web
                        </a>
                      )}

                      {entry.web?.isWeb && (
                        <button
                          type="button"
                          onClick={() => void handleCopy('URL', webUrl)}
                          title="Copiar URL local"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors cursor-pointer"
                        >
                          {copiedKey === `URL:${webUrl}` ? (
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                          URL
                        </button>
                      )}

                      {isLiveLocal && entry.project?.path && (
                        <button
                          type="button"
                          onClick={() => void handleOpenFolder(entry.project!.path, 'vscode')}
                          title="Abrir carpeta del proyecto en VS Code"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors cursor-pointer"
                        >
                          <CodeIcon className="w-3.5 h-3.5 text-sky-400" />
                          VS Code
                        </button>
                      )}

                      {isLiveLocal && folderTarget && (
                        <button
                          type="button"
                          onClick={() => void handleOpenFolder(folderTarget, 'explorer')}
                          title="Abrir carpeta en el Explorador de Windows"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors cursor-pointer"
                        >
                          <FolderIcon className="w-3.5 h-3.5" />
                          Carpeta
                        </button>
                      )}

                      {!entry.web?.isWeb && entry.process.commandLine && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopy('Comando', entry.process.commandLine!)
                          }
                          title="Copiar línea de comandos"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors cursor-pointer"
                        >
                          {copiedKey === copyCmdKey ? (
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                          Cmd
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors cursor-pointer"
                      >
                        <InfoIcon className="w-3.5 h-3.5" />
                        Detalles
                      </button>

                      {isLiveLocal ? (
                        <button
                          type="button"
                          disabled={!entry.canKill}
                          onClick={() => openKillModal(entry)}
                          title={
                            entry.canKill
                              ? `Cerrar proceso PID ${entry.process.pid}`
                              : entry.killBlockReason
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 disabled:opacity-35 disabled:hover:bg-rose-600/20 text-xs font-medium text-rose-300 border border-rose-500/30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <PowerIcon className="w-3.5 h-3.5" />
                          Cerrar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* Footer info */}
      <footer className="border-t border-zinc-900 py-4 px-4 sm:px-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            PortViewer · Panel local para inspeccionar puertos, procesos y proyectos web
          </span>
          {data && (
            <span className="font-mono">
              Último escaneo: {new Date(data.runtime.scannedAt).toLocaleTimeString()} · Node{' '}
              {data.runtime.nodeVersion}
              {data.runtime.localIps.length > 0
                ? ` · LAN: ${data.runtime.localIps.join(', ')}`
                : ''}
            </span>
          )}
        </div>
      </footer>

      {/* Detail Slide-over */}
      <PortDetailDrawer
        entry={selectedEntry}
        isLiveLocal={Boolean(isLiveLocal)}
        onClose={() => setSelectedEntry(null)}
        onCopy={(label, value) => void handleCopy(label, value)}
        onOpenFolder={(targetPath, action) => void handleOpenFolder(targetPath, action)}
        onRequestKill={(entry) => openKillModal(entry)}
      />

      {/* Kill Confirmation Modal */}
      {killTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <PowerIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  ¿Cerrar el proceso del puerto :{killTarget.port}?
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Se terminará{' '}
                  <strong className="text-zinc-200 font-mono">{killTarget.process.name}</strong>{' '}
                  (PID <span className="font-mono">{killTarget.process.pid}</span>)
                  {killTarget.project ? ` del proyecto "${killTarget.project.name}"` : ''}.
                </p>
              </div>
            </div>

            {killTarget.process.commandLine && (
              <pre className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
                {killTarget.process.commandLine}
              </pre>
            )}

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={killIncludeTree}
                onChange={(e) => setKillIncludeTree(e.target.checked)}
                className="mt-0.5 accent-rose-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">
                <strong className="block text-zinc-100">
                  Incluir subprocesos (árbol completo /T)
                </strong>
                Recomendado para servidores iniciados con npm, pnpm, Next.js o Vite para evitar
                procesos huérfanos.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKillTarget(null)}
                disabled={killingPid !== null}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmKill()}
                disabled={killingPid !== null}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-xs font-medium text-white cursor-pointer"
              >
                {killingPid !== null ? 'Cerrando…' : 'Sí, cerrar proceso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/40 text-rose-200'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
