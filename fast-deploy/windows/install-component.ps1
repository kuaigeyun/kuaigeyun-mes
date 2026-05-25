# RiverEdge Windows component install (winget with MSI/exe fallback)
param(
    [Parameter(Mandatory)]
    [ValidateSet('node', 'python', 'uv', 'postgresql', 'caddy')]
    [string]$Component,
    [string]$UseMirror = '1',
    [string]$FastDeployDir = ''
)

$ErrorActionPreference = 'Stop'

if (-not $FastDeployDir) {
    $FastDeployDir = Split-Path $PSScriptRoot -Parent
}

function Write-Info([string]$Msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] INFO: $Msg" -ForegroundColor Blue
}

function Write-Ok([string]$Msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $Msg" -ForegroundColor Green
}

function Write-Err([string]$Msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $Msg" -ForegroundColor Red
    exit 1
}

function Resolve-WingetPath {
    $cmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe')
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }

    $windowsApps = Join-Path $env:ProgramFiles 'WindowsApps'
    if (Test-Path $windowsApps) {
        $found = Get-ChildItem $windowsApps -Filter 'winget.exe' -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
        if ($found) { return $found }
    }

    return $null
}

function Test-WingetSuccess([int]$ExitCode) {
    if ($ExitCode -eq 0) { return $true }
    if ($ExitCode -in @( -1978335189, -1978335212, 2316632107 )) { return $true }
    return $false
}

function Invoke-WingetInstall([string[]]$WingetArgs) {
    $winget = Resolve-WingetPath
    if (-not $winget) { return $false }
    Write-Info "run: $winget $($WingetArgs -join ' ')"
    & $winget @WingetArgs
    return (Test-WingetSuccess $LASTEXITCODE)
}

function Get-InstallTempDir {
    $dir = Join-Path $env:TEMP 'riveredge-install'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return $dir
}

function Get-NodeDistBase([bool]$Mirror) {
    if ($Mirror) { return 'https://npmmirror.com/mirrors/node' }
    return 'https://nodejs.org/dist'
}

function Install-Node {
    if (Invoke-WingetInstall @('-e', '--id', 'OpenJS.NodeJS.LTS', '--accept-package-agreements', '--accept-source-agreements')) {
        Write-Ok 'Node.js installed via winget'
        return
    }

    Write-Info 'winget unavailable, installing Node.js 22 via MSI...'
    $mirror = ($UseMirror -eq '1')
    $base = Get-NodeDistBase $mirror
    $arch = 'x64'
    $ver = $null

    try {
        $indexUrl = if ($mirror) { "$base/index.json" } else { 'https://nodejs.org/dist/index.json' }
        $index = Invoke-RestMethod -Uri $indexUrl -UseBasicParsing
        $entry = $index | Where-Object { $_.version -match '^v22\.' -and $_.lts } | Select-Object -First 1
        if (-not $entry) {
            $entry = $index | Where-Object { $_.version -match '^v22\.' } | Select-Object -First 1
        }
        if ($entry) { $ver = $entry.version.TrimStart('v') }
    } catch {
        Write-Info "node index fetch failed: $($_.Exception.Message)"
    }

    if (-not $ver) { $ver = '22.14.0' }

    $file = "node-v$ver-$arch.msi"
    $url = "$base/v$ver/$file"
    $tmpdir = Get-InstallTempDir
    $msi = Join-Path $tmpdir $file

    Write-Info "download: $url"
    Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing

    Write-Info 'silent MSI install...'
    $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $msi, '/qn', 'ADDLOCAL=ALL') -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Err "Node.js MSI failed (exit $($proc.ExitCode)). Manual: $url"
    }
    Write-Ok "Node.js $ver installed via MSI (reopen terminal to refresh PATH)"
}

function Get-PythonInstallerUrl([bool]$Mirror, [string]$Version = '3.12.9') {
    $file = "python-$Version-amd64.exe"
    if ($Mirror) {
        return "https://npmmirror.com/mirrors/python/$Version/$file", $file
    }
    return "https://www.python.org/ftp/python/$Version/$file", $file
}

function Install-Python {
    if (Invoke-WingetInstall @('-e', '--id', 'Python.Python.3.12', '--accept-package-agreements', '--accept-source-agreements')) {
        Write-Ok 'Python 3.12 installed via winget'
        return
    }

    Write-Info 'winget unavailable, installing Python 3.12 via official installer...'
    $mirror = ($UseMirror -eq '1')
    $url, $file = Get-PythonInstallerUrl $mirror
    $tmpdir = Get-InstallTempDir
    $exe = Join-Path $tmpdir $file

    Write-Info "download: $url"
    Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing

    Write-Info 'silent Python install...'
    $proc = Start-Process -FilePath $exe -ArgumentList @(
        '/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_test=0'
    ) -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Err "Python install failed (exit $($proc.ExitCode)). Manual: $url"
    }
    Write-Ok 'Python 3.12 installed (reopen terminal to refresh PATH)'
}

function Install-Uv {
    Write-Info 'installing uv via official script...'
    Invoke-Expression 'irm https://astral.sh/uv/install.ps1 | iex'
    Write-Ok 'uv installed'
}

function Install-Postgresql {
    if (Invoke-WingetInstall @('-e', '--id', 'PostgreSQL.PostgreSQL', '--accept-package-agreements', '--accept-source-agreements')) {
        Write-Ok 'PostgreSQL installed via winget'
        return
    }

    Write-Err @(
        'winget unavailable; cannot auto-install PostgreSQL.',
        'Options:',
        '  1) Install App Installer from Microsoft Store, then retry',
        '  2) Download from https://www.postgresql.org/download/windows/',
        '  3) Choose remote database in wizard stage 2 to skip local PG'
    ) -join [Environment]::NewLine
}

function Install-Caddy {
    if (Invoke-WingetInstall @('-e', '--id', 'CaddyServer.Caddy', '--accept-package-agreements', '--accept-source-agreements')) {
        Write-Ok 'Caddy installed via winget'
        return
    }

    Write-Info 'winget unavailable, downloading portable Caddy...'
    $apiUrl = 'https://api.github.com/repos/caddyserver/caddy/releases/latest'
    try {
        $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -Headers @{ 'User-Agent' = 'riveredge-fast-deploy' }
        $asset = $release.assets | Where-Object { $_.name -match 'windows_amd64\.zip$' } | Select-Object -First 1
        if (-not $asset) { throw 'windows_amd64.zip not found' }
        $url = $asset.browser_download_url
    } catch {
        $url = 'https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_windows_amd64.zip'
    }

    $toolsDir = Join-Path $FastDeployDir '.tools\caddy'
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $tmpdir = Get-InstallTempDir
    $zip = Join-Path $tmpdir 'caddy.zip'

    Write-Info "download: $url"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $toolsDir -Force

    $exe = Join-Path $toolsDir 'caddy.exe'
    if (-not (Test-Path $exe)) {
        Write-Err 'caddy.exe not found after extract'
    }
    Write-Ok "portable Caddy installed: $exe"
}

switch ($Component) {
    'node' { Install-Node }
    'python' { Install-Python }
    'uv' { Install-Uv }
    'postgresql' { Install-Postgresql }
    'caddy' { Install-Caddy }
}
