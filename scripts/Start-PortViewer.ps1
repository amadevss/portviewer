param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$viewerUrl = 'http://127.0.0.1:4949'
$logDirectory = Join-Path $project '.portviewer'
$errorLog = Join-Path $logDirectory 'launcher-error.log'

function Test-PortViewerReady {
    try {
        $health = Invoke-RestMethod -Uri "$viewerUrl/api/health" -TimeoutSec 2
        return $health.ok -eq $true -and $health.app -eq 'portviewer'
    } catch {
        return $false
    }
}

function Find-NodeRuntime {
    $candidates = @(Get-Command node.exe -CommandType Application -All -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Source)
    $candidates += @(Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.InstallLocation 'dependencies\node\bin\node.exe' })

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $ver = (& $candidate --version) 2>$null
            if ($ver -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20) {
                return $candidate
            }
        }
    }
    throw 'PortViewer requiere Node.js 20 o superior. Instala Node.js y vuelve a abrir el acceso directo.'
}

$lock = [Threading.Mutex]::new($false, 'Local\PortViewer4949')
$hasLock = $false
try {
    try {
        $hasLock = $lock.WaitOne([TimeSpan]::FromSeconds(120))
    } catch [Threading.AbandonedMutexException] {
        $hasLock = $true
    }
    if (!$hasLock) { throw 'PortViewer sigue iniciando. Vuelve a intentar en unos segundos.' }

    if (!(Test-PortViewerReady)) {
        $nextCli = 'node_modules/next/dist/bin/next'
        if (!(Test-Path -LiteralPath (Join-Path $project $nextCli) -PathType Leaf)) {
            throw "Faltan las dependencias de PortViewer. Ejecuta npm ci en $project."
        }

        $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
        $server = $null
        if ($listeners.Port -notcontains 4949) {
            $node = Find-NodeRuntime
            $env:Path = (Split-Path -Parent $node) + [IO.Path]::PathSeparator + $env:Path
            New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
            $server = Start-Process -FilePath $node -ArgumentList @($nextCli, 'dev', '-H', '127.0.0.1', '-p', '4949') `
                -WorkingDirectory $project -WindowStyle Hidden -PassThru `
                -RedirectStandardOutput (Join-Path $logDirectory 'launcher.log') -RedirectStandardError $errorLog
        }

        $deadline = [DateTime]::UtcNow.AddSeconds(90)
        while (!(Test-PortViewerReady)) {
            if ($null -ne $server -and $server.HasExited) {
                throw "PortViewer se cerró durante el arranque. Revisa $errorLog."
            }
            if ([DateTime]::UtcNow -ge $deadline) {
                if ($null -eq $server) { throw 'El puerto 4949 está ocupado y PortViewer no responde.' }
                throw "PortViewer no respondió a tiempo. Revisa $errorLog."
            }
            Start-Sleep -Milliseconds 400
        }
    }

    if (!$NoBrowser) { Start-Process $viewerUrl }
} catch {
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName System.Windows.Forms
    [void][Windows.Forms.MessageBox]::Show($_.Exception.Message, 'PortViewer local', 'OK', 'Error')
    exit 1
} finally {
    if ($hasLock) { $lock.ReleaseMutex() }
    $lock.Dispose()
}
