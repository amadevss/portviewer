import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyLocalActionRequest } from '@/lib/security';

const execFileAsync = promisify(execFile);

interface OpenRequestBody {
  targetPath?: unknown;
  action?: unknown;
}

export async function POST(request: NextRequest) {
  const guard = verifyLocalActionRequest(request);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  if (process.platform !== 'win32') {
    return NextResponse.json(
      { error: 'Esta acción solo está disponible en Windows local.' },
      { status: 400 },
    );
  }

  let body: OpenRequestBody;
  try {
    body = (await request.json()) as OpenRequestBody;
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido.' }, { status: 400 });
  }

  if (typeof body.targetPath !== 'string' || !body.targetPath.trim()) {
    return NextResponse.json({ error: 'Ruta inválida.' }, { status: 400 });
  }

  const resolvedPath = path.resolve(body.targetPath.trim());
  const action = body.action === 'vscode' ? 'vscode' : 'explorer';

  try {
    const stat = await fs.stat(resolvedPath);
    const folderToOpen = stat.isDirectory() ? resolvedPath : path.dirname(resolvedPath);

    if (action === 'vscode') {
      await execFileAsync('cmd.exe', ['/c', 'code', folderToOpen], {
        timeout: 4000,
        windowsHide: true,
      });
    } else {
      // explorer.exe often exits with code 1 even when opening the window successfully
      try {
        await execFileAsync('explorer.exe', [folderToOpen], {
          timeout: 4000,
          windowsHide: false,
        });
      } catch {
        // explorer.exe returns non-zero exit code on normal launches
      }
    }

    return NextResponse.json({
      ok: true,
      opened: folderToOpen,
      action,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo abrir la ruta especificada.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
