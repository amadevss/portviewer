# PortViewer

Panel web local (con **PWA instalable** y lanzador nativo para Windows) construido con **Next.js 16 (App Router)**, **React 19**, **TypeScript** y **Tailwind CSS v4** para inspeccionar en tiempo real los puertos ocupados en tu computadora, saber exactamente qué proceso y usuario los utiliza, detectar qué proyecto está corriendo, abrir servicios web en el navegador y cerrar procesos de forma segura.

---

## Tabla de contenidos

- [Funcionalidades principales](#funcionalidades-principales)
- [Interfaz y controles del Dashboard](#interfaz-y-controles-del-dashboard)
- [Iconos y configuración PWA](#iconos-y-configuración-pwa)
- [Lanzador multiplataforma y acceso directo en Escritorio](#lanzador-multiplataforma-y-acceso-directo-en-escritorio)
- [API Routes](#api-routes)
- [Seguridad y protecciones](#seguridad-y-protecciones)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Comportamiento en Vercel](#comportamiento-en-vercel)

---

## Funcionalidades principales

1. **Escaneo completo de puertos TCP y UDP en Windows**
   - Combina `netstat -ano` para listar todos los sockets locales (`Listen`, `Bound`, `Established`, `TimeWait`, `CloseWait`, etc.) con consultas PowerShell sobre `Win32_Process`, `Get-Process` y `System.Diagnostics.FileVersionInfo`.
   - Agrupa automáticamente interfaces duplicadas IPv4/IPv6 (`0.0.0.0` + `::` o `127.0.0.1` + `::1`) por puerto y PID, indicando si el alcance es solo `localhost` o accesible en la red local (`network`).

2. **Inspección profunda de procesos**
   - Muestra **PID**, **nombre del proceso**, **descripción del binario**, **empresa/autor**, **proceso padre** (nombre y PID), **usuario/sesión propietaria**, **uso de memoria RAM (MB)**, **tiempo de CPU**, **hora de inicio y tiempo activo (uptime)**, **título de ventana**, **ruta del ejecutable** y **línea de comandos completa**.

3. **Detección automática de proyectos y frameworks**
   - Analiza las rutas presentes en la línea de comandos del proceso y del proceso padre (subiendo desde `node_modules` o `.venv` si aplica) para localizar la raíz del proyecto mediante archivos marcadores:
     - `package.json`: extrae nombre, versión, gestor de paquetes (`pnpm`, `yarn`, `bun`, `npm`), `scripts` y detecta el framework (`Next.js`, `Vite`, `Vite + React`, `Vite + Vue`, `Nuxt`, `Astro`, `Remix`, `NestJS`, `Create React App`, `React`, `Express`, `Fastify`, `Hono`, `Electron`).
     - `pyproject.toml`, `manage.py`, `requirements.txt` (Python / Django).
     - `Cargo.toml` (Rust), `go.mod` (Go), `pom.xml` / `build.gradle` (Java).
   - Lee `.git/HEAD` para mostrar la rama Git actual del proyecto.

4. **Detección inteligente de servicios Web (HTTP/HTTPS)**
   - Sondea localmente los puertos TCP en escucha (omitiendo puertos binarios conocidos de Windows y bases de datos) para verificar si responden HTTP/HTTPS.
   - Extrae código de estado HTTP, `<title>` de la página, `Content-Type`, cabeceras `Server` / `X-Powered-By`, redirecciones y latencia en milisegundos.
   - Genera el enlace directo `http://localhost:<puerto>` (o `https://`) y muestra URLs de red local (LAN) cuando escucha en `0.0.0.0` o `::`.

5. **Clasificación automática por categoría**
   - **Web**: servicios con respuesta HTTP/HTTPS o el propio panel de PortViewer.
   - **Dev**: runtimes y herramientas de desarrollo (`node`, `python`, `java`, `docker`, `ruby`, `go`, `dotnet`, `php`) o proyectos detectados.
   - **Base de datos**: PostgreSQL (`5432`), MySQL/MariaDB (`3306`), Redis (`6379`), MongoDB (`27017`), SQL Server (`1433`), Oracle (`1521`), Elasticsearch (`9200`), etc.
   - **Sistema**: servicios críticos de Windows (`135`, `445`, `3389`, `svchost.exe`, `System`, etc.).
   - **Otro**: resto de procesos en escucha.

---

## Interfaz y controles del Dashboard

- **Tarjetas KPI interactivas**: total de puertos abiertos, servicios web, proyectos detectados, conexiones activas (`Established`) y procesos únicos + tiempo de escaneo.
- **Pestañas de filtrado**: `Todos en escucha`, `Servicios Web`, `Proyectos / Dev`, `Bases de datos`, `Sistema` y `Sockets (Raw)` (vista de tabla con todos los sockets individuales TCP/UDP).
- **Filtros y ordenamiento**:
  - Filtro de protocolo (`Todos`, `TCP`, `UDP`).
  - Buscador en tiempo real por puerto, proyecto, proceso, PID, usuario, título web o línea de comandos.
  - Ordenamiento: `Web/Dev primero`, `Puerto ↑`, `Memoria RAM ↓`, `Proyecto A-Z`, `Proceso A-Z`.
- **Controles superiores**:
  - `Detectar Web (HTTP)`: activa/desactiva el sondeo HTTP local.
  - `Demo`: previsualiza datos de ejemplo sin tocar procesos reales.
  - `Auto`: intervalo de auto-refresco (`Off`, `3s`, `5s`, `10s`, `30s`; por defecto `10s`).
  - `Actualizar`: recarga manual inmediata.
  - `Instalar app` / `PWA instalada`: instala o indica el estado de la Progressive Web App.
- **Acciones por puerto y panel de detalle (`PortDetailDrawer`)**:
  - **Abrir web** en nueva pestaña (`http://localhost:<puerto>`).
  - **Copiar** URL, PID, ruta del proyecto, ruta del ejecutable o línea de comandos.
  - **Abrir en VS Code** (`code <ruta>`) o **Carpeta** en el Explorador de Windows.
  - **Detalles**: panel deslizable con toda la metadata de red, HTTP, scripts de `package.json`, proceso y peers conectados.
  - **Cerrar**: modal de confirmación con opción **Incluir subprocesos (árbol completo `/T`)**, recomendada para servidores iniciados con `npm`, `pnpm`, `Next.js` o `Vite`.

---

## Iconos y configuración PWA

PortViewer puede instalarse como aplicación de escritorio (Chrome / Edge) o móvil en modo `standalone` sin barra de navegador:

| Archivo | Propósito | Tamaño / Detalle |
| --- | --- | --- |
| `app/manifest.ts` | Web App Manifest (`/manifest.webmanifest`) | `display: "standalone"`, `theme_color: "#09090b"`, `background_color: "#09090b"` |
| `public/portviewer-icon-192.png` | Icono estándar PWA | `192×192` PNG (`purpose: "any"`) |
| `public/portviewer-icon-512.png` | Icono alta resolución PWA | `512×512` PNG (`purpose: "any"`) |
| `public/portviewer-icon-maskable-512.png` | Icono adaptable (maskable) | `512×512` PNG (`purpose: "maskable"`) |
| `public/portviewer-apple-icon.png` | Apple Touch Icon | `180×180` PNG |
| `app/favicon.ico` | Favicon e icono del acceso directo `.lnk` | Icono de escritorio/pestaña |
| `public/portviewer-sw.js` | Service Worker minimalista | Muestra página offline si el servidor local está apagado; **no cachea `/api/`** |
| `components/PortViewerServiceWorker.tsx` | Registro del Service Worker | Se registra en contextos seguros (`127.0.0.1`, `localhost`, HTTPS) |
| `components/usePortViewerInstall.ts` | Hook de instalación PWA | Gestiona `beforeinstallprompt`, `appinstalled` y `display-mode: standalone` |
| `components/icons.tsx` | Iconos vectoriales de la UI | Iconos SVG inline (`Refresh`, `Globe`, `ExternalLink`, `Folder`, `Code`, `Power`, `Copy`, `Check`, `Search`, `Info`, `Shield`, `Database`, `Terminal`, `Close`, `Alert`) |

Además, [next.config.ts](next.config.ts) sirve `/portviewer-sw.js` con `Cache-Control: no-cache, no-store, must-revalidate` y `Content-Security-Policy: default-src 'self'`.

---

## Lanzador multiplataforma y acceso directo en Escritorio

PortViewer corre por defecto en **`http://127.0.0.1:4949`** para no colisionar con el puerto `3000` o `5173` de tus proyectos.

### Arranque manual o en segundo plano

```bash
# Modo desarrollo interactivo en consola
npm run dev

# Lanzador automático en segundo plano (Windows, macOS y Linux)
npm run launch
```

Luego abre [http://127.0.0.1:4949](http://127.0.0.1:4949).

### Acceso directo autoejecutable en el Escritorio (todos los sistemas)

```bash
npm run shortcut
```

El comando `npm run shortcut` ejecuta `scripts/install-shortcut.mjs` y detecta tu sistema operativo automáticamente:

- **Windows** (`scripts/Install-PortViewerShortcut.ps1` / `npm run shortcut:win`):
  - Crea **`PortViewer.lnk`** en tu Escritorio apuntando a `scripts/Start-PortViewer.ps1`.
  - Usa el Mutex `Local\PortViewer4949`, verifica `GET http://127.0.0.1:4949/api/health`, arranca el servidor oculto en segundo plano con Node.js 20+ guardando logs en `.portviewer/` y abre el navegador.
- **macOS** (`scripts/install-portviewer-shortcut.sh` / `npm run shortcut:unix`):
  - Crea la app autoejecutable **`~/Desktop/PortViewer.app`** (`Contents/MacOS/PortViewer`, `Info.plist`, icono en `Contents/Resources/`).
  - Al hacer doble clic ejecuta `scripts/start-portviewer.sh` en segundo plano (`nohup`) sin dejar una terminal abierta, espera a `/api/health` y abre el navegador con `open`.
- **Linux** (`scripts/install-portviewer-shortcut.sh` / `npm run shortcut:unix`):
  - Crea **`PortViewer.desktop`** en tu carpeta de Escritorio (`xdg-user-dir DESKTOP`, `~/Desktop` o `~/Escritorio`) y lo copia en `~/.local/share/applications/PortViewer.desktop`.
  - Incluye permisos de ejecución (`chmod 755`), marca de confianza GNOME (`gio set ... metadata::trusted true`), icono `public/portviewer-icon-512.png`, y ejecuta `scripts/start-portviewer.sh` abriendo el navegador con `xdg-open`.

También puedes pasar `--start` (`npm run shortcut -- --start`) para crear el acceso directo y lanzarlo inmediatamente, o `--no-browser` (`npm run launch -- --no-browser`) para iniciar solo el servidor.

---

## API Routes

| Ruta | Método | Descripción |
| --- | --- | --- |
| `/api/ports` | `GET` | Escanea puertos TCP/UDP, procesos, proyectos y servicios web. Soporta `?probe=1\|0` y `?demo=1`. |
| `/api/ports/kill` | `POST` | Cierra un proceso por `pid` (`{ pid, processName?, includeTree? }`) usando `taskkill`. |
| `/api/ports/open` | `POST` | Abre `targetPath` en el Explorador de Windows o VS Code (`{ targetPath, action: "explorer" \| "vscode" }`). |
| `/api/health` | `GET` | Devuelve `{ ok: true, app: "portviewer", pid, isVercel, nodeVersion }` para el lanzador local. |

---

## Seguridad y protecciones

- **Restricción estricta a `localhost`**: `verifyLocalActionRequest` en [lib/security.ts](lib/security.ts) valida las cabeceras `Host` y `Origin` en `/api/ports/kill` y `/api/ports/open` para rechazar peticiones que no provengan de `localhost`, `127.0.0.1` o `::1`.
- **Protección de procesos críticos**: bloquea la terminación de PID `<= 4`, procesos críticos de Windows (`System`, `Idle`, `smss.exe`, `csrss.exe`, `wininit.exe`, `services.exe`, `lsass.exe`, `winlogon.exe`, `svchost.exe`, `dwm.exe`, etc.) y del propio servidor de PortViewer (`process.pid`).
- **Sin acceso en la nube**: todas las acciones de control devuelven `403` si `VERCEL=1`.
- **Robots**: [app/robots.ts](app/robots.ts) deshabilita el rastreo sobre `/api/`.

---

## Estructura del proyecto

```text
PortViewer/
├── app/
│   ├── api/
│   │   ├── health/route.ts         # Healthcheck del servidor local
│   │   └── ports/
│   │       ├── route.ts            # GET /api/ports
│   │       ├── kill/route.ts       # POST /api/ports/kill
│   │       └── open/route.ts       # POST /api/ports/open
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx                  # Metadata, Viewport y Apple Web App
│   ├── manifest.ts                 # Manifest PWA
│   ├── page.tsx                    # Entrada principal + registro SW
│   └── robots.ts                   # Reglas para buscadores
├── components/
│   ├── icons.tsx                   # Iconos SVG inline
│   ├── port-dashboard.tsx          # Dashboard principal interactivo
│   ├── port-detail-drawer.tsx      # Panel lateral de inspección detallada
│   ├── PortViewerServiceWorker.tsx # Registro cliente del Service Worker
│   └── usePortViewerInstall.ts     # Hook para instalar la PWA
├── lib/
│   ├── demo-data.ts                # Datos de ejemplo para Vercel / Modo Demo
│   ├── port-scanner.ts             # Escáner Windows + detección de proyectos + HTTP probe
│   ├── security.ts                 # Validación localhost y procesos protegidos
│   └── types.ts                    # Tipos TypeScript compartidos
├── public/
│   ├── portviewer-apple-icon.png
│   ├── portviewer-icon-192.png
│   ├── portviewer-icon-512.png
│   ├── portviewer-icon-maskable-512.png
│   └── portviewer-sw.js            # Service Worker
├── scripts/
│   ├── install-portviewer-shortcut.sh # Acceso directo en macOS y Linux
│   ├── install-shortcut.mjs           # Instalador multiplataforma de acceso directo
│   ├── Install-PortViewerShortcut.ps1 # Acceso directo en Windows (.lnk)
│   ├── start-local.mjs                # Lanzador multiplataforma en segundo plano
│   ├── start-portviewer.sh            # Lanzador en macOS y Linux
│   └── Start-PortViewer.ps1           # Lanzador en Windows
├── .gitattributes
├── next.config.ts
└── package.json
```

---

## Scripts disponibles

| Comando | Acción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo en `http://127.0.0.1:4949` |
| `npm run dev:viewer` | Alias explícito para desarrollo en `127.0.0.1:4949` |
| `npm run build` | Genera la compilación de producción (`next build`) |
| `npm run start` | Inicia la compilación de producción en `http://127.0.0.1:4949` |
| `npm run start:viewer` | Alias explícito para producción en `127.0.0.1:4949` |
| `npm run lint` | Ejecuta ESLint (`eslint`) |
| `npm run typecheck` | Verifica tipos con TypeScript (`tsc --noEmit`) |
| `npm run launch` | Inicia PortViewer en segundo plano y abre el navegador (Windows, macOS y Linux) |
| `npm run shortcut` | Crea el acceso directo autoejecutable en el Escritorio (Windows, macOS y Linux) |
| `npm run shortcut:win` | Crea el acceso directo `.lnk` en Windows |
| `npm run shortcut:unix` | Crea el acceso directo `.app` (macOS) o `.desktop` (Linux) |

---

## Comportamiento en Vercel

Este repositorio se puede desplegar en **Vercel** para consultar la interfaz o compartir una vista previa. Sin embargo, al ejecutarse en un contenedor serverless en la nube (`VERCEL=1`), Vercel **no tiene acceso a los puertos ni a los procesos de tu computadora local**. En ese entorno, PortViewer muestra automáticamente un aviso informativo y carga datos de demostración de solo lectura.
