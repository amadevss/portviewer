# PortViewer

Panel web local (con soporte PWA y lanzador en Windows) construido con **Next.js (App Router)** para visualizar qué puertos están ocupados en tu computadora, qué proceso y usuario los utiliza, qué proyecto está corriendo y abrir enlaces web o cerrar procesos rápidamente.

## Características

- **Escaneo completo de puertos TCP/UDP** (`netstat -ano` + PowerShell `Win32_Process`, `Get-Process` y `FileVersionInfo`).
- **Información detallada del proceso**: PID, proceso padre, usuario/sesión, ruta del ejecutable, línea de comandos completa, uso de RAM, tiempo de CPU, hora de inicio y tiempo activo.
- **Detección automática de proyectos**: identifica la carpeta raíz del proyecto y lee `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `.git/HEAD` para mostrar nombre, framework (`Next.js`, `Vite`, `React`, `Express`, `FastAPI`, etc.), rama Git y scripts.
- **Detección de servicios web (HTTP/HTTPS)**: sondea los puertos locales en escucha para mostrar código de estado, `<title>`, cabeceras (`Server`, `X-Powered-By`), latencia y un botón directo para abrir `http://localhost:<puerto>` (y la IP de red local si escucha en `0.0.0.0`).
- **PWA instalable**: incluye `app/manifest.ts`, iconos en `public/`, Service Worker (`public/portviewer-sw.js`) sin caché de datos privados y botón **Instalar app** en el encabezado.
- **Lanzador y acceso directo en Windows**: arranca en segundo plano en `http://127.0.0.1:4949` sin colisionar con el puerto `3000`.
- **Protecciones de seguridad**:
  - Bloquea peticiones de control (`kill`, `open`) que no provengan de `localhost`.
  - Protege procesos críticos de Windows y el propio servidor de PortViewer.

## Uso en local (Windows)

Inicia el servidor local en `http://127.0.0.1:4949`:

```bash
npm run dev
```

### Acceso directo en el Escritorio (estilo `cursordev`)

Para iniciar PortViewer en segundo plano con un doble clic desde tu Escritorio:

```bash
npm run shortcut
```

Esto crea `PortViewer.lnk` en tu Escritorio apuntando a `scripts/Start-PortViewer.ps1`.

## Despliegue en Vercel

Este repositorio está preparado para desplegarse en Vercel.  
Cuando se ejecuta en Vercel (`VERCEL=1`), al tratarse de un entorno serverless en la nube sin acceso a tu computadora local, PortViewer muestra automáticamente un aviso informativo y una vista de demostración de solo lectura.
