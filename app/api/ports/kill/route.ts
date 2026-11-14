import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextResponse, type NextRequest } from 'next/server';
import { isCriticalSystemProcess, verifyLocalActionRequest } from '@/lib/security';

const execFileAsync = promisify(execFile);

interface KillRequestBody {
  pid?: unknown;
  processName?: unknown;
  includeTree?: unknown;
}

export async function POST(request: NextRequest) {
  const guard = verifyLocalActionRequest(request);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  if (process.platform !== 'win32') {
    return NextResponse.json(
      { error: 'La terminación de procesos está implementada solo para Windows local.' },
      { status: 400 },
    );
  }

  let body: KillRequestBody;
  try {
    body = (await request.json()) as KillRequestBody;
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido.' }, { status: 400 });
  }

  const pid = Number(body.pid);
  const processName = typeof body.processName === 'string' ? body.processName : undefined;
  const includeTree = body.includeTree === true;

  if (!Number.isInteger(pid) || pid <= 0) {
    return NextResponse.json({ error: 'PID inválido.' }, { status: 400 });
  }

  if (pid === process.pid) {
    return NextResponse.json(
      { error: 'No puedes cerrar el propio proceso de PortViewer desde la interfaz.' },
      { status: 400 },
    );
  }

  if (isCriticalSystemProcess(pid, processName)) {
    return NextResponse.json(
      { error: 'Proceso crítico de Windows protegido: operación rechazada por seguridad.' },
      { status: 403 },
    );
  }

  // Verify the current process name on the OS before killing
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-Process -Id ${pid} -ErrorAction Stop).ProcessName`,
      ],
      { timeout: 4000, windowsHide: true },
    );
    const actualName = `${stdout.trim()}.exe`;
    if (isCriticalSystemProcess(pid, actualName)) {
      return NextResponse.json(
        { error: `El PID ${pid} (${actualName}) es un proceso crítico protegido.` },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: `El proceso con PID ${pid} ya no existe o no es accesible.` },
      { status: 404 },
    );
  }

  try {
    const args = includeTree
      ? ['/PID', String(pid), '/T', '/F']
      : ['/PID', String(pid), '/F'];
    const { stdout, stderr } = await execFileAsync('taskkill', args, {
      timeout: 6000,
      windowsHide: true,
    });

    return NextResponse.json({
      ok: true,
      pid,
      includeTree,
      message: stdout.trim() || stderr.trim() || `Proceso PID ${pid} terminado correctamente.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `No se pudo terminar el proceso PID ${pid}.`;
    return NextResponse.json(
      {
        error: `${message}. Si es un servicio o proceso elevado, ejecuta tu terminal como Administrador.`,
      },
      { status: 500 },
    );
  }
}
