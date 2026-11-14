'use client';

import { useEffect } from 'react';
import type { PortEntry } from '@/lib/types';
import {
  CloseIcon,
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  FolderIcon,
  GlobeIcon,
  PowerIcon,
  ShieldIcon,
} from './icons';

interface PortDetailDrawerProps {
  entry: PortEntry | null;
  isLiveLocal: boolean;
  onClose: () => void;
  onCopy: (label: string, value: string) => void;
  onOpenFolder: (targetPath: string, action: 'explorer' | 'vscode') => void;
  onRequestKill: (entry: PortEntry) => void;
}

function DetailRow({
  label,
  value,
  mono = false,
  onCopy,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  onCopy?: () => void;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-zinc-800/70 last:border-b-0">
      <span className="text-xs text-zinc-400 shrink-0 pt-0.5">{label}</span>
      <div className="flex items-start gap-2 min-w-0 justify-end">
        <span
          className={`text-xs text-zinc-100 text-right break-all ${
            mono ? 'font-mono' : ''
          }`}
        >
          {String(value)}
        </span>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            title={`Copiar ${label}`}
            className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 mt-0.5 cursor-pointer"
          >
            <CopyIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function PortDetailDrawer({
  entry,
  isLiveLocal,
  onClose,
  onCopy,
  onOpenFolder,
  onRequestKill,
}: PortDetailDrawerProps) {
  useEffect(() => {
    if (!entry) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entry, onClose]);

  if (!entry) return null;

  const fallbackWebUrl = `http://localhost:${entry.port}`;
  const webUrl = entry.web?.url ?? fallbackWebUrl;
  const folderTarget = entry.project?.path ?? entry.process.executablePath;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-sm font-semibold">
                :{entry.port}
              </span>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {entry.protocol} · {entry.state}
              </span>
              {entry.process.isSelf && (
                <span className="text-xs px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Este panel
                </span>
              )}
              {entry.process.isSystemCritical && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <ShieldIcon className="w-3 h-3" />
                  Protegido
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-zinc-100 truncate">
              {entry.project?.name || entry.web?.title || entry.serviceHint || entry.process.name}
            </h2>
            <p className="text-xs text-zinc-400 truncate">
              {entry.process.displayName} (PID {entry.process.pid})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Cerrar detalle"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            {(entry.web?.isWeb || entry.protocol === 'TCP') && (
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                {entry.web?.isWeb ? `Abrir ${webUrl}` : `Probar ${webUrl}`}
              </a>
            )}
            <button
              type="button"
              onClick={() => onCopy('URL local', webUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              Copiar URL
            </button>
            {isLiveLocal && folderTarget && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenFolder(folderTarget, 'explorer')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  <FolderIcon className="w-3.5 h-3.5" />
                  Abrir carpeta
                </button>
                {entry.project?.path && (
                  <button
                    type="button"
                    onClick={() => onOpenFolder(entry.project!.path, 'vscode')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  >
                    <CodeIcon className="w-3.5 h-3.5" />
                    Abrir en VS Code
                  </button>
                )}
              </>
            )}
            {isLiveLocal && entry.canKill && (
              <button
                type="button"
                onClick={() => onRequestKill(entry)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer ml-auto"
              >
                <PowerIcon className="w-3.5 h-3.5" />
                Cerrar proceso
              </button>
            )}
          </div>

          {/* Web Probe Section */}
          {entry.web && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
                <GlobeIcon className="w-4 h-4" />
                Servicio Web Detectado
              </div>
              <DetailRow
                label="URL Principal"
                value={entry.web.url}
                mono
                onCopy={() => onCopy('URL', entry.web!.url)}
              />
              {entry.web.lanUrls.length > 0 && (
                <DetailRow
                  label="URLs en red local (LAN)"
                  value={entry.web.lanUrls.join(', ')}
                  mono
                  onCopy={() => onCopy('URL LAN', entry.web!.lanUrls[0])}
                />
              )}
              <DetailRow
                label="Estado HTTP"
                value={
                  entry.web.statusCode
                    ? `${entry.web.statusCode} ${entry.web.statusText ?? ''}`.trim()
                    : undefined
                }
              />
              <DetailRow label="Título (<title>)" value={entry.web.title} />
              <DetailRow label="Content-Type" value={entry.web.contentType} mono />
              <DetailRow label="Server" value={entry.web.serverHeader} mono />
              <DetailRow label="X-Powered-By" value={entry.web.poweredBy} mono />
              <DetailRow label="Redirección" value={entry.web.redirectLocation} mono />
              <DetailRow
                label="Latencia local"
                value={
                  entry.web.responseTimeMs !== undefined
                    ? `${entry.web.responseTimeMs} ms`
                    : undefined
                }
              />
            </section>
          )}

          {/* Project Section */}
          {entry.project && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-3">
                <FolderIcon className="w-4 h-4" />
                Proyecto Detectado
              </div>
              <DetailRow label="Nombre" value={entry.project.name} />
              <DetailRow
                label="Ruta del proyecto"
                value={entry.project.path}
                mono
                onCopy={() => onCopy('Ruta del proyecto', entry.project!.path)}
              />
              <DetailRow label="Framework / Stack" value={entry.project.framework} />
              <DetailRow label="Versión" value={entry.project.version} mono />
              <DetailRow label="Package Manager" value={entry.project.packageManager} />
              <DetailRow label="Rama Git" value={entry.project.gitBranch} mono />
              <DetailRow label="Archivo detector" value={entry.project.markerFile} mono />
              {entry.project.scripts && Object.keys(entry.project.scripts).length > 0 && (
                <div className="pt-3 mt-2 border-t border-zinc-800/70">
                  <p className="text-xs text-zinc-400 mb-2">Scripts disponibles:</p>
                  <div className="space-y-1.5">
                    {Object.entries(entry.project.scripts).map(([scriptName, cmd]) => (
                      <div
                        key={scriptName}
                        className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 px-2.5 py-1.5 border border-zinc-800/80"
                      >
                        <span className="text-xs font-mono text-sky-300">{scriptName}</span>
                        <span className="text-xs font-mono text-zinc-400 truncate">{cmd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Process Info */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-3">
              Datos del Proceso
            </div>
            <DetailRow
              label="PID"
              value={entry.process.pid}
              mono
              onCopy={() => onCopy('PID', String(entry.process.pid))}
            />
            <DetailRow label="Nombre" value={entry.process.name} mono />
            <DetailRow label="Descripción" value={entry.process.displayName} />
            <DetailRow label="Usuario / Propietario" value={entry.process.owner} mono />
            <DetailRow
              label="Proceso padre"
              value={
                entry.process.parentPid
                  ? `${entry.process.parentName ?? 'Desconocido'} (PID ${entry.process.parentPid})`
                  : undefined
              }
              mono
            />
            <DetailRow
              label="Memoria RAM"
              value={
                entry.process.memoryMb !== undefined ? `${entry.process.memoryMb} MB` : undefined
              }
            />
            <DetailRow
              label="Tiempo de CPU"
              value={
                entry.process.cpuSeconds !== undefined ? `${entry.process.cpuSeconds}s` : undefined
              }
            />
            <DetailRow
              label="Activo desde"
              value={
                entry.process.startedAt
                  ? `${new Date(entry.process.startedAt).toLocaleString()} (${entry.process.uptimeLabel ?? ''})`
                  : undefined
              }
            />
            <DetailRow label="Título de ventana" value={entry.process.windowTitle} />
            <DetailRow label="Empresa / Autor" value={entry.process.company} />
            <DetailRow
              label="Ejecutable"
              value={entry.process.executablePath}
              mono
              onCopy={
                entry.process.executablePath
                  ? () => onCopy('Ruta ejecutable', entry.process.executablePath!)
                  : undefined
              }
            />
            {entry.process.commandLine && (
              <div className="pt-3 mt-2 border-t border-zinc-800/70">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400">Línea de comandos completa</span>
                  <button
                    type="button"
                    onClick={() => onCopy('Comando', entry.process.commandLine!)}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    Copiar
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 whitespace-pre-wrap break-all">
                  {entry.process.commandLine}
                </pre>
              </div>
            )}
          </section>

          {/* Network Info */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-3">
              Red y Sockets
            </div>
            <DetailRow label="Puerto local" value={entry.port} mono />
            <DetailRow label="Protocolo" value={entry.protocol} mono />
            <DetailRow label="Estado" value={entry.state} mono />
            <DetailRow label="Direcciones escuchando" value={entry.localAddresses.join(', ')} mono />
            <DetailRow
              label="Alcance"
              value={
                entry.bindScope === 'network'
                  ? 'Red local / Todas las interfaces (0.0.0.0 / ::)'
                  : entry.bindScope === 'localhost'
                    ? 'Solo localhost (127.0.0.1 / ::1)'
                    : 'Interfaz específica'
              }
            />
            <DetailRow
              label="Conexiones activas en este puerto"
              value={entry.activeConnectionsCount}
            />

            {entry.remotePeers.length > 0 && (
              <div className="pt-3 mt-2 border-t border-zinc-800/70">
                <p className="text-xs text-zinc-400 mb-2">Peers conectados actualmente:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {entry.remotePeers.map((peer, idx) => (
                    <div
                      key={`${peer.remoteAddress}-${peer.remotePort}-${idx}`}
                      className="flex items-center justify-between text-xs font-mono bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-800/80"
                    >
                      <span className="text-zinc-200">
                        {peer.remoteAddress}:{peer.remotePort}
                      </span>
                      <span className="text-emerald-400">{peer.state}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
