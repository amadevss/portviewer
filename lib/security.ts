import type { NextRequest } from 'next/server';

const CRITICAL_SYSTEM_PROCESSES = new Set([
  'system',
  'idle',
  'system idle process',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
  'lsm.exe',
  'winlogon.exe',
  'svchost.exe',
  'dwm.exe',
  'fontdrvhost.exe',
  'memory compression',
  'registry',
  'secure system',
]);

export function isCriticalSystemProcess(pid: number, processName?: string): boolean {
  if (pid <= 4) return true;
  if (!processName) return false;
  return CRITICAL_SYSTEM_PROCESSES.has(processName.trim().toLowerCase());
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '0.0.0.0'
  );
}

export function verifyLocalActionRequest(request: NextRequest): {
  allowed: boolean;
  reason?: string;
} {
  if (process.env.VERCEL === '1') {
    return {
      allowed: false,
      reason:
        'Esta acción no está disponible en Vercel (entorno cloud). Ejecuta PortViewer en tu PC local para controlar procesos.',
    };
  }

  const hostHeader = request.headers.get('host') ?? '';
  const hostWithoutPort = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];

  if (!hostWithoutPort || !isLocalHostname(hostWithoutPort)) {
    return {
      allowed: false,
      reason: `Acción bloqueada por seguridad: solo se permiten peticiones locales (host recibido: "${hostHeader}").`,
    };
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!isLocalHostname(originUrl.hostname)) {
        return {
          allowed: false,
          reason: `Acción bloqueada por seguridad: origen externo no autorizado (${origin}).`,
        };
      }
    } catch {
      return {
        allowed: false,
        reason: 'Acción bloqueada: cabecera Origin inválida.',
      };
    }
  }

  return { allowed: true };
}
