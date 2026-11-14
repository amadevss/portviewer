const offlinePage = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#09090b">
  <title>PortViewer no disponible</title>
  <style>
    html { color-scheme: dark; background: #09090b; color: #f4f4f5; }
    body { margin: 0; min-height: 100svh; display: grid; place-items: center; font: 1rem/1.6 system-ui, sans-serif; }
    main { max-width: 30rem; padding: 2rem; border: 1px solid #27272a; border-radius: 1rem; background: #18181b; }
    h1 { margin: 0 0 .5rem; line-height: 1.25; font-size: 1.25rem; }
    p { margin: 0 0 1rem; color: #a1a1aa; font-size: .95rem; }
    code { padding: .15rem .4rem; border-radius: .35rem; background: #09090b; color: #6ee7b7; font-size: .88rem; }
    a { display: inline-block; color: #34d399; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <h1>PortViewer local no está iniciado</h1>
    <p>Inicia el servidor local con el acceso directo de PortViewer o ejecuta <code>npm run dev</code> en la carpeta del proyecto y vuelve a intentar.</p>
    <a href="/">Volver a intentar</a>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate' || request.destination !== 'document') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname !== '/') return;

  // Never cache /api/ responses or live system port data.
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(offlinePage, {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': 'noindex',
          },
        }),
    ),
  );
});
