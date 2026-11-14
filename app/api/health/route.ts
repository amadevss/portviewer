import { connection, NextResponse } from 'next/server';

export async function GET() {
  await connection();

  return NextResponse.json(
    {
      ok: true,
      app: 'portviewer',
      pid: process.pid,
      isVercel: process.env.VERCEL === '1',
      nodeVersion: process.version,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
