# Install pgvector extension files for local PostgreSQL on Windows (prebuilt binaries).
# Keep this file ASCII (or UTF-8 with BOM). Windows PowerShell 5.1 (powershell.exe -File)
# misparses UTF-8 without BOM and treats Chinese bytes as string terminators.
param(
    [string]$FastDeployDir = '',
    [string]$UseMirror = '1'
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

function Get-InstallTempDir {
    $dir = Join-Path $FastDeployDir '.install-tmp'
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-PgConfigPath {
    foreach ($major in @(18, 17, 16, 15, 14)) {
        $candidate = Join-Path $env:ProgramFiles "PostgreSQL\$major\bin\pg_config.exe"
        if (Test-Path $candidate) { return $candidate }
    }
    $cmd = Get-Command pg_config -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Test-VectorControlInstalled([string]$PgConfig) {
    $sharedir = & $PgConfig --sharedir 2>$null
    if (-not $sharedir) { return $false }
    return Test-Path (Join-Path $sharedir 'extension\vector.control')
}

function Get-PgvectorZipName([int]$Major, [string]$Version) {
    return "vector.v$Version-pg$Major.zip"
}

function Get-BundledPgvectorZip([int]$Major, [string]$Version) {
    $path = Join-Path $FastDeployDir ("vendor\pgvector\" + (Get-PgvectorZipName $Major $Version))
    if (Test-Path $path) { return $path }
    return $null
}

function Get-PgvectorZipUrls([int]$Major, [string]$Version) {
    $tag = "${Version}_$Major"
    $file = Get-PgvectorZipName $Major $Version
    $official = "https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/$tag/$file"
    if ($UseMirror -eq '1') {
        # China GitHub release proxies first; official GitHub last.
        return Get-UniqueUrls @(
            "https://gh-proxy.com/$official",
            "https://ghfast.top/$official",
            "https://ghproxy.net/$official",
            "https://gh.llkk.cc/$official",
            "https://hub.gitmirror.com/$official",
            $official
        )
    }
    return @($official)
}

function Install-PgvectorFromZip([string]$ZipPath, [string]$PgRoot) {
    $work = Join-Path (Get-InstallTempDir) "pgvector-extract-$([Guid]::NewGuid().ToString('n').Substring(0,8))"
    if (Test-Path $work) { Remove-Item $work -Recurse -Force }
    Expand-Archive -Path $ZipPath -DestinationPath $work -Force

    $libDir = Join-Path $PgRoot 'lib'
    $extDir = Join-Path $PgRoot 'share\extension'
    if (-not (Test-Path $libDir)) { throw "PostgreSQL lib dir missing: $libDir" }
    if (-not (Test-Path $extDir)) { throw "PostgreSQL extension dir missing: $extDir" }

    $dll = Get-ChildItem -Path $work -Recurse -Filter 'vector.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $dll) { throw 'vector.dll not found in pgvector zip' }
    Copy-Item $dll.FullName -Destination (Join-Path $libDir 'vector.dll') -Force

    $extFiles = Get-ChildItem -Path $work -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.DirectoryName -match 'share[\\/]extension' -or $_.Name -match '^vector(\.control|--|\.sql$)' }
    foreach ($f in $extFiles) {
        Copy-Item $f.FullName -Destination $extDir -Force
    }

    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path (Join-Path $extDir 'vector.control'))) {
        throw 'vector.control not found after copying extension files'
    }
    if (-not (Test-Path (Join-Path $libDir 'vector.dll'))) {
        throw 'vector.dll not found after copy'
    }
}

function Restart-PostgresqlServices {
    $services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'postgresql*' })
    foreach ($svc in $services) {
        Write-Info "restarting PostgreSQL service: $($svc.Name)"
        try {
            if ($svc.Status -eq 'Running') {
                Restart-Service -Name $svc.Name -Force -ErrorAction Stop
            } else {
                Start-Service -Name $svc.Name -ErrorAction Stop
            }
        } catch {
            Write-Info "service restart skipped ($($svc.Name)): $($_.Exception.Message)"
        }
    }
    if ($services.Count -gt 0) { Start-Sleep -Seconds 4 }
}

$pgConfig = Resolve-PgConfigPath
if (-not $pgConfig) {
    Write-Err 'pg_config not found. Install PostgreSQL first.'
}

$pgRoot = (Get-Item $pgConfig).Directory.Parent.FullName
if (Test-VectorControlInstalled $pgConfig) {
    Write-Ok "pgvector already installed ($pgRoot)"
    exit 0
}

if (-not (Test-IsAdministrator)) {
    Write-Err (@(
        'Administrator rights required to install pgvector into Program Files\PostgreSQL.',
        'Re-open Git Bash / PowerShell as Administrator and retry, or install pgvector manually.'
    ) -join [Environment]::NewLine)
}

$versionText = & $pgConfig --version 2>$null
if ($versionText -notmatch '(\d+)') {
    Write-Err "Unable to parse PostgreSQL version: $versionText"
}
$major = [int]$Matches[1]

Write-Info "installing pgvector (PostgreSQL $major, PGROOT=$pgRoot)..."

$version = '0.8.6'
$zip = Get-BundledPgvectorZip $major $version
if ($zip) {
    Write-Info "using bundled pgvector $version (Gitee/git tree, no download)"
} else {
    $tmpdir = Get-InstallTempDir
    $zip = Join-Path $tmpdir "vector-pg$major.zip"
    if (Invoke-DownloadWithFallback (Get-PgvectorZipUrls $major $version) $zip) {
        Write-Info "using pgvector release $version for PostgreSQL $major"
    } else {
        Write-Err "pgvector download failed (PostgreSQL $major). Pull fast-deploy/vendor/pgvector or install from https://github.com/andreiramani/pgvector_pgsql_windows/releases"
    }
}

try {
    Install-PgvectorFromZip $zip $pgRoot
} catch {
    Write-Err "pgvector copy failed: $($_.Exception.Message)"
}

Restart-PostgresqlServices

if (-not (Test-VectorControlInstalled $pgConfig)) {
    Write-Err 'vector.control still missing after install. Restart PostgreSQL and retry.'
}

Write-Ok "pgvector installed (PostgreSQL $major)"
exit 0
