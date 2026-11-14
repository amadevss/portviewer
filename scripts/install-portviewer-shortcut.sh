#!/usr/bin/env bash
set -eu

repo_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
launcher="$repo_dir/scripts/start-portviewer.sh"

if [[ ! -f "$launcher" ]]; then
    printf 'No se encontró %s\n' "$launcher" >&2
    exit 1
fi

chmod +x "$launcher"

os_name=$(uname -s)

if [[ "$os_name" == "Darwin" ]]; then
    desktop_dir="$HOME/Desktop"
    mkdir -p -- "$desktop_dir"
    app_dir="$desktop_dir/PortViewer.app"
    macos_dir="$app_dir/Contents/MacOS"
    resources_dir="$app_dir/Contents/Resources"

    mkdir -p -- "$macos_dir" "$resources_dir"

    cat >"$app_dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>es</string>
  <key>CFBundleExecutable</key>
  <string>PortViewer</string>
  <key>CFBundleIdentifier</key>
  <string>local.portviewer.app</string>
  <key>CFBundleName</key>
  <string>PortViewer</string>
  <key>CFBundleDisplayName</key>
  <string>PortViewer</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST

    cat >"$macos_dir/PortViewer" <<EOF
#!/usr/bin/env bash
export PATH="/opt/homebrew/bin:/usr/local/bin:\$PATH"
exec /usr/bin/env bash "$launcher"
EOF
    chmod 755 "$macos_dir/PortViewer"

    if [[ -f "$repo_dir/public/portviewer-icon-512.png" ]]; then
        cp "$repo_dir/public/portviewer-icon-512.png" "$resources_dir/portviewer-icon-512.png"
    fi

    printf '%s\n' "$app_dir"
    if [[ ${1:-} == '--start' ]]; then
        open "$app_dir"
    fi
elif [[ "$os_name" == "Linux" ]]; then
    desktop_dir=""
    if command -v xdg-user-dir >/dev/null 2>&1; then
        desktop_dir=$(xdg-user-dir DESKTOP 2>/dev/null || true)
    fi
    if [[ -z "$desktop_dir" || ! -d "$desktop_dir" ]]; then
        if [[ -d "$HOME/Desktop" ]]; then
            desktop_dir="$HOME/Desktop"
        elif [[ -d "$HOME/Escritorio" ]]; then
            desktop_dir="$HOME/Escritorio"
        else
            desktop_dir="$HOME/Desktop"
            mkdir -p -- "$desktop_dir"
        fi
    fi

    desktop_file="$desktop_dir/PortViewer.desktop"
    icon_path="$repo_dir/public/portviewer-icon-512.png"

    cat >"$desktop_file" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=PortViewer
GenericName=Inspector de Puertos Locales
Comment=Iniciar y abrir PortViewer local en http://127.0.0.1:4949
Exec=bash "$launcher"
Path=$repo_dir
Icon=$icon_path
Terminal=false
Categories=Development;Utility;
StartupNotify=true
DESKTOP
    chmod 755 "$desktop_file"

    if command -v gio >/dev/null 2>&1; then
        gio set "$desktop_file" metadata::trusted true 2>/dev/null || true
    fi

    apps_dir="$HOME/.local/share/applications"
    if [[ -d "$HOME/.local/share" ]]; then
        mkdir -p -- "$apps_dir"
        cp "$desktop_file" "$apps_dir/PortViewer.desktop"
        chmod 755 "$apps_dir/PortViewer.desktop"
    fi

    printf '%s\n' "$desktop_file"
    if [[ ${1:-} == '--start' ]]; then
        bash "$launcher"
    fi
else
    printf 'Sistema operativo no soportado por este script bash: %s\n' "$os_name" >&2
    exit 1
fi
