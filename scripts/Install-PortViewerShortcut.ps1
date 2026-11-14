param([switch]$Start)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'Start-PortViewer.ps1'
$desktop = [Environment]::GetFolderPath('DesktopDirectory')
if (!$desktop -or !(Test-Path -LiteralPath $desktop -PathType Container)) {
    throw 'No se encontró la carpeta Escritorio del usuario.'
}
if (!(Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "No se encontró el iniciador de PortViewer en $launcher."
}

$shortcutPath = Join-Path $desktop 'PortViewer.lnk'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoLogo -NoProfile -WindowStyle Hidden -File "{0}"' -f $launcher
$description = 'Iniciar y abrir PortViewer local'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if ((Test-Path -LiteralPath $shortcutPath) -and
    $shortcut.Description -ne $description -and
    ($shortcut.TargetPath -ne $powershell -or $shortcut.Arguments -ne $arguments)) {
    throw "Ya hay otro acceso directo en $shortcutPath. Cámbiale el nombre antes de instalar PortViewer."
}

$shortcut.TargetPath = $powershell
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $repository
$shortcut.Description = $description
$shortcut.IconLocation = '{0},0' -f (Join-Path $repository 'app\favicon.ico')
$shortcut.Save()
Write-Output $shortcutPath

if ($Start) { Start-Process -FilePath $shortcutPath }
