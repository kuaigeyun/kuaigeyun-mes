# RiverEdge Windows component install (winget with MSI/exe fallback + CN backup mirrors)
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

function Get-UniqueUrls([string[]]$Urls) {
    $seen = @{}
    $result = @()
    foreach ($url in $Urls) {
        if ([string]::IsNullOrWhiteSpace($url)) { continue }
        if ($seen.ContainsKey($url)) { continue }
        $seen[$url] = $true
        $result += $url
    }
    return $result
}

function Invoke-DownloadWithFallback([string[]]$Urls, [string]$Dest) {
    foreach ($url in (Get-UniqueUrls $Urls)) {
        try {
            Write-Info "download: $url"
            Invoke-WebRequest -Uri $url -OutFile $Dest -UseBasicParsing
            return $true
        } catch {
            Write-Info "download failed ($url): $($_.Exception.Message)"
        }
    }
    return $false
}

function Invoke-RestWithFallback([string[]]$Urls, [hashtable]$Headers = @{}) {
    if (-not $Headers.ContainsKey('User-Agent')) {
        $Headers['User-Agent'] = 'riveredge-fast-deploy'
    }
    foreach ($url in (Get-UniqueUrls $Urls)) {
        try {
            Write-Info "fetch: $url"
            return Invoke-RestMethod -Uri $url -UseBasicParsing -Headers $Headers
        } catch {
            Write-Info "fetch failed ($url): $($_.Exception.Message)"
        }
    }
    return $null
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

function Ensure-WingetBackupSource([string]$Name, [string]$Url) {
    $winget = Resolve-WingetPath
    if (-not $winget) { return $false }
    $list = & $winget source list 2>$null
    if ($list -match [regex]::Escape($Name)) { return $true }
    Write-Info "adding winget backup source: $Name"
    & $winget source add --name $Name --arg $Url --accept-source-agreements 2>$null | Out-Null
    return (Test-WingetSuccess $LASTEXITCODE)
}

function Invoke-WingetInstall([string[]]$WingetArgs) {
    $winget = Resolve-WingetPath
    if (-not $winget) { return $false }
    Write-Info "run: $winget $($WingetArgs -join ' ')"
    & $winget @WingetArgs
    return (Test-WingetSuccess $LASTEXITCODE)
}

function Invoke-WingetInstallVerified([string[]]$WingetArgs, [scriptblock]$VerifyFn) {
    if (Invoke-WingetInstall $WingetArgs) {
        if (& $VerifyFn) { return $true }
        Write-Info 'winget reported success but component not detected, trying fallback...'
    }

    $backupSources = @(
        @{ Name = 'winget-ustc'; Url = 'https://mirrors.ustc.edu.cn/winget-source' },
        @{ Name = 'winget-bfsu'; Url = 'https://mirrors.bfsu.edu.cn/winget-source' }
    )
    foreach ($src in $backupSources) {
        if (-not (Ensure-WingetBackupSource $src.Name $src.Url)) { continue }
        $argsWithSource = @('--source', $src.Name) + $WingetArgs
        if (Invoke-WingetInstall $argsWithSource) {
            if (& $VerifyFn) { return $true }
            Write-Info "winget ($($src.Name)) reported success but component not detected"
        }
    }

    return $false
}

function Get-InstallTempDir {
    $dir = Join-Path $env:TEMP 'riveredge-install'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return $dir
}

function Test-NodeReady {
    $toolsNode = Join-Path $FastDeployDir '.tools\node\node.exe'
    if (Test-Path $toolsNode) { return $true }
    foreach ($p in @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
    )) {
        if (Test-Path $p) { return $true }
    }
    return ($null -ne (Get-Command node -ErrorAction SilentlyContinue))
}

function Test-PythonReady {
    foreach ($c in @('python3.12', 'python3', 'python', 'py')) {
        if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { continue }
        $out = if ($c -eq 'py') { & py -3.12 --version 2>&1 } else { & $c --version 2>&1 }
        if ($out -match '3\.(1[2-9]|[2-9]\d)\.') { return $true }
    }
    foreach ($p in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe')
    )) {
        if (Test-Path $p) { return $true }
    }
    $pyRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
    if (Test-Path $pyRoot) {
        foreach ($dir in Get-ChildItem $pyRoot -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue) {
            if (Test-Path (Join-Path $dir.FullName 'python.exe')) { return $true }
        }
    }
    return $false
}

function Test-UvReady {
    if (Get-Command uv -ErrorAction SilentlyContinue) { return $true }
    foreach ($p in @(
        "$env:USERPROFILE\.local\bin\uv.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts\uv.exe"
    )) {
        if (Test-Path $p) { return $true }
    }
    return $false
}

function Test-PostgresqlReady {
    foreach ($p in @(
        "$env:ProgramFiles\PostgreSQL\15\bin\psql.exe",
        "$env:ProgramFiles\PostgreSQL\16\bin\psql.exe",
        "$env:ProgramFiles\PostgreSQL\17\bin\psql.exe",
        "$env:ProgramFiles\PostgreSQL\18\bin\psql.exe"
    )) {
        if (Test-Path $p) { return $true }
    }
    $svc = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
    return ($null -ne $svc)
}

function Test-CaddyReady {
    $bundled = Join-Path $FastDeployDir '.tools\caddy\caddy.exe'
    if (Test-Path $bundled) { return $true }
    return ($null -ne (Get-Command caddy -ErrorAction SilentlyContinue))
}

function Get-NodeDistBases([bool]$Mirror) {
    $official = 'https://nodejs.org/dist'
    $cn = @(
        'https://npmmirror.com/mirrors/node',
        'https://mirrors.huaweicloud.com/nodejs',
        'https://mirrors.tuna.tsinghua.edu.cn/nodejs-release'
    )
    if ($Mirror) {
        return Get-UniqueUrls @($cn[0]) + @($official) + $cn[1..($cn.Length - 1)]
    }
    return Get-UniqueUrls @($official) + $cn
}

function Get-NodeReleaseVersion([bool]$Mirror) {
    $indexUrls = @()
    foreach ($base in (Get-NodeDistBases $Mirror)) {
        $indexUrls += if ($base -match 'nodejs\.org') {
            'https://nodejs.org/dist/index.json'
        } else {
            "$base/index.json"
        }
    }
    foreach ($indexUrl in (Get-UniqueUrls $indexUrls)) {
        try {
            $index = Invoke-RestWithFallback @($indexUrl)
            if (-not $index) { continue }
            $entry = $index | Where-Object { $_.version -match '^v22\.' -and $_.lts } | Select-Object -First 1
            if (-not $entry) {
                $entry = $index | Where-Object { $_.version -match '^v22\.' } | Select-Object -First 1
            }
            if ($entry) { return $entry.version.TrimStart('v') }
        } catch {
            Write-Info "node index fetch failed ($indexUrl): $($_.Exception.Message)"
        }
    }
    return '22.14.0'
}

function Get-NodeMsiUrls([string]$Ver, [bool]$Mirror) {
    $file = "node-v$Ver-x64.msi"
    $rel = "v$Ver/$file"
    $urls = @()
    foreach ($base in (Get-NodeDistBases $Mirror)) {
        $urls += "$base/$rel"
    }
    return Get-UniqueUrls $urls
}

function Get-NodeZipUrls([string]$Ver, [bool]$Mirror) {
    $folder = "node-v$Ver-win-x64"
    $file = "$folder.zip"
    $rel = "v$Ver/$file"
    $urls = @()
    foreach ($base in (Get-NodeDistBases $Mirror)) {
        $urls += "$base/$rel"
    }
    return Get-UniqueUrls $urls
}

function Install-NodeMsi([string]$Ver, [bool]$Mirror) {
    $file = "node-v$Ver-x64.msi"
    $tmpdir = Get-InstallTempDir
    $msi = Join-Path $tmpdir $file

    if (-not (Invoke-DownloadWithFallback (Get-NodeMsiUrls $Ver $Mirror) $msi)) {
        return $false
    }

    $argSets = @(
        @('/i', $msi, '/qn', 'ADDLOCAL=ALL', 'ALLUSERS=2', 'MSIINSTALLPERUSER=1'),
        @('/i', $msi, '/qn', 'ADDLOCAL=ALL')
    )
    foreach ($args in $argSets) {
        Write-Info "MSI install: $($args -join ' ')"
        $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $args -Wait -PassThru
        if ($proc.ExitCode -eq 0) { return $true }
        Write-Info "MSI exit $($proc.ExitCode) (1603 = permission/conflict; will try next method)"
    }
    return $false
}

function Install-NodePortable([string]$Ver, [bool]$Mirror) {
    $folder = "node-v$Ver-win-x64"
    $file = "$folder.zip"
    $tmpdir = Get-InstallTempDir
    $zip = Join-Path $tmpdir $file
    $extract = Join-Path $tmpdir 'node-extract'
    $toolsDir = Join-Path $FastDeployDir '.tools\node'

    if (-not (Invoke-DownloadWithFallback (Get-NodeZipUrls $Ver $Mirror) $zip)) {
        throw 'all node portable download sources failed'
    }

    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $extract -Force

    $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
    if (-not $inner) { throw 'node zip has no root directory' }

    if (Test-Path $toolsDir) { Remove-Item $toolsDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    Copy-Item -Path (Join-Path $inner.FullName '*') -Destination $toolsDir -Recurse -Force

    $nodeExe = Join-Path $toolsDir 'node.exe'
    if (-not (Test-Path $nodeExe)) { throw 'node.exe not found after portable extract' }
}

function Install-Node {
    if (Invoke-WingetInstallVerified @('-e', '--id', 'OpenJS.NodeJS.LTS', '--accept-package-agreements', '--accept-source-agreements') { Test-NodeReady }) {
        Write-Ok 'Node.js installed via winget'
        return
    }

    $mirror = ($UseMirror -eq '1')
    $ver = Get-NodeReleaseVersion $mirror

    Write-Info "winget unavailable or incomplete, installing Node.js $ver ..."
    if (Install-NodeMsi $ver $mirror) {
        Write-Ok "Node.js $ver installed via MSI (reopen terminal to refresh PATH)"
        return
    }

    Write-Info 'MSI failed, installing portable Node.js (no admin required)...'
    try {
        Install-NodePortable $ver $mirror
    } catch {
        Write-Err "Node.js install failed: $($_.Exception.Message). Manual: https://nodejs.org/"
    }
    $nodeExe = Join-Path (Join-Path $FastDeployDir '.tools\node') 'node.exe'
    Write-Ok "Node.js $ver portable: $nodeExe"
}

function Get-PythonInstallerUrls([bool]$Mirror, [string]$Version = '3.12.9') {
    $file = "python-$Version-amd64.exe"
    $official = "https://www.python.org/ftp/python/$Version/$file"
    $cn = @(
        "https://npmmirror.com/mirrors/python/$Version/$file",
        "https://mirrors.huaweicloud.com/python/$Version/$file",
        "https://mirrors.aliyun.com/python-release-windows/$Version/$file"
    )
    if ($Mirror) {
        return Get-UniqueUrls @($cn[0]) + @($official) + $cn[1..($cn.Length - 1)]
    }
    return Get-UniqueUrls @($official) + $cn
}

function Install-Python {
    if (Invoke-WingetInstallVerified @('-e', '--id', 'Python.Python.3.12', '--accept-package-agreements', '--accept-source-agreements') { Test-PythonReady }) {
        Write-Ok 'Python 3.12 installed via winget'
        return
    }

    Write-Info 'winget unavailable or incomplete, installing Python 3.12 via official installer...'
    $mirror = ($UseMirror -eq '1')
    $urls = Get-PythonInstallerUrls $mirror
    $file = ([uri]($urls[0])).Segments[-1]
    $tmpdir = Get-InstallTempDir
    $exe = Join-Path $tmpdir $file

    if (-not (Invoke-DownloadWithFallback $urls $exe)) {
        Write-Err "Python download failed from all sources. Manual: $($urls[0])"
    }

    Write-Info 'silent Python install...'
    $proc = Start-Process -FilePath $exe -ArgumentList @(
        '/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_test=0'
    ) -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Err "Python install failed (exit $($proc.ExitCode)). Manual: $($urls[0])"
    }
    Write-Ok 'Python 3.12 installed (reopen terminal to refresh PATH)'
}

function Install-Uv {
    $scripts = Get-UniqueUrls @(
        'https://astral.sh/uv/install.ps1',
        'https://ghproxy.net/https://raw.githubusercontent.com/astral-sh/uv/main/scripts/install.ps1',
        'https://mirror.ghproxy.com/https://raw.githubusercontent.com/astral-sh/uv/main/scripts/install.ps1'
    )
    foreach ($url in $scripts) {
        try {
            Write-Info "installing uv via $url"
            Invoke-Expression "irm '$url' | iex"
            if (Test-UvReady) {
                Write-Ok 'uv installed'
                return
            }
            Write-Info "uv script ran but binary not detected ($url)"
        } catch {
            Write-Info "uv install failed ($url): $($_.Exception.Message)"
        }
    }
    Write-Err 'uv install failed from all sources'
}

function Read-BackendEnvValue([string]$Key, [string]$Default = '') {
    $backendEnv = Join-Path (Split-Path $FastDeployDir -Parent) 'riveredge-backend\.env'
    if (-not (Test-Path $backendEnv)) { return $Default }
    foreach ($line in Get-Content $backendEnv) {
        if ($line -match "^${Key}=(.*)$") {
            return $Matches[1].Trim('"').Trim("'")
        }
    }
    return $Default
}

function Get-PostgresqlInstallerInfo([int]$Major = 16) {
    $builds = @{
        16 = @{ Ver = '16.8-1'; File = 'postgresql-16.8-1-windows-x64.exe' }
        17 = @{ Ver = '17.4-1'; File = 'postgresql-17.4-1-windows-x64.exe' }
    }
    if ($builds.ContainsKey($Major)) {
        return $builds[$Major].File, $builds[$Major].Ver
    }
    $file = "postgresql-$Major.8-1-windows-x64.exe"
    return $file, "$Major.8-1"
}

function Get-PostgresqlInstallerUrls([int]$Major = 16) {
    $file, $verTag = Get-PostgresqlInstallerInfo $Major
    return Get-UniqueUrls @(
        "https://get.enterprisedb.com/postgresql/$file",
        "https://ftp.postgresql.org/pub/binary/v$($verTag.Split('-')[0])/windows/$file"
    )
}

function Start-PostgresqlWindowsService {
    $services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'postgresql*' })
    foreach ($svc in $services) {
        Write-Info "starting service: $($svc.Name)"
        if ($svc.Status -ne 'Running') {
            Start-Service -Name $svc.Name -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 3
}

function Install-PostgresqlEdb {
    $superpass = Read-BackendEnvValue 'DB_PASSWORD' ''
    if ([string]::IsNullOrWhiteSpace($superpass)) {
        Write-Info 'DB_PASSWORD not in .env yet, using temporary superuser password (will be applied in bootstrap)'
        $superpass = 'riveredge_pg_setup'
    }
    $port = Read-BackendEnvValue 'DB_PORT' '5432'

    $urls = Get-PostgresqlInstallerUrls 16
    $file = ([uri]($urls[0])).Segments[-1]
    $tmpdir = Get-InstallTempDir
    $exe = Join-Path $tmpdir $file

    if (-not (Invoke-DownloadWithFallback $urls $exe)) {
        throw 'PostgreSQL installer download failed from all sources'
    }

    Write-Info "silent PostgreSQL install (port $port)..."
    $args = @(
        '--mode', 'unattended',
        '--unattendedmodeui', 'none',
        '--superpassword', $superpass,
        '--serverport', $port,
        '--install_runtimes', '1',
        '--enable_acledit', '0'
    )
    $proc = Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        throw "PostgreSQL installer failed (exit $($proc.ExitCode)). Try running Git Bash as Administrator."
    }
    Start-PostgresqlWindowsService
}

function Install-Postgresql {
    if (Invoke-WingetInstallVerified @('-e', '--id', 'PostgreSQL.PostgreSQL', '--accept-package-agreements', '--accept-source-agreements') { Test-PostgresqlReady }) {
        Start-PostgresqlWindowsService
        Write-Ok 'PostgreSQL installed via winget'
        try {
            $pgv = Join-Path $FastDeployDir 'windows\install-pgvector.ps1'
            if (Test-Path $pgv) {
                Write-Info 'installing pgvector for PostgreSQL...'
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pgv -FastDeployDir $FastDeployDir -UseMirror $UseMirror
            }
        } catch {
            Write-Info "pgvector install skipped: $($_.Exception.Message)"
        }
        return
    }

    Write-Info 'winget unavailable or incomplete, installing PostgreSQL 16 via EDB installer...'
    try {
        Install-PostgresqlEdb
    } catch {
        Write-Err @(
            "PostgreSQL install failed: $($_.Exception.Message)",
            'Options:',
            '  1) Run Git Bash as Administrator and retry',
            '  2) Download from https://www.postgresql.org/download/windows/',
            '  3) Choose remote database in wizard stage 2 to skip local PG'
        ) -join [Environment]::NewLine
    }
    Write-Ok 'PostgreSQL installed via EDB installer (reopen terminal to refresh PATH)'
    try {
        $pgv = Join-Path $FastDeployDir 'windows\install-pgvector.ps1'
        if (Test-Path $pgv) {
            Write-Info 'installing pgvector for PostgreSQL...'
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pgv -FastDeployDir $FastDeployDir -UseMirror $UseMirror
        }
    } catch {
        Write-Info "pgvector install skipped: $($_.Exception.Message)"
    }
}

function Get-GhProxyUrls([string]$Url) {
    return Get-UniqueUrls @(
        $Url,
        "https://ghproxy.net/$Url",
        "https://mirror.ghproxy.com/$Url"
    )
}

function Get-CaddyDownloadUrl {
    $apiUrls = Get-GhProxyUrls 'https://api.github.com/repos/caddyserver/caddy/releases/latest'
    $release = Invoke-RestWithFallback $apiUrls
    if ($release) {
        $asset = $release.assets | Where-Object { $_.name -match 'windows_amd64\.zip$' } | Select-Object -First 1
        if ($asset) { return $asset.browser_download_url }
    }
    return 'https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_windows_amd64.zip'
}

function Install-CaddyPortable {
    $directUrl = Get-CaddyDownloadUrl
    $urls = Get-GhProxyUrls $directUrl

    $toolsDir = Join-Path $FastDeployDir '.tools\caddy'
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $tmpdir = Get-InstallTempDir
    $zip = Join-Path $tmpdir 'caddy.zip'

    if (-not (Invoke-DownloadWithFallback $urls $zip)) {
        Write-Err 'Caddy download failed from all sources'
    }
    Expand-Archive -Path $zip -DestinationPath $toolsDir -Force

    $exe = Join-Path $toolsDir 'caddy.exe'
    if (-not (Test-Path $exe)) {
        Write-Err 'caddy.exe not found after extract'
    }
    Write-Ok "portable Caddy installed: $exe"
}

function Install-Caddy {
    if (Invoke-WingetInstallVerified @('-e', '--id', 'CaddyServer.Caddy', '--accept-package-agreements', '--accept-source-agreements') { Test-CaddyReady }) {
        Write-Ok 'Caddy installed via winget'
        return
    }

    Write-Info 'winget unavailable or incomplete, downloading portable Caddy...'
    Install-CaddyPortable
}

switch ($Component) {
    'node' { Install-Node }
    'python' { Install-Python }
    'uv' { Install-Uv }
    'postgresql' { Install-Postgresql }
    'caddy' { Install-Caddy }
}
