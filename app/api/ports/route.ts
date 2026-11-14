import { connection, NextResponse, type NextRequest } from 'next/server';
import { scanLocalPorts } from '@/lib/port-scanner';

export async function GET(request: NextRequest) {
  await connection();

  const searchParams = request.nextUrl.searchParams;
  const probeParam = searchParams.get('probe');
  const demoParam = searchParams.get('demo');

  try {
    const data = await scanLocalPorts({
      probeHttp: probeParam !== '0',
      demo: demoParam === '1',
    });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido al escanear puertos.';
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
