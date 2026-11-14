#!/usr/bin/env bash
set -eu

cd -- "$(dirname -- "$0")/.."

viewer_url='http://127.0.0.1:4949'
viewer_log='.portviewer/launcher.log'

viewer_ready() {
    if command -v curl >/dev/null 2>&1; then
        local health
        health=$(curl -fsS --noproxy '*' --max-time 2 "$viewer_url/api/health" 2>/dev/null) || return 1
        [[ $health == *'"ok":true'* && $health == *'"app":"portviewer"'* ]]
        return $?
    fi

    node -e "
      fetch('$viewer_url/api/health', { signal: AbortSignal.timeout(2000) })
        .then((r) => r.json())
        .then((j) => process.exit(j && j.ok === true && j.app === 'portviewer' ? 0 : 1))
        .catch(() => process.exit(1));
    " >/dev/null 2>&1
}

if ! viewer_ready; then
    if ! command -v npm >/dev/null 2>&1 || [[ ! -f node_modules/next/dist/bin/next ]]; then
        printf '%s\n' 'Instala Node.js 20+ y ejecuta npm ci en la carpeta de PortViewer.' >&2
        exit 1
    fi

    mkdir -p -- .portviewer
    nohup npm run dev </dev/null >>"$viewer_log" 2>&1 &
    viewer_pid=$!
    deadline=$((SECONDS + 90))
    until viewer_ready; do
        if ! kill -0 "$viewer_pid" 2>/dev/null || (( SECONDS >= deadline )); then
            kill "$viewer_pid" 2>/dev/null || true
            printf 'PortViewer no está disponible. Revisa %s.\n' "$viewer_log" >&2
            exit 1
        fi
        sleep 1
    done
fi

printf 'PortViewer está listo en %s\n' "$viewer_url"
if [[ ${1:-} == '--no-browser' ]]; then
    exit 0
fi

case $(uname -s) in
    Darwin) browser_command=open ;;
    Linux) browser_command=xdg-open ;;
    *) exit 0 ;;
esac

if command -v "$browser_command" >/dev/null 2>&1; then
    "$browser_command" "$viewer_url" >/dev/null 2>&1 || true
fi
