# RiverEdge fast-deploy 共享库（Windows PowerShell）
$ErrorActionPreference = 'Stop'

$script:FastDeployDir = Split-Path $PSScriptRoot -Parent
$script:ProjectRoot = Split-Path $script:FastDeployDir -Parent
if (-not (Test-Path (Join-Path $script:ProjectRoot 'riveredge-backend'))) {
    $script:ProjectRoot = (Get-Location).Path
    $script:FastDeployDir = Join-Path $script:ProjectRoot 'fast-deploy'
}

$script:BackendDir = Join-Path $script:ProjectRoot 'riveredge-backend'
$script:FrontendDir = Join-Path $script:ProjectRoot 'riveredge-frontend'
$script:MobileAppDir = Join-Path $script:ProjectRoot 'riveredge-app\mobile'
$script:MobileWebDir = Join-Path $script:MobileAppDir 'web-dist'
$script:EnvFile = Join-Path $script:BackendDir '.env'
$script:ConfigDir = Join-Path $script:FastDeployDir 'config'
$script:DeployEnvFile = Join-Path $script:ConfigDir 'deploy.env'
$script:DeployEnvExample = Join-Path $script:ConfigDir 'deploy.env.example'
$script:LogsDir = Join-Path $script:ProjectRoot '.logs'
$script:CaddyDir = Join-Path $script:FastDeployDir 'caddy'
$script:Caddyfile = Join-Path $script:CaddyDir 'Caddyfile'
$script:CaddyTemplate = Join-Path $script:FastDeployDir 'templates\Caddyfile.template'
$script:CaddyProdAdminAddr = if ($env:CADDY_PROD_ADMIN_ADDR) { $env:CADDY_PROD_ADMIN_ADDR } else { '127.0.0.1:2018' }
$script:CaddyDevApiAdminAddr = if ($env:CADDY_DEV_API_ADMIN_ADDR) { $env:CADDY_DEV_API_ADMIN_ADDR } else { '127.0.0.1:2017' }
$script:InstallScriptsJson = Join-Path $script:ConfigDir 'install-scripts.json'
$script:BootTaskName = 'RiverEdge'
$script:BootTaskStopName = 'RiverEdge-Stop'
$script:BootEnvFile = Join-Path $script:ConfigDir 'boot-service.env'

if (-not $env:DEPLOY_MODE) { $env:DEPLOY_MODE = 'prod' }
$script:DeployMode = $env:DEPLOY_MODE
$script:UseMirror = ($env:USE_MIRROR -ne '0')
$script:BackendStartTimeout = if ($script:DeployMode -eq 'prod') { 90 } else { 120 }
$script:BackendDepsSynced = $false

# Windows 默认 GBK，aerich 读 pyproject.toml（UTF-8）会 UnicodeDecodeError
if (-not $env:PYTHONUTF8) { $env:PYTHONUTF8 = '1' }
if (-not $env:PYTHONIOENCODING) { $env:PYTHONIOENCODING = 'utf-8' }

function Write-LogInfo($msg)  { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] INFO: $msg" -ForegroundColor Cyan }
function Write-LogWarn($msg)  { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] WARN: $msg" -ForegroundColor Yellow }
function Write-LogOk($msg)    { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $msg" -ForegroundColor Green }
function Write-LogError($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $msg" -ForegroundColor Red }

function Write-SupportContact {
    Write-Host '  联系反馈: WeChat lu_dingjie'
}

function Ensure-LogsDir {
    if (-not (Test-Path $script:LogsDir)) { New-Item -ItemType Directory -Path $script:LogsDir -Force | Out-Null }
}

. (Join-Path $PSScriptRoot 'blue_green.ps1')

function Load-DeployEnv {
    if (-not (Test-Path $script:DeployEnvFile)) {
        $example = $script:DeployEnvExample
        if (Test-Path $example) {
            Copy-Item $example $script:DeployEnvFile
            Write-LogInfo '已从 deploy.env.example 创建 deploy.env'
        }
    }
    if (Test-Path $script:DeployEnvFile) {
        Get-Content $script:DeployEnvFile | ForEach-Object {
            if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                Set-Variable -Name $Matches[1] -Value $Matches[2].Trim() -Scope Script -Force
            }
        }
    }
    if (-not $script:BACKEND_PORT) { $script:BACKEND_PORT = 8200 }
    if (-not $script:FRONTEND_PORT) { $script:FRONTEND_PORT = 8100 }
    if (-not $script:PROXY_PORT) { $script:PROXY_PORT = 8080 }
    if (-not $script:CADDY_DOMAIN) { $script:CADDY_DOMAIN = '' }
    if (-not $script:CADDY_ENABLE_LETSENCRYPT) { $script:CADDY_ENABLE_LETSENCRYPT = 'false' }
    if (-not $script:NODE_BUILD_MEM) { $script:NODE_BUILD_MEM = 4096 }
    if (-not $script:ALLOW_SERVER_BUILD) { $script:ALLOW_SERVER_BUILD = '0' }
    if (-not $script:SERVER_IP) { $script:SERVER_IP = '' }
    if (-not $script:TASKIQ_WORKERS) {
        if ($script:DeployMode -eq 'prod') { $script:TASKIQ_WORKERS = 1 } else { $script:TASKIQ_WORKERS = 2 }
    }
    if (-not $script:PLAYWRIGHT_POSTINSTALL_ENABLE) { $script:PLAYWRIGHT_POSTINSTALL_ENABLE = '1' }
    if (-not $script:PLAYWRIGHT_BROWSERS_PATH) {
        $script:PLAYWRIGHT_BROWSERS_PATH = Join-Path $script:ProjectRoot '.playwright-browsers'
    }
    if (-not $script:CADDY_DATA_DIR) {
        $script:CADDY_DATA_DIR = Join-Path $script:ProjectRoot '.caddy-data'
    }
    if (-not $script:CADDY_CONFIG_DIR) {
        $script:CADDY_CONFIG_DIR = Join-Path $script:ProjectRoot '.caddy-config'
    }
    if (-not $script:CADDY_START_TIMEOUT) { $script:CADDY_START_TIMEOUT = 45 }
    if (-not $script:TASKIQ_START_TIMEOUT) { $script:TASKIQ_START_TIMEOUT = 180 }
    if (-not $script:GIT_BRANCH) { $script:GIT_BRANCH = 'develop' }
    if (-not $script:GIT_REMOTE) { $script:GIT_REMOTE = 'origin' }
    Initialize-BgDefaults
}

function Apply-CN-Mirrors {
    if (-not $script:UseMirror) { return }
    if (-not $env:UV_INDEX_URL) {
        # 与 PGDG 国内源一致用阿里云。清华 tuna 在部分 Windows 网络上 Connect 超时。
        $env:UV_INDEX_URL = 'https://mirrors.aliyun.com/pypi/simple/'
    }
    $env:npm_config_registry = 'https://registry.npmmirror.com'
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm config set registry https://registry.npmmirror.com 2>$null
    }
    Write-LogInfo "已启用国内镜像 (uv=$($env:UV_INDEX_URL)；npm=npmmirror)"
}

function Detect-ServerIp {
    $ip = $null
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
            Select-Object -First 1 -ExpandProperty IPAddress)
    } catch { }
    if (-not $ip) { $ip = '127.0.0.1' }
    return $ip
}

function Test-VersionGe([string]$a, [string]$b) {
    $va = [version]($a -replace '^v','')
    $vb = [version]($b -replace '^v','')
    return $va -ge $vb
}

function Get-EnhancedPath {
    $paths = @($env:PATH)
    $extra = @(
        (Join-Path $script:FastDeployDir '.tools\node'),
        "$env:ProgramFiles\nodejs",
        "$env:ProgramFiles(x86)\nodejs",
        "$env:USERPROFILE\.local\bin",
        (Join-Path $script:FastDeployDir '.tools\caddy')
    )
    # nvm-windows：symlink path + root 下最新 v*
    $nvmRoot = if ($env:NVM_HOME) { $env:NVM_HOME } else { Join-Path $env:LOCALAPPDATA 'nvm' }
    $nvmSettings = Join-Path $nvmRoot 'settings.txt'
    if (Test-Path $nvmSettings) {
        Get-Content $nvmSettings -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_ -match '^\s*path:\s*(.+)\s*$') {
                $link = $Matches[1].Trim()
                if ($link -and (Test-Path $link)) { $extra += $link }
            }
            if ($_ -match '^\s*root:\s*(.+)\s*$') {
                $root = $Matches[1].Trim()
                if ($root -and (Test-Path $root)) { $nvmRoot = $root }
            }
        }
    }
    foreach ($link in @('C:\nvm4w\nodejs', 'D:\nvm4w\nodejs')) {
        if (Test-Path $link) { $extra += $link }
    }
    if (Test-Path $nvmRoot) {
        $best = $null
        foreach ($dir in Get-ChildItem $nvmRoot -Directory -Filter 'v*' -ErrorAction SilentlyContinue | Sort-Object Name) {
            $exe = Join-Path $dir.FullName 'node.exe'
            if (Test-Path $exe) { $best = $dir.FullName }
        }
        if ($best) { $extra += $best }
    }
    $pgRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $pgRoot) {
        foreach ($dir in Get-ChildItem $pgRoot -Directory -ErrorAction SilentlyContinue) {
            $bin = Join-Path $dir.FullName 'bin'
            if (Test-Path $bin) { $extra += $bin }
        }
    }
    $pyRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
    if (Test-Path $pyRoot) {
        foreach ($dir in Get-ChildItem $pyRoot -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue) {
            $extra += $dir.FullName
            $extra += (Join-Path $dir.FullName 'Scripts')
        }
    }
    foreach ($dir in @(
        (Join-Path $env:ProgramFiles 'Python312'),
        (Join-Path $env:ProgramFiles 'python')
    )) {
        if (Test-Path $dir) {
            $extra += $dir
            $extra += (Join-Path $dir 'Scripts')
        }
    }
    foreach ($p in $extra) {
        if ($p -and (Test-Path $p) -and ($paths -notcontains $p)) { $paths = @($p) + $paths }
    }
    return ($paths -join ';')
}

$env:PATH = Get-EnhancedPath

function Get-InstallCommand([string]$component) {
    if (-not (Test-Path $script:InstallScriptsJson)) { return '' }
    $json = Get-Content $script:InstallScriptsJson -Raw | ConvertFrom-Json
    if ($script:UseMirror -and $component -notin @('node', 'python', 'postgresql', 'caddy') -and $json.scripts_cn.$component) {
        return $json.scripts_cn.$component
    }
    $plat = 'windows'
    $cmd = $json.scripts.$component.$plat
    if (-not $cmd) { $cmd = $json.scripts.$component.linux }
    return $cmd
}

function Resolve-Uv {
    if ($env:RIVEREDGE_UV -and (Test-Path -LiteralPath $env:RIVEREDGE_UV)) { return $env:RIVEREDGE_UV }
    if ($env:UV_BIN -and (Test-Path -LiteralPath $env:UV_BIN)) { return $env:UV_BIN }
    if (Get-Command uv -ErrorAction SilentlyContinue) { return (Get-Command uv).Source }
    $candidates = @(
        "$env:USERPROFILE\.local\bin\uv.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts\uv.exe"
    )
    foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
    return 'uv'
}

function Resolve-Caddy {
    if ($env:RIVEREDGE_CADDY -and (Test-Path -LiteralPath $env:RIVEREDGE_CADDY)) { return $env:RIVEREDGE_CADDY }
    if ($env:CADDY_BIN -and (Test-Path -LiteralPath $env:CADDY_BIN)) { return $env:CADDY_BIN }
    if (Get-Command caddy -ErrorAction SilentlyContinue) { return (Get-Command caddy).Source }
    $bundled = Join-Path $script:FastDeployDir '.tools\caddy\caddy.exe'
    if (Test-Path $bundled) { return $bundled }
    return $null
}

function Invoke-CaddyReload {
    param(
        [Parameter(Mandatory = $true)][string]$CaddyBin,
        [Parameter(Mandatory = $true)][string]$ConfigPath,
        [Parameter(Mandatory = $true)][string]$AdminAddress
    )
    & $CaddyBin reload --config $ConfigPath --address $AdminAddress
}

function Test-CheckNode {
    $env:PATH = Get-EnhancedPath
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        $candidates = @(
            (Join-Path $script:FastDeployDir '.tools\node\node.exe'),
            'C:\nvm4w\nodejs\node.exe',
            (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
        )
        $nvmRoot = if ($env:NVM_HOME) { $env:NVM_HOME } else { Join-Path $env:LOCALAPPDATA 'nvm' }
        if (Test-Path $nvmRoot) {
            foreach ($dir in Get-ChildItem $nvmRoot -Directory -Filter 'v*' -ErrorAction SilentlyContinue | Sort-Object Name) {
                $candidates += (Join-Path $dir.FullName 'node.exe')
            }
        }
        foreach ($p in $candidates) {
            if (Test-Path $p) { $node = Get-Command $p -ErrorAction SilentlyContinue; if ($node) { break } }
        }
    }
    if (-not $node) { return 'missing' }
    $v = (& $node.Source -v) -replace '^v',''
    if (Test-VersionGe $v '22.0.0') { return 'ok' } else { return "old:$v" }
}

function Test-IsWindowsStoreStub([string]$Path) {
    return $Path -match 'WindowsApps'
}

function Get-DiscoverExesViaWhere([string]$Name) {
    $found = @()
    $where = Get-Command where.exe -ErrorAction SilentlyContinue
    if (-not $where) { return $found }
    foreach ($line in (& $where.Source $Name 2>$null)) {
        $line = $line.Trim()
        if (-not $line -or (Test-IsWindowsStoreStub $line)) { continue }
        if (Test-Path $line) { $found += $line }
    }
    return $found
}

function Get-PythonCandidates {
    $env:PATH = Get-EnhancedPath
    $candidates = [System.Collections.Generic.List[string]]::new()
    $seen = @{}

    foreach ($p in Get-DiscoverExesViaWhere 'python') {
        if (-not $seen.ContainsKey($p)) { $candidates.Add($p); $seen[$p] = $true }
    }
    foreach ($p in Get-DiscoverExesViaWhere 'python3') {
        if (-not $seen.ContainsKey($p)) { $candidates.Add($p); $seen[$p] = $true }
    }

    if (Get-Command py -ErrorAction SilentlyContinue) {
        foreach ($line in (& py -0p 2>$null)) {
            $line = $line.Trim()
            if (-not $line) { continue }
            $path = ($line -split '\s+')[-1]
            if ($path -match '\\' -and -not (Test-IsWindowsStoreStub $path) -and (Test-Path $path)) {
                if (-not $seen.ContainsKey($path)) { $candidates.Add($path); $seen[$path] = $true }
            }
            if ($line -match '-V:(\d+\.\d+)') {
                $spec = "py -V:$($Matches[1])"
                try {
                    & py "-V:$($Matches[1])" --version 2>$null | Out-Null
                    if (-not $seen.ContainsKey($spec)) { $candidates.Add($spec); $seen[$spec] = $true }
                } catch { }
            }
        }
        foreach ($item in @('-3.12', '-3')) {
            try {
                & py $item --version 2>$null | Out-Null
                $spec = "py $item"
                if (-not $seen.ContainsKey($spec)) { $candidates.Add($spec); $seen[$spec] = $true }
            } catch { }
        }
    }

    $pyRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
    if (Test-Path $pyRoot) {
        foreach ($dir in Get-ChildItem $pyRoot -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue) {
            $exe = Join-Path $dir.FullName 'python.exe'
            if ((Test-Path $exe) -and -not $seen.ContainsKey($exe)) { $candidates.Add($exe); $seen[$exe] = $true }
        }
    }
    foreach ($dir in @(
        (Join-Path $env:ProgramFiles 'Python312'),
        (Join-Path $env:ProgramFiles 'python')
    )) {
        $exe = Join-Path $dir 'python.exe'
        if ((Test-Path $exe) -and -not $seen.ContainsKey($exe)) { $candidates.Add($exe); $seen[$exe] = $true }
    }

    foreach ($c in @('python3.12', 'python3', 'python')) {
        if (Get-Command $c -ErrorAction SilentlyContinue) {
            $src = (Get-Command $c).Source
            if (-not (Test-IsWindowsStoreStub $src) -and -not $seen.ContainsKey($c)) {
                $candidates.Add($c); $seen[$c] = $true
            }
        }
    }
    return $candidates
}

function Get-PsqlCandidates {
    $env:PATH = Get-EnhancedPath
    $candidates = [System.Collections.Generic.List[string]]::new()
    $seen = @{}

    foreach ($p in Get-DiscoverExesViaWhere 'psql') {
        if (-not $seen.ContainsKey($p)) { $candidates.Add($p); $seen[$p] = $true }
    }
    $pgRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $pgRoot) {
        foreach ($dir in Get-ChildItem $pgRoot -Directory -ErrorAction SilentlyContinue) {
            $exe = Join-Path $dir.FullName 'bin\psql.exe'
            if ((Test-Path $exe) -and -not $seen.ContainsKey($exe)) { $candidates.Add($exe); $seen[$exe] = $true }
        }
    }
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $src = (Get-Command psql).Source
        if (-not $seen.ContainsKey($src)) { $candidates.Add($src); $seen[$src] = $true }
    }
    if ($IsLinux -or $env:OS -ne 'Windows_NT') {
        foreach ($p in Get-ChildItem -Path '/usr/lib/postgresql/*/bin/psql' -ErrorAction SilentlyContinue) {
            if (-not $seen.ContainsKey($p.FullName)) { $candidates.Add($p.FullName); $seen[$p.FullName] = $true }
        }
    }
    return $candidates
}

function Get-PythonVersionOutput([string]$Py) {
    if ($Py -match '^py ') {
        $parts = $Py -split '\s+', 2
        return & $parts[0] $parts[1] --version 2>&1
    }
    return & $Py --version 2>&1
}

function Test-CheckPython {
    $best = $null
    foreach ($py in Get-PythonCandidates) {
        if (Test-IsWindowsStoreStub $py) { continue }
        $out = Get-PythonVersionOutput $py
        if ($out -match '(\d+\.\d+\.\d+)') {
            $v = $Matches[1]
            if (Test-VersionGe $v '3.12.0') { return 'ok' }
            $best = $v
        }
    }
    if ($best) { return "old:$best" }
    return 'missing'
}

function Test-CheckUv {
    $uv = Resolve-Uv
    try { & $uv --version | Out-Null; return 'ok' } catch { return 'missing' }
}

function Test-CheckNpm {
    $env:PATH = Get-EnhancedPath
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { return 'missing' }
    $v = (npm -v).Trim()
    if (Test-VersionGe $v '10.0.0') { return 'ok' } else { return "old:$v" }
}

function Test-CheckPostgres {
    $best = $null
    foreach ($bin in Get-PsqlCandidates) {
        if (Test-IsWindowsStoreStub $bin) { continue }
        if (-not (Test-Path $bin) -and -not (Get-Command $bin -ErrorAction SilentlyContinue)) { continue }
        $out = & $bin --version 2>$null
        if ($out -match '(\d+\.\d+)') {
            $v = $Matches[1]
            if (Test-VersionGe $v '15.0') { return 'ok' }
            $best = $v
        }
    }
    if ($best) { return "old:$best" }
    return 'missing'
}

function Test-CheckCaddy {
    if (Resolve-Caddy) { return 'ok' }
    return 'missing'
}

function Test-PortInUse([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$conn
}

function Stop-Port([int]$Port) {
    if (-not (Test-PortInUse $Port)) { return }
    Write-LogWarn "清理端口 $Port..."
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

function Stop-ServiceByPidFile([string]$Name) {
    $pidf = Join-Path $script:LogsDir "$Name.pid"
    if (-not (Test-Path $pidf)) { return }
    $procId = Get-Content $pidf -Raw
    $procId = $procId.Trim()
    if ($procId -match '^\d+$') {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        Write-LogInfo "已停止 $Name (PID $procId)"
    }
    Remove-Item $pidf -Force -ErrorAction SilentlyContinue
}

function Test-PidFileAlive([string]$PidFile) {
    if (-not (Test-Path $PidFile)) { return $false }
    $pidText = (Get-Content $PidFile -Raw).Trim()
    if (-not ($pidText -match '^\d+$')) { return $false }
    return [bool](Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue)
}

function Wait-ProcessStable([string]$Name, [string]$PidFile, [string]$LogFile, [int]$StableSeconds = 12) {
    for ($i = 0; $i -lt $StableSeconds; $i++) {
        if (-not (Test-PidFileAlive $PidFile)) {
            Write-LogError "$Name 启动后很快退出，查看日志: $LogFile"
            if (Test-Path $LogFile) {
                Get-Content $LogFile -Tail 30 | ForEach-Object { Write-Host $_ }
            }
            return $false
        }
        Start-Sleep -Seconds 1
    }
    return $true
}

function Wait-TaskiqServiceReady(
    [string]$Name,
    [string]$PidFile,
    [string]$LogFile,
    [string]$ReadyPattern,
    [int]$Timeout = 0
) {
    Load-DeployEnv
    if ($Timeout -le 0) { $Timeout = [int]$script:TASKIQ_START_TIMEOUT }
    $lastProgress = 0
    for ($i = 0; $i -lt $Timeout; $i++) {
        if (-not (Test-PidFileAlive $PidFile)) {
            Write-LogError "$Name 启动后退出，查看日志: $LogFile"
            if (Test-Path $LogFile) {
                Get-Content $LogFile -Tail 30 | ForEach-Object { Write-Host $_ }
            }
            return $false
        }
        if ($ReadyPattern -and (Test-Path $LogFile)) {
            $hit = Select-String -Path $LogFile -Pattern $ReadyPattern -Quiet -ErrorAction SilentlyContinue
            if ($hit) { return $true }
        }
        if (($i - $lastProgress) -ge 15) {
            Write-LogInfo "$Name 仍在启动（${i}s / 最多 ${Timeout}s；低内存机可能较慢）..."
            if (Test-Path $LogFile) {
                Get-Content $LogFile -Tail 3 | ForEach-Object { Write-LogInfo "  $_" }
            }
            $lastProgress = $i
        }
        Start-Sleep -Seconds 1
    }
    if (Test-PidFileAlive $PidFile) {
        Write-LogWarn "$Name 在 ${Timeout}s 内未检测到就绪日志，进程仍在运行，继续..."
        return $true
    }
    Write-LogError "$Name 启动超时，查看 $LogFile"
    if (Test-Path $LogFile) {
        Get-Content $LogFile -Tail 30 | ForEach-Object { Write-Host $_ }
    }
    return $false
}

function Read-EnvValue([string]$Key) {
    if (-not (Test-Path $script:EnvFile)) { return $null }
    $line = Select-String -Path $script:EnvFile -Pattern "^${Key}=" | Select-Object -Last 1
    if (-not $line) { return $null }
    return ($line.Line -replace "^${Key}=", '').Trim('"').Trim("'")
}

function Set-EnvValue([string]$Key, [string]$Val) {
    $content = @()
    $found = $false
    if (Test-Path $script:EnvFile) {
        foreach ($line in Get-Content $script:EnvFile) {
            if ($line -match "^${Key}=") {
                $content += "${Key}=${Val}"
                $found = $true
            } else { $content += $line }
        }
    }
    if (-not $found) { $content += "${Key}=${Val}" }
    Set-Content -Path $script:EnvFile -Value $content -Encoding UTF8
}

function Read-DeployEnvValue([string]$Key) {
    if (-not (Test-Path $script:DeployEnvFile)) { return $null }
    $line = Select-String -Path $script:DeployEnvFile -Pattern "^${Key}=" | Select-Object -Last 1
    if (-not $line) { return $null }
    return ($line.Line -replace "^${Key}=", '').Trim('"').Trim("'")
}

function Set-DeployEnvValue([string]$Key, [string]$Val) {
    if (-not (Test-Path $script:DeployEnvFile)) {
        Copy-Item $script:DeployEnvExample $script:DeployEnvFile
    }
    $content = @()
    $found = $false
    foreach ($line in Get-Content $script:DeployEnvFile) {
        if ($line -match "^${Key}=") {
            $content += "${Key}=${Val}"
            $found = $true
        } else { $content += $line }
    }
    if (-not $found) { $content += "${Key}=${Val}" }
    Set-Content -Path $script:DeployEnvFile -Value $content -Encoding UTF8
}

function Record-DeployReleaseMetadata {
    if (-not (Test-Path $script:EnvFile)) {
        Copy-Item (Join-Path $script:BackendDir '.env.example') $script:EnvFile
    }
    $sha = $null
    Push-Location $script:ProjectRoot
    try {
        $sha = (git rev-parse --short HEAD 2>$null)
        if ($sha) { $sha = $sha.ToString().Trim() }
    } finally { Pop-Location }
    $buildTime = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss') + 'Z'
    if ($sha) { Set-EnvValue 'GIT_SHA' $sha }
    Set-EnvValue 'PLATFORM_BUILD_TIME' $buildTime
    $shaLabel = if ($sha) { $sha } else { 'unknown' }
    Write-LogInfo "发版记录: commit=$shaLabel deploy_time=$buildTime"
}

function Normalize-DomainInput([string]$Raw) {
    if ([string]::IsNullOrWhiteSpace($Raw)) { return '' }
    $v = $Raw.Trim().ToLowerInvariant()
    $v = $v -replace '^https?://', ''
    $v = ($v -split '/')[0]
    $v = ($v -split ':')[0]
    return $v
}

function Test-Ipv4Address([string]$Value) {
    return $Value -match '^(\d{1,3}\.){3}\d{1,3}$'
}

function Get-CaddyDomainApex([string]$Domain) {
    $d = Normalize-DomainInput $Domain
    if ($d -match '^www\.(.+)$') { return $Matches[1] }
    return $d
}

function Get-CaddyDomainWww([string]$Domain) {
    return "www.$(Get-CaddyDomainApex $Domain)"
}

function Get-CaddySiteAddrForDomain([string]$Domain) {
    Load-DeployEnv
    $d = Normalize-DomainInput $Domain
    if (-not $d) { return ":$($script:PROXY_PORT)" }
    if ($script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
        $apex = Get-CaddyDomainApex $d
        $www = Get-CaddyDomainWww $d
        return "$apex, $www"
    }
    return "http://${d}:$($script:PROXY_PORT)"
}

function Get-ProdCorsOrigins([string]$ServerIp) {
    Load-DeployEnv
    if ([string]::IsNullOrWhiteSpace($ServerIp)) {
        $ServerIp = Read-DeployEnvValue 'SERVER_IP'
        if ([string]::IsNullOrWhiteSpace($ServerIp)) { $ServerIp = Detect-ServerIp }
    }
    if ($script:CADDY_DOMAIN) {
        if ($script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
            $apex = Get-CaddyDomainApex $script:CADDY_DOMAIN
            $www = Get-CaddyDomainWww $script:CADDY_DOMAIN
            $baseUrl = "https://$apex"
            $cors = "$baseUrl,https://$www,http://${apex}:$($script:PROXY_PORT),http://${www}:$($script:PROXY_PORT),http://${ServerIp}:$($script:PROXY_PORT),http://127.0.0.1:$($script:PROXY_PORT),http://localhost:$($script:PROXY_PORT)"
            return @{ BaseUrl = $baseUrl; Cors = $cors }
        }
        $baseUrl = "http://$($script:CADDY_DOMAIN):$($script:PROXY_PORT)"
        $cors = "$baseUrl,http://${ServerIp}:$($script:PROXY_PORT),http://127.0.0.1:$($script:PROXY_PORT),http://localhost:$($script:PROXY_PORT)"
        return @{ BaseUrl = $baseUrl; Cors = $cors }
    }
    $baseUrl = "http://${ServerIp}:$($script:PROXY_PORT)"
    $cors = "$baseUrl,http://127.0.0.1:$($script:PROXY_PORT),http://localhost:$($script:PROXY_PORT)"
    return @{ BaseUrl = $baseUrl; Cors = $cors }
}

function Resolve-ProdWebUrl([string]$ServerIp) {
    Load-DeployEnv
    if ([string]::IsNullOrWhiteSpace($ServerIp)) {
        $ServerIp = Read-DeployEnvValue 'SERVER_IP'
        if ([string]::IsNullOrWhiteSpace($ServerIp)) { $ServerIp = Detect-ServerIp }
    }
    if ($script:CADDY_DOMAIN) {
        if ($script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
            return "https://$(Get-CaddyDomainApex $script:CADDY_DOMAIN)"
        }
        return "http://$($script:CADDY_DOMAIN):$($script:PROXY_PORT)"
    }
    return "http://${ServerIp}:$($script:PROXY_PORT)"
}

function Collect-ProdDomainHttpsConfig {
    Load-DeployEnv
    if ($script:DeployMode -ne 'prod') { return }
    if (-not (Test-Path $script:DeployEnvFile)) {
        Copy-Item $script:DeployEnvExample $script:DeployEnvFile
    }

    $currentDomain = Read-DeployEnvValue 'CADDY_DOMAIN'
    $currentLe = Read-DeployEnvValue 'CADDY_ENABLE_LETSENCRYPT'
    if ([string]::IsNullOrWhiteSpace($currentLe)) { $currentLe = 'false' }

    Write-LogInfo '生产环境 Web 访问方式：'
    Write-Host "    1) 仅 IP — http://服务器IP:$($script:PROXY_PORT)"
    if ($currentDomain) {
        Write-Host "    2) 使用域名 — 当前: $currentDomain (HTTPS: $currentLe)"
    } else {
        Write-Host "    2) 使用域名 — 可自动申请 Let's Encrypt HTTPS 证书"
    }
    $choice = Read-Host '请选择 [1/2] (默认 1)'
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = '1' }

    switch ($choice) {
        { $_ -in '2', 'domain', 'https' } {
            if ($currentDomain) {
                $inputDomain = Read-Host "生产域名 [$currentDomain]"
                if ([string]::IsNullOrWhiteSpace($inputDomain)) { $inputDomain = $currentDomain }
            } else {
                $inputDomain = Read-Host '请输入生产域名 (例如 app.example.com)'
            }
            $domain = Normalize-DomainInput $inputDomain
            if ([string]::IsNullOrWhiteSpace($domain)) { throw '域名不能为空' }
            $domain = Get-CaddyDomainApex $domain

            if (Test-Ipv4Address $domain) {
                Write-LogWarn "Let's Encrypt 不支持 IP 证书，域名已保存但仅使用 HTTP"
                Set-DeployEnvValue 'CADDY_DOMAIN' $domain
                Set-DeployEnvValue 'CADDY_ENABLE_LETSENCRYPT' 'false'
                Write-LogOk "已配置: http://${domain}:$($script:PROXY_PORT)"
                return
            }

            $defaultLe = if ($currentLe -eq 'false') { 'n' } else { 'Y' }
            $enableInput = Read-Host "是否启用 HTTPS (Let's Encrypt)? [Y/n]"
            if ([string]::IsNullOrWhiteSpace($enableInput)) { $enableInput = $defaultLe }
            $enableLe = if ($enableInput -match '^(n|N|no|No|NO|false)$') { 'false' } else { 'true' }
            Set-DeployEnvValue 'CADDY_DOMAIN' $domain
            Set-DeployEnvValue 'CADDY_ENABLE_LETSENCRYPT' $enableLe
            Load-DeployEnv
            if ($enableLe -eq 'true') {
                $www = Get-CaddyDomainWww $domain
                Write-LogOk "已配置: https://${domain} 与 https://${www}（${domain} 与 www 均需 DNS 指向本机且公网 80 可达）"
            } else {
                Write-LogOk "已配置: http://${domain}:$($script:PROXY_PORT)"
            }
        }
        default {
            Set-DeployEnvValue 'CADDY_DOMAIN' ''
            Set-DeployEnvValue 'CADDY_ENABLE_LETSENCRYPT' 'false'
            Load-DeployEnv
            Write-LogOk '已选择 IP 访问模式'
        }
    }
}

function Test-EnvNeedsConfigure {
    if (-not (Test-Path $script:EnvFile)) { return $true }
    $db = Read-EnvValue 'DB_PASSWORD'
    $admin = Read-EnvValue 'PLATFORM_SUPERADMIN_PASSWORD'
    $jwt = Read-EnvValue 'JWT_SECRET_KEY'
    if ([string]::IsNullOrWhiteSpace($db) -or [string]::IsNullOrWhiteSpace($admin) -or
        [string]::IsNullOrWhiteSpace($jwt) -or $jwt -eq 'your-secret-key-here-change-in-production') {
        return $true
    }
    if ($script:DeployMode -eq 'prod') {
        if ([string]::IsNullOrWhiteSpace((Read-EnvValue 'BASE_URL'))) { return $true }
        if ([string]::IsNullOrWhiteSpace((Read-DeployEnvValue 'SERVER_IP'))) { return $true }
    }
    return $false
}

function Test-DbConnection {
    $host_ = Read-EnvValue 'DB_HOST'; if (-not $host_) { $host_ = 'localhost' }
    $port = Read-EnvValue 'DB_PORT'; if (-not $port) { $port = '5432' }
    $user = Read-EnvValue 'DB_USER'; if (-not $user) { $user = 'postgres' }
    $pass = Read-EnvValue 'DB_PASSWORD'
    $dbname = Read-EnvValue 'DB_NAME'; if (-not $dbname) { $dbname = 'riveredge' }
    $env:PGPASSWORD = $pass
    try {
        & psql -h $host_ -p $port -U $user -d $dbname -c 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
        & psql -h $host_ -p $port -U $user -d postgres -c 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { return $false }
        if ($host_ -eq 'localhost' -or $host_ -eq '127.0.0.1') {
            $exists = & psql -h $host_ -p $port -U $user -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$dbname'" 2>$null
            if ($exists -notmatch '1') {
                & psql -h $host_ -p $port -U $user -d postgres -c "CREATE DATABASE `"$dbname`";" 2>$null | Out-Null
            }
        }
        return ($LASTEXITCODE -eq 0)
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Test-PostgresCanLocalReset([string]$DbHost) {
    if ($DbHost -ne 'localhost' -and $DbHost -ne '127.0.0.1') { return $false }
    if ($IsLinux) { return $true }
    if ($env:OS -ne 'Windows_NT' -and (Get-Command sudo -ErrorAction SilentlyContinue)) { return $true }
    return $false
}

function Set-PostgresPasswordManual {
    if ([string]::IsNullOrWhiteSpace((Read-EnvValue 'DB_PASSWORD'))) {
        $sec = Read-Host 'PostgreSQL 密码 (DB_PASSWORD)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        $dbPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        if ([string]::IsNullOrWhiteSpace($dbPass)) { throw 'DB_PASSWORD 不能为空' }
        Set-EnvValue 'DB_PASSWORD' $dbPass
    } else {
        $sec = Read-Host 'PostgreSQL 密码 [已配置，回车跳过 / 输入新密码]' -AsSecureString
        if ($sec.Length -gt 0) {
            $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
            Set-EnvValue 'DB_PASSWORD' ([Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr))
        }
    }
}

function Reset-PostgresPasswordLocal {
    param([string]$DbUser, [string]$DbHost, [string]$DbPort)
    if (-not (Test-PostgresCanLocalReset $DbHost)) {
        throw '强制重置仅支持本机 localhost（Linux + sudo -u postgres）'
    }
    Write-LogWarn '━━ 强制重置密码 · 风险须知 ━━'
    Write-Host "  · 将修改 PostgreSQL 用户「${DbUser}」的登录密码"
    Write-Host '  · 使用旧密码的其他应用、脚本、副本/从库连接将立即失效'
    Write-Host '  · 需 sudo 以系统 postgres 用户执行，无法用于远程数据库主机'
    Write-Host '  · 若不确定影响范围，请选择「手动填写」模式'
    Write-Host ''
    $confirm = Read-Host '确认强制重置请输入 yes'
    if ($confirm -ne 'yes') { throw '已取消强制重置' }
    $sec1 = Read-Host '新的 PostgreSQL 密码' -AsSecureString
    $sec2 = Read-Host '再次确认新密码' -AsSecureString
    $b1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec1)
    $b2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec2)
    $pass1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($b1)
    $pass2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($b2)
    if ([string]::IsNullOrWhiteSpace($pass1)) { throw '密码不能为空' }
    if ($pass1 -ne $pass2) { throw '两次输入的密码不一致' }
    $escaped = $pass1 -replace "'", "''"
    $sql = "ALTER USER `"$DbUser`" WITH PASSWORD '$escaped';"
    Write-LogInfo "正在重置 PostgreSQL 用户 ${DbUser}@${DbHost}:${DbPort} 的密码..."
    bash -lc "sudo -u postgres psql -p '$DbPort' -d postgres -v ON_ERROR_STOP=1 -c `"$sql`"" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        bash -lc "sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c `"$sql`""
        if ($LASTEXITCODE -ne 0) { throw '密码重置失败，请确认 PostgreSQL 已启动且 sudo -u postgres psql 可用' }
    }
    Set-EnvValue 'DB_PASSWORD' $pass1
    Write-LogOk '密码已重置并写入 .env'
}

function Invoke-PostgresPasswordSetup {
    $dbUser = Read-EnvValue 'DB_USER'; if (-not $dbUser) { $dbUser = 'postgres' }
    $dbHost = Read-EnvValue 'DB_HOST'; if (-not $dbHost) { $dbHost = 'localhost' }
    $dbPort = Read-EnvValue 'DB_PORT'; if (-not $dbPort) { $dbPort = '5432' }
    Write-Host ''
    Write-LogInfo 'PostgreSQL 密码配置方式:'
    Write-Host '  1) 手动填写 — 使用你已知的数据库密码连接'
    if (Test-PostgresCanLocalReset $dbHost) {
        Write-Host "  2) 强制重置 — 将本机 ${dbUser} 用户密码改为你设置的新密码（有风险，见下文）"
        $mode = Read-Host '请选择 [1/2] (默认 1)'
    } else {
        Write-Host '  （当前环境不支持强制重置，请选手动填写）'
        $mode = '1'
    }
    if ([string]::IsNullOrWhiteSpace($mode)) { $mode = '1' }
    if ($mode -eq '2') {
        Reset-PostgresPasswordLocal $dbUser $dbHost $dbPort
    } else {
        Set-PostgresPasswordManual
    }
}

function Invoke-Configure {
    Write-LogInfo '配置应用环境...'
    Apply-CN-Mirrors
    if (-not (Test-Path $script:EnvFile)) {
        Copy-Item (Join-Path $script:BackendDir '.env.example') $script:EnvFile
        Write-LogInfo '已从 .env.example 创建 .env'
    }
    if (-not (Test-Path $script:DeployEnvFile)) {
        Copy-Item $script:DeployEnvExample $script:DeployEnvFile
    }
    Load-DeployEnv

    $dbUser = Read-EnvValue 'DB_USER'; if (-not $dbUser) { $dbUser = 'postgres' }
    $inputUser = Read-Host "PostgreSQL 用户名 [$dbUser]"
    if (-not [string]::IsNullOrWhiteSpace($inputUser)) { $dbUser = $inputUser }
    Set-EnvValue 'DB_USER' $dbUser

    $dbHost = Read-EnvValue 'DB_HOST'; if (-not $dbHost) { $dbHost = 'localhost' }
    $inputHost = Read-Host "PostgreSQL 主机 [$dbHost] (本地 localhost，远程填 IP)"
    if (-not [string]::IsNullOrWhiteSpace($inputHost)) { $dbHost = $inputHost }
    Set-EnvValue 'DB_HOST' $dbHost

    $dbName = Read-EnvValue 'DB_NAME'; if (-not $dbName) { $dbName = 'riveredge' }
    $inputName = Read-Host "数据库名 [$dbName]"
    if (-not [string]::IsNullOrWhiteSpace($inputName)) { $dbName = $inputName }
    Set-EnvValue 'DB_NAME' $dbName

    Invoke-PostgresPasswordSetup

    if ([string]::IsNullOrWhiteSpace((Read-EnvValue 'PLATFORM_SUPERADMIN_PASSWORD'))) {
        $sec = Read-Host '平台超级管理员密码 (登录用户名 infra_admin)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        $adminPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        if ($adminPass.Length -lt 8) { throw '超管密码至少 8 位' }
        Set-EnvValue 'PLATFORM_SUPERADMIN_PASSWORD' $adminPass
    } else {
        $sec = Read-Host '平台超管密码 [已配置，直接回车跳过]' -AsSecureString
        if ($sec.Length -gt 0) {
            $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
            $adminPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            if ($adminPass.Length -lt 8) { throw '超管密码至少 8 位' }
            Set-EnvValue 'PLATFORM_SUPERADMIN_PASSWORD' $adminPass
        }
    }

    $jwt = Read-EnvValue 'JWT_SECRET_KEY'
    if ([string]::IsNullOrWhiteSpace($jwt) -or $jwt -eq 'your-secret-key-here-change-in-production') {
        $bytes = New-Object byte[] 32
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $newJwt = [Convert]::ToBase64String($bytes) -replace '\+','-' -replace '/','_' -replace '=',''
        Set-EnvValue 'JWT_SECRET_KEY' $newJwt
        Write-LogInfo '已自动生成 JWT_SECRET_KEY'
    }

    $detectedIp = Detect-ServerIp
    $serverIp = Read-DeployEnvValue 'SERVER_IP'
    if ([string]::IsNullOrWhiteSpace($serverIp)) { $serverIp = $detectedIp }
    Write-LogInfo "检测到本机 IP: $detectedIp"
    $inputIp = Read-Host "服务器 IP (浏览器访问) [$serverIp]"
    if (-not [string]::IsNullOrWhiteSpace($inputIp)) { $serverIp = $inputIp }
    Set-DeployEnvValue 'SERVER_IP' $serverIp
    Load-DeployEnv

    if ($script:DeployMode -eq 'prod') {
        Write-Host ''
        Collect-ProdDomainHttpsConfig
        Load-DeployEnv
    }

    if ($script:DeployMode -eq 'prod') {
        Set-EnvValue 'ENVIRONMENT' 'production'
        Set-EnvValue 'DEBUG' 'false'
        $prodCors = Get-ProdCorsOrigins $serverIp
        Set-EnvValue 'BASE_URL' $prodCors.BaseUrl
        Set-EnvValue 'CORS_ORIGINS' $prodCors.Cors
    } else {
        Set-EnvValue 'HOST' '0.0.0.0'
        Set-EnvValue 'CORS_ORIGINS' "http://${serverIp}:$($script:FRONTEND_PORT),http://127.0.0.1:$($script:FRONTEND_PORT),http://localhost:$($script:FRONTEND_PORT),http://${serverIp}:8098,http://127.0.0.1:8098,http://localhost:8098,http://${serverIp}:8081,http://127.0.0.1:8081,http://localhost:8081,http://${serverIp}:8300,http://127.0.0.1:8300,http://localhost:8300"
    }

    Write-LogInfo '测试数据库连接...'
    if (-not (Test-DbConnection)) { throw '数据库连接失败，请确认 PostgreSQL 已启动且 DB_* 配置正确' }
    Write-LogOk '配置完成'
    Write-Host "  数据库: ${dbUser}@${dbHost}/${dbName}"
    Write-Host '  超管账号: infra_admin'
    Write-Host "  蓝绿部署: $(Get-BlueGreenDeployStatusLabel)"
    if ($script:DeployMode -eq 'prod') {
        $webUrl = Resolve-ProdWebUrl $serverIp
        Write-Host "  访问地址: $webUrl"
        if ($script:CADDY_DOMAIN -and $script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
            Write-Host "  备用 IP: http://${serverIp}:$($script:PROXY_PORT)"
        }
    } else {
        Write-Host "  访问地址: http://${serverIp}:$($script:FRONTEND_PORT) (Web) / http://${serverIp}:$($script:BACKEND_PORT) (API)"
    }
    Write-SupportContact
}

function Ensure-PyzbarWindowsNative {
    $dll = Join-Path $script:BackendDir '.venv\Lib\site-packages\pyzbar\libzbar-64.dll'
    if (Test-Path $dll) { return }
    Write-LogWarn 'pyzbar 缺少 Windows 原生 DLL (libzbar-64.dll)，正在重装 pyzbar...'
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        & $uv pip install --force-reinstall 'pyzbar>=0.1.9'
        if ($LASTEXITCODE -ne 0) {
            Write-LogWarn 'pyzbar 重装未成功，二维码图片解析不可用，但不影响后端启动'
            return
        }
        if (Test-Path $dll) { Write-LogOk 'pyzbar Windows 原生库已就绪' }
        else { Write-LogWarn '仍未找到 libzbar-64.dll，二维码图片解析不可用' }
    } finally { Pop-Location }
}

function Test-PlaywrightPostInstallEnabled {
    Load-DeployEnv
    return ($script:PLAYWRIGHT_POSTINSTALL_ENABLE -ne '0')
}

function Resolve-PlaywrightBrowsersPath {
    Load-DeployEnv
    if ($script:PLAYWRIGHT_BROWSERS_PATH) { return $script:PLAYWRIGHT_BROWSERS_PATH }
    return (Join-Path $script:ProjectRoot '.playwright-browsers')
}

function Set-PlaywrightEnv {
    if (-not (Test-PlaywrightPostInstallEnabled)) { return }
    $path = Resolve-PlaywrightBrowsersPath
    $env:PLAYWRIGHT_BROWSERS_PATH = $path
    if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

function Test-PlaywrightChromiumProbe {
    Set-PlaywrightEnv
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        $code = @'
import os
import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    exe = p.chromium.executable_path
    if exe and os.path.isfile(exe):
        sys.exit(0)
sys.exit(1)
'@
        & $uv run --extra pdf python -c $code 2>$null
        return ($LASTEXITCODE -eq 0)
    } finally { Pop-Location }
}

function Get-PlaywrightCurrentVersion {
    Set-PlaywrightEnv
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        $out = & $uv run --extra pdf python -m playwright --version 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $out) { return '' }
        return ($out -split '\s+')[1]
    } finally { Pop-Location }
}

function Set-PlaywrightChromiumMarker {
    Ensure-LogsDir
    $marker = Join-Path $script:LogsDir 'playwright-chromium.ready'
    $ver = Get-PlaywrightCurrentVersion
    if (-not $ver) { $ver = 'unknown' }
    Set-Content -Path $marker -Value @($ver, (Get-Date -Format o)) -Encoding UTF8
}

function Test-PlaywrightChromiumMarkerStale {
    Ensure-LogsDir
    $marker = Join-Path $script:LogsDir 'playwright-chromium.ready'
    if (-not (Test-Path $marker)) { return $true }
    $cur = Get-PlaywrightCurrentVersion
    if (-not $cur) { return $true }
    $markerVer = (Get-Content $marker -TotalCount 1 -ErrorAction SilentlyContinue).Trim()
    return ($cur -ne $markerVer)
}

function Ensure-PlaywrightChromiumSync {
    if (-not (Test-PlaywrightPostInstallEnabled)) { return }
    if (-not (Test-Path $script:BackendDir)) { return }
    Ensure-LogsDir
    $logFile = Join-Path $script:LogsDir 'playwright-install.log'

    if (Test-PlaywrightChromiumProbe) {
        if (Test-PlaywrightChromiumMarkerStale) { Set-PlaywrightChromiumMarker }
        return
    }

    $running = Get-Job -Name 'RiverEdgePlaywrightInstall' -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Running' }
    if ($running) {
        Write-LogInfo '等待 Playwright Chromium 后台补装完成...'
        Wait-Job -Job $running -Timeout 600 | Out-Null
        if (Test-PlaywrightChromiumProbe) { return }
    }

    Set-PlaywrightEnv
    $uv = Resolve-Uv
    $browserPath = $env:PLAYWRIGHT_BROWSERS_PATH
    Write-LogInfo "安装 Playwright Chromium（生产同步，路径: $browserPath）..."
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        & $uv run --extra pdf python -m playwright --version *>> $logFile
        if ($LASTEXITCODE -ne 0) {
            throw 'Playwright 模块不可用，请先 Sync-BackendDeps'
        }
        Add-Content $logFile "[$(Get-Date -Format o)] start: playwright install chromium (sync)"
        & $uv run --extra pdf python -m playwright install chromium *>> $logFile
        if ($LASTEXITCODE -ne 0) { throw "Playwright Chromium 安装失败，详见 $logFile" }
        Set-PlaywrightChromiumMarker
        Add-Content $logFile "[$(Get-Date -Format o)] ok: Playwright Chromium 安装完成"
    } finally { Pop-Location }
    Write-LogOk 'Playwright Chromium 已就绪'
}

function Ensure-PlaywrightChromiumPostInstall {
    # 后台补装 Chromium，不阻塞 start / deploy 主流程（PDF 打印就绪前可能短暂不可用）
    if (-not (Test-PlaywrightPostInstallEnabled)) { return }
    Ensure-LogsDir
    $marker = Join-Path $script:LogsDir 'playwright-chromium.ready'
    $logFile = Join-Path $script:LogsDir 'playwright-install.log'
    $pidf = Join-Path $script:LogsDir 'playwright-install.pid'
    if (-not (Test-Path $script:BackendDir)) { return }

    if ((Test-PlaywrightChromiumProbe)) {
        if (Test-PlaywrightChromiumMarkerStale) { Set-PlaywrightChromiumMarker }
        return
    }

    $running = Get-Job -Name 'RiverEdgePlaywrightInstall' -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Running' }
    if ($running) {
        Write-LogInfo "Playwright Chromium 后台补装进行中（Job $($running.Id)），详见 $logFile"
        return
    }

    if (Test-Path $marker) { Remove-Item $marker -Force }

    Write-LogInfo '补装 Playwright Chromium 运行时（后台执行，不阻塞启动）...'
    $uv = Resolve-Uv
    $backendDir = $script:BackendDir
    $browserPath = Resolve-PlaywrightBrowsersPath
    Start-Job -Name 'RiverEdgePlaywrightInstall' -ScriptBlock {
        param($BackendDir, $Uv, $Marker, $LogFile, $PidFile, $BrowsersPath)
        $env:PYTHONPATH = Join-Path $BackendDir 'src'
        $env:PLAYWRIGHT_BROWSERS_PATH = $BrowsersPath
        if (-not (Test-Path $BrowsersPath)) { New-Item -ItemType Directory -Path $BrowsersPath -Force | Out-Null }
        Push-Location $BackendDir
        try {
            & $Uv run --extra pdf python -m playwright --version *>> $LogFile
            if ($LASTEXITCODE -ne 0) {
                Add-Content $LogFile "[$(Get-Date -Format o)] skip: Playwright 模块不可用"
                return
            }
            Add-Content $LogFile "[$(Get-Date -Format o)] start: playwright install chromium"
            & $Uv run --extra pdf python -m playwright install chromium *>> $LogFile
            if ($LASTEXITCODE -eq 0) {
                $ver = (& $Uv run --extra pdf python -m playwright --version 2>$null) -split '\s+' | Select-Object -Skip 1 -First 1
                if (-not $ver) { $ver = 'unknown' }
                Set-Content -Path $Marker -Value @($ver, (Get-Date -Format o)) -Encoding UTF8
                Add-Content $LogFile "[$(Get-Date -Format o)] ok: Playwright Chromium 补装完成"
            } else {
                Add-Content $LogFile "[$(Get-Date -Format o)] fail: Playwright Chromium 补装失败"
            }
        } finally {
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            Pop-Location
        }
    } -ArgumentList $backendDir, $uv, $marker, $logFile, $pidf, $browserPath | Out-Null
    Write-LogInfo "Playwright 补装已在后台运行，详见 $logFile"
}

function Sync-BackendDeps {
    if ($script:BackendDepsSynced) { return }
    Apply-CN-Mirrors
    Write-LogInfo '同步 Python 依赖...'
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
        $env:UV_LINK_MODE = 'copy'
        $env:UV_HTTP_TIMEOUT = '600'
        # ocr：发票 PDF 明细识别；pdf：Playwright HTML→PDF
        $syncArgs = @('sync', '--no-install-project', '--extra', 'ocr')
        if (Test-PlaywrightPostInstallEnabled) { $syncArgs += '--extra', 'pdf' }
        & $uv @syncArgs
        if ($LASTEXITCODE -ne 0) { throw 'uv sync 失败' }
    } finally { Pop-Location }
    Ensure-PyzbarWindowsNative
    $script:BackendDepsSynced = $true
}

function Ensure-SensitiveLexiconPack {
    $pack = Join-Path $script:BackendDir 'src/core/data/sensitive_words/lexicon.pack'
    $force = ($env:FORCE_LEXICON_REPACK -eq '1')
    if (-not $force -and (Test-Path $pack) -and ((Get-Item $pack).Length -gt 0)) {
        Write-LogInfo '敏感词 lexicon.pack 已存在'
        return
    }
    Write-LogInfo '生成敏感词 lexicon.pack（未入库，须部署机生成）...'
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        & $uv run python scripts/pack_sensitive_words.py
        if ($LASTEXITCODE -ne 0) {
            throw '生成 lexicon.pack 失败。检查出网或手动执行: cd riveredge-backend; uv run python scripts/pack_sensitive_words.py'
        }
    } finally { Pop-Location }
    if (-not (Test-Path $pack) -or ((Get-Item $pack).Length -le 0)) {
        throw "lexicon.pack 未生成: $pack"
    }
    Write-LogOk '敏感词 lexicon.pack 已就绪'
}

function Ensure-TimezoneEnv {
    if (-not (Test-Path $script:EnvFile)) {
        Copy-Item (Join-Path $script:BackendDir '.env.example') $script:EnvFile
    }
    $tz = Read-EnvValue 'TIMEZONE'
    $useTz = Read-EnvValue 'USE_TZ'
    $changed = $false
    $tzNorm = if ($null -eq $tz) { '' } else { $tz.Trim().ToLowerInvariant() }
    $useNorm = if ($null -eq $useTz) { '' } else { $useTz.Trim().ToLowerInvariant() }
    if ($tzNorm -in @('', 'utc', 'gmt', 'etc/utc', 'etc/gmt')) {
        Set-EnvValue 'TIMEZONE' 'Asia/Shanghai'
        Write-LogWarn "已纠正 TIMEZONE=$(if ([string]::IsNullOrEmpty($tz)) { '<空>' } else { $tz }) → Asia/Shanghai（旧 .env.example 误写 UTC）"
        $changed = $true
    }
    if ($useNorm -in @('', 'false', '0', 'no')) {
        Set-EnvValue 'USE_TZ' 'true'
        Write-LogWarn "已纠正 USE_TZ=$(if ([string]::IsNullOrEmpty($useTz)) { '<空>' } else { $useTz }) → true"
        $changed = $true
    }
    if ($changed) {
        $script:ForceBackendRestart = $true
        Write-LogOk "时区环境已校正：TIMEZONE=$(Read-EnvValue 'TIMEZONE') USE_TZ=$(Read-EnvValue 'USE_TZ')；将强制重启后端"
    } else {
        Write-LogInfo "时区环境 OK：TIMEZONE=$tz USE_TZ=$useTz"
    }
}

function Test-PgvectorAvailableInAppDb {
    $host_ = Read-EnvValue 'DB_HOST'; if (-not $host_) { $host_ = 'localhost' }
    $port = Read-EnvValue 'DB_PORT'; if (-not $port) { $port = '5432' }
    $user = Read-EnvValue 'DB_USER'; if (-not $user) { $user = 'postgres' }
    $pass = Read-EnvValue 'DB_PASSWORD'
    $dbname = Read-EnvValue 'DB_NAME'; if (-not $dbname) { $dbname = 'riveredge' }
    $env:PGPASSWORD = $pass
    try {
        $out = & psql -h $host_ -p $port -U $user -d $dbname -tAc "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'" 2>$null
        return ($out.Trim() -eq '1')
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Test-VectorExtensionInstalledInAppDb {
    $host_ = Read-EnvValue 'DB_HOST'; if (-not $host_) { $host_ = 'localhost' }
    $port = Read-EnvValue 'DB_PORT'; if (-not $port) { $port = '5432' }
    $user = Read-EnvValue 'DB_USER'; if (-not $user) { $user = 'postgres' }
    $pass = Read-EnvValue 'DB_PASSWORD'
    $dbname = Read-EnvValue 'DB_NAME'; if (-not $dbname) { $dbname = 'riveredge' }
    $env:PGPASSWORD = $pass
    try {
        $out = & psql -h $host_ -p $port -U $user -d $dbname -tAc "SELECT 1 FROM pg_extension WHERE extname = 'vector'" 2>$null
        return ($out.Trim() -eq '1')
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Invoke-PgvectorSuperuserSql([string]$Sql) {
    $host_ = Read-EnvValue 'DB_HOST'; if (-not $host_) { $host_ = 'localhost' }
    $port = Read-EnvValue 'DB_PORT'; if (-not $port) { $port = '5432' }
    $pass = Read-EnvValue 'DB_PASSWORD'
    $dbname = Read-EnvValue 'DB_NAME'; if (-not $dbname) { $dbname = 'riveredge' }
    $env:PGPASSWORD = $pass
    try {
        & psql -h $host_ -p $port -U postgres -d $dbname -v ON_ERROR_STOP=1 -c $Sql
        return ($LASTEXITCODE -eq 0)
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Ensure-Pgvector {
    if (Test-PgvectorAvailableInAppDb) {
        Write-LogOk '应用库已具备 pgvector'
        return
    }
    $host_ = Read-EnvValue 'DB_HOST'; if (-not $host_) { $host_ = 'localhost' }
    if ($host_ -ne 'localhost' -and $host_ -ne '127.0.0.1') {
        throw '远程数据库无法在本机安装 pgvector，请在数据库服务器安装 vector 扩展'
    }
    $ps = Join-Path $script:FastDeployDir 'windows\install-pgvector.ps1'
    if (-not (Test-Path $ps)) { throw "缺少 pgvector 安装脚本: $ps" }
    Write-LogInfo '安装 pgvector 扩展文件（写入 PostgreSQL 目录）...'
    $mirror = if ($script:UseMirror) { '1' } else { '0' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ps -FastDeployDir $script:FastDeployDir -UseMirror $mirror
    if ($LASTEXITCODE -ne 0) { throw 'pgvector 安装失败（请以管理员身份运行安装/迁移）' }
    if (-not (Test-PgvectorAvailableInAppDb)) {
        throw 'pgvector 安装后应用库仍不可用，请重启 PostgreSQL 服务后重试 migrate'
    }
    Write-LogOk 'pgvector 已对应用库可用'
}

function Ensure-VectorExtensionCreated {
    if (Test-VectorExtensionInstalledInAppDb) {
        Write-LogOk '应用库已启用 vector 扩展'
        return
    }
    if (-not (Test-PgvectorAvailableInAppDb)) {
        throw '应用库尚无 pgvector 系统扩展，无法 CREATE EXTENSION'
    }
    $host_ = Read-EnvValue 'DB_HOST'; if (-not $host_) { $host_ = 'localhost' }
    if ($host_ -ne 'localhost' -and $host_ -ne '127.0.0.1') {
        throw '远程库需超级用户执行: CREATE EXTENSION IF NOT EXISTS vector;'
    }
    Write-LogInfo '以超级用户在应用库创建 vector 扩展...'
    if (-not (Invoke-PgvectorSuperuserSql 'CREATE EXTENSION IF NOT EXISTS vector;')) {
        throw '超级用户 CREATE EXTENSION vector 失败'
    }
    if (-not (Test-VectorExtensionInstalledInAppDb)) {
        throw 'CREATE EXTENSION 后应用库仍无 vector'
    }
    Write-LogOk '已在应用库创建 vector 扩展'
}

function Invoke-Migrate {
    Sync-BackendDeps
    Ensure-TimezoneEnv
    Ensure-SensitiveLexiconPack
    Ensure-Pgvector
    Ensure-VectorExtensionCreated
    Write-LogInfo '执行数据库迁移...'
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        $env:PYTHONUNBUFFERED = '1'
        $env:AERICH_MIGRATE = '1'
        & $uv run aerich upgrade
        if ($LASTEXITCODE -ne 0) { throw '数据库迁移失败' }
    } finally { Pop-Location }
    Write-LogOk '迁移完成'
}

function Ensure-FrontendDeps {
    Apply-CN-Mirrors
    if (-not (Test-Path (Join-Path $script:FrontendDir 'node_modules'))) {
        Write-LogInfo '安装前端依赖...'
        Push-Location $script:FrontendDir
        try {
            npm install --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) { throw 'npm install 失败' }
        } finally { Pop-Location }
    }
}

function Invoke-Build {
    Ensure-FrontendDeps
    Write-LogInfo '构建 Web 前端...'
    Push-Location $script:FrontendDir
    try {
        $env:NODE_OPTIONS = "--max-old-space-size=$($script:NODE_BUILD_MEM)"
        npm run build
        if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }
    } finally { Pop-Location }
    if (-not (Test-Path (Join-Path $script:FrontendDir 'dist\index.html'))) { throw '缺少 dist/index.html' }
    if (-not (Test-Path (Join-Path $script:FrontendDir 'dist\login.html'))) { throw '缺少 dist/login.html（登录 MPA）' }
    Write-LogOk '前端构建完成'
}

function Ensure-FrontendDist {
    Load-DeployEnv
    $index = Join-Path $script:FrontendDir 'dist\index.html'
    $login = Join-Path $script:FrontendDir 'dist\login.html'
    if ($script:ALLOW_SERVER_BUILD -eq '1') {
        Write-LogWarn 'ALLOW_SERVER_BUILD=1，执行服务器构建（内存占用高，不推荐）...'
        Invoke-Build
        return
    }
    if (Test-Path $index) {
        if (-not (Test-Path $login)) {
            throw '缺少 dist/login.html（登录 MPA）。请重新执行 fast-deploy/build.web.sh 并推送'
        }
        Write-LogOk '已检测到 Web dist（含 login.html），跳过服务器构建（Caddy 直接代理 Git 中的 dist）'
        return
    }
    throw '缺少 dist/index.html。请在本地 fast-deploy/build.web.sh 构建并推送，或设置 ALLOW_SERVER_BUILD=1'
}

function Sync-ProdAppUrls {
    Load-DeployEnv
    if ($script:DeployMode -ne 'prod') { return }
    if (-not (Test-Path $script:EnvFile)) { return }
    $serverIp = Read-DeployEnvValue 'SERVER_IP'
    if ([string]::IsNullOrWhiteSpace($serverIp)) { $serverIp = Detect-ServerIp }
    $prodCors = Get-ProdCorsOrigins $serverIp
    $curBase = Read-EnvValue 'BASE_URL'
    $curCors = Read-EnvValue 'CORS_ORIGINS'
    if ($curBase -ne $prodCors.BaseUrl -or $curCors -ne $prodCors.Cors) {
        Set-EnvValue 'BASE_URL' $prodCors.BaseUrl
        Set-EnvValue 'CORS_ORIGINS' $prodCors.Cors
        Write-LogInfo '已同步 BASE_URL / CORS_ORIGINS（含 www 域名）'
    }
}

function Write-MobileWebDistPlaceholder {
    if (-not (Test-Path $script:MobileWebDir)) {
        New-Item -ItemType Directory -Path $script:MobileWebDir -Force | Out-Null
    }
    $html = @'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>移动端 H5 未安装</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.6; color: #222; }
    code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>移动端 H5 尚未安装</h1>
  <p>主仓已正常运行。手机端为可选扩展，需私仓 <code>kuaigeyun-client</code>。</p>
  <p>安装：<code>./fast-deploy/deploy.sh install-h5</code><br />
  或向导菜单 <strong>[4] 扩展应用 → [3] 安装 H5</strong></p>
</body>
</html>
'@
    Set-Content -Path (Join-Path $script:MobileWebDir 'index.html') -Value $html -Encoding UTF8
    Write-LogWarn "已写入 H5 占位页 → $($script:MobileWebDir)（不影响主仓启动）"
}

# 主仓 start 不因 H5 私仓阻断；缺产物时写占位页。
function Ensure-MobileWebDist {
    $index = Join-Path $script:MobileWebDir 'index.html'
    if (Test-Path $index) { return }
    Write-LogWarn "未部署移动端 H5（可选扩展）。主仓继续启动；需要时执行 ./fast-deploy/deploy.sh install-h5"
    Write-MobileWebDistPlaceholder
}

function New-Caddyfile {
    Load-DeployEnv
    Sync-ProdAppUrls
    if (-not (Test-Path $script:CaddyDir)) { New-Item -ItemType Directory -Path $script:CaddyDir -Force | Out-Null }
    if (-not (Test-Path $script:CaddyTemplate)) { throw "缺少模板 $script:CaddyTemplate" }

    $backendAddr = "127.0.0.1:$($script:BACKEND_PORT)"
    $frontendRoot = (Join-Path $script:FrontendDir 'dist') -replace '\\','/'
    if (Test-BgEnabled) {
        Initialize-BgFrontendSlots
        $backendAddr = "127.0.0.1:$(Get-BgSlotPort (Get-BgActiveSlot))"
        $frontendRoot = Get-BgFrontendRootForCaddy
    }
    Ensure-MobileWebDist
    $mobileWebRoot = $script:MobileWebDir -replace '\\','/'

    if ($script:CADDY_DOMAIN) {
        $addr = Get-CaddySiteAddrForDomain $script:CADDY_DOMAIN
    } else { $addr = ":$($script:PROXY_PORT)" }

    $clientReleaseRoot = if ($script:CLIENT_RELEASE_ROOT) {
        $script:CLIENT_RELEASE_ROOT -replace '\\','/'
    } else {
        (Join-Path $script:BackendDir 'uploads/clients') -replace '\\','/'
    }
    $fileUploadRoot = if ($script:FILE_UPLOAD_ROOT) {
        $script:FILE_UPLOAD_ROOT -replace '\\','/'
    } elseif ($clientReleaseRoot -match '/clients$') {
        ($clientReleaseRoot -replace '/clients$','')
    } else {
        (Join-Path $script:BackendDir 'uploads') -replace '\\','/'
    }

    $content = (Get-Content $script:CaddyTemplate -Raw).Replace('{{ADDR}}', $addr).Replace('{{BACKEND_ADDR}}', $backendAddr).Replace('{{FRONTEND_ROOT}}', $frontendRoot).Replace('{{MOBILE_WEB_ROOT}}', $mobileWebRoot).Replace('{{CLIENT_RELEASE_ROOT}}', $clientReleaseRoot).Replace('{{FILE_UPLOAD_ROOT}}', $fileUploadRoot)

    $tmp = "$script:Caddyfile.tmp"
    Set-Content -Path $tmp -Value $content -Encoding UTF8
    if ($content -match '\{\{') {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        throw 'Generated Caddyfile is invalid (unsubstituted placeholders)'
    }
    if (-not ($content -match '(?m)file_server')) {
        Remove-Item $tmp -Force
        throw '生成的 Caddyfile 无效'
    }
    Move-Item $tmp $script:Caddyfile -Force
    Write-LogOk '已生成 Caddyfile'
}

function Install-Caddy {
    $cmd = 'winget install -e --id CaddyServer.Caddy --accept-package-agreements --accept-source-agreements'
    Write-LogInfo "安装 caddy..."
    Write-LogInfo "执行: $cmd"
    cmd.exe /c $cmd
    if ($LASTEXITCODE -ne 0) { throw "caddy 安装失败，请手动执行: $cmd" }
    Write-LogOk "Caddy 已通过 winget 安装"
}

function Start-ProcessBackground([string]$Name, [string]$FilePath, [string[]]$ArgumentList, [hashtable]$EnvVars) {
    Ensure-LogsDir
    $logFile = Join-Path $script:LogsDir "$Name.log"
    $pidFile = Join-Path $script:LogsDir "$Name.pid"
    $workDir = if ($EnvVars['WORKDIR']) { $EnvVars['WORKDIR'] } else { $script:ProjectRoot }
    Push-Location $workDir
    try {
        foreach ($k in $EnvVars.Keys) {
            if ($k -ne 'WORKDIR') { Set-Item -Path "env:$k" -Value $EnvVars[$k] }
        }
        $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
            -RedirectStandardOutput $logFile -RedirectStandardError $logFile `
            -PassThru -NoNewWindow -WorkingDirectory $workDir
        Set-Content -Path $pidFile -Value $proc.Id
        return $proc.Id
    } finally {
        Pop-Location
    }
}

function Start-BackendDev {
    Ensure-TimezoneEnv
    Ensure-SensitiveLexiconPack
    if (Test-BgEnabled) {
        Initialize-BgState
        Start-BgBackendSlot (Get-BgActiveSlot) 'dev'
        Start-BgDevApiProxy
        return
    }
    Stop-Port $script:BACKEND_PORT
    Write-LogInfo "启动后端 (dev, :$($script:BACKEND_PORT))..."
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        $env:SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
        $env:HOST = '0.0.0.0'
        $env:PORT = "$($script:BACKEND_PORT)"
        $args = @('run','--extra','pdf','python','scripts/run_dev_server.py')
        $pid = Start-ProcessBackground 'backend' $uv $args @{ PYTHONPATH = $env:PYTHONPATH; SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir; HOST = $env:HOST; PORT = $env:PORT; WORKDIR = $script:BackendDir }
    } finally { Pop-Location }
    $retries = 0
    while ($retries -lt $script:BackendStartTimeout) {
        if (Test-PortInUse $script:BACKEND_PORT) { break }
        Start-Sleep -Seconds 1
        $retries++
    }
    if (-not (Test-PortInUse $script:BACKEND_PORT)) { throw '后端启动超时' }
    Write-LogOk '后端就绪'
}

function Start-WorkerDev {
    Write-LogInfo '启动 Taskiq Worker/Scheduler (dev)...'
    Stop-ServiceByPidFile 'worker'
    Stop-ServiceByPidFile 'scheduler'
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        $wArgs = @('run','--extra','pdf','taskiq','worker','core.tasks.taskiq_app:broker',
            '--workers',"$($script:TASKIQ_WORKERS)",
            'core.tasks.taskiq_app','core.tasks.ai_tasks','core.tasks.worker_bootstrap','core.tasks.data_backup_handlers')
        Start-ProcessBackground 'worker' $uv $wArgs @{ PYTHONPATH = $env:PYTHONPATH; WORKDIR = $script:BackendDir }
        $sArgs = @('run','--extra','pdf','taskiq','scheduler','core.tasks.taskiq_app:scheduler',
            'core.tasks.taskiq_app')
        Start-ProcessBackground 'scheduler' $uv $sArgs @{ PYTHONPATH = $env:PYTHONPATH; WORKDIR = $script:BackendDir }
    } finally { Pop-Location }
    Write-LogOk 'Taskiq 已启动'
}

function Start-FrontendDev {
    Stop-Port $script:FRONTEND_PORT
    Ensure-FrontendDeps
    Write-LogInfo "启动前端 (dev, :$($script:FRONTEND_PORT))..."
    Push-Location $script:FrontendDir
    try {
        $env:VITE_BACKEND_HOST = if ($env:VITE_BACKEND_HOST) { $env:VITE_BACKEND_HOST } else { '127.0.0.1' }
        $env:VITE_BACKEND_PORT = if ($env:VITE_BACKEND_PORT) { $env:VITE_BACKEND_PORT } else { "$($script:BACKEND_PORT)" }
        Start-ProcessBackground 'frontend' 'npx' @('vite',"--port",$script:FRONTEND_PORT,'--host','0.0.0.0') @{
            WORKDIR = $script:FrontendDir
            VITE_BACKEND_HOST = $env:VITE_BACKEND_HOST
            VITE_BACKEND_PORT = $env:VITE_BACKEND_PORT
        }
    } finally { Pop-Location }
    Write-LogOk '前端已启动'
}

function Start-BackendProd {
    Ensure-TimezoneEnv
    Ensure-SensitiveLexiconPack
    if (Test-BgEnabled) {
        Initialize-BgState
        Start-BgBackendSlot (Get-BgActiveSlot) 'prod'
        return
    }
    $pidf = Join-Path $script:LogsDir 'backend.pid'
    if (-not $script:ForceBackendRestart -and (Test-Path $pidf)) {
        $pid = [int](Get-Content $pidf -Raw).Trim()
        if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { Write-LogInfo '后端已在运行'; return }
    }
    if ($script:ForceBackendRestart -and (Test-Path $pidf)) {
        Write-LogInfo '时区已校正，强制重启后端...'
        Stop-ServiceByPidFile 'backend'
    }
    Sync-BackendDeps
    Write-LogInfo "启动后端 (prod, :$($script:BACKEND_PORT))..."
    $uv = Resolve-Uv
    Set-PlaywrightEnv
    $args = @('run','--extra','pdf','uvicorn','server.main:app','--host','127.0.0.1',"--port",$script:BACKEND_PORT,'--workers','1')
    Start-ProcessBackground 'backend' $uv $args @{
        PORT = $script:BACKEND_PORT; HOST = '127.0.0.1'; ENVIRONMENT = 'production'; DEBUG = 'false'
        SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir; PYTHONPATH = (Join-Path $script:BackendDir 'src')
        PLAYWRIGHT_BROWSERS_PATH = $env:PLAYWRIGHT_BROWSERS_PATH; WORKDIR = $script:BackendDir
    }
    Start-Sleep -Seconds 3
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:$($script:BACKEND_PORT)/health" -UseBasicParsing -TimeoutSec 5 | Out-Null
    } catch { throw "后端启动失败，查看 $script:LogsDir\backend.log" }
    Write-LogOk '后端已启动'
}

function Start-WorkerProd {
    Sync-BackendDeps
    $uv = Resolve-Uv
    $workerPidFile = Join-Path $script:LogsDir 'worker.pid'
    $workerLogFile = Join-Path $script:LogsDir 'worker.log'
    if (-not (Test-PidFileAlive $workerPidFile)) {
        Remove-Item $workerPidFile -Force -ErrorAction SilentlyContinue
        Write-LogInfo '启动 Taskiq Worker...'
        Set-PlaywrightEnv
        $args = @(
            'run','--extra','pdf','taskiq','worker','--app-dir','src',
            '--workers',"$($script:TASKIQ_WORKERS)",
            'core.tasks.taskiq_app:broker',
            'core.tasks.taskiq_app','core.tasks.ai_tasks','core.tasks.worker_bootstrap','core.tasks.data_backup_handlers'
        )
        Start-ProcessBackground 'worker' $uv $args @{
            ENVIRONMENT = 'production'; SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
            PYTHONPATH = (Join-Path $script:BackendDir 'src'); PLAYWRIGHT_BROWSERS_PATH = $env:PLAYWRIGHT_BROWSERS_PATH
            WORKDIR = $script:BackendDir
        }
        if (-not (Wait-TaskiqServiceReady 'Worker' $workerPidFile $workerLogFile 'Taskiq worker 已注册任务|Starting [0-9]+ worker processes')) { throw 'Worker 启动失败' }
    } else {
        Write-LogInfo 'Worker 已在运行'
    }
    $schedulerPidFile = Join-Path $script:LogsDir 'scheduler.pid'
    $schedulerLogFile = Join-Path $script:LogsDir 'scheduler.log'
    if (-not (Test-PidFileAlive $schedulerPidFile)) {
        Remove-Item $schedulerPidFile -Force -ErrorAction SilentlyContinue
        Write-LogInfo '启动 Taskiq Scheduler...'
        Set-PlaywrightEnv
        $args = @(
            'run','--extra','pdf','taskiq','scheduler','--app-dir','src',
            'core.tasks.taskiq_app:scheduler','core.tasks.taskiq_app'
        )
        Start-ProcessBackground 'scheduler' $uv $args @{
            ENVIRONMENT = 'production'; SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
            PYTHONPATH = (Join-Path $script:BackendDir 'src'); PLAYWRIGHT_BROWSERS_PATH = $env:PLAYWRIGHT_BROWSERS_PATH
            WORKDIR = $script:BackendDir
        }
        if (-not (Wait-TaskiqServiceReady 'Scheduler' $schedulerPidFile $schedulerLogFile 'Startup completed|Starting scheduler')) { throw 'Scheduler 启动失败' }
    } else {
        Write-LogInfo 'Scheduler 已在运行'
    }
    Write-LogOk 'Taskiq 已启动'
}

function Test-CaddyHttpsEnabled {
    Load-DeployEnv
    return ($script:CADDY_DOMAIN -and $script:CADDY_ENABLE_LETSENCRYPT -eq 'true')
}

function Set-CaddyEnv {
    Load-DeployEnv
    $data = if ($env:CADDY_DATA_DIR) { $env:CADDY_DATA_DIR }
        elseif ($script:CADDY_DATA_DIR) { $script:CADDY_DATA_DIR }
        else { Join-Path $script:ProjectRoot '.caddy-data' }
    $config = if ($env:CADDY_CONFIG_DIR) { $env:CADDY_CONFIG_DIR }
        elseif ($script:CADDY_CONFIG_DIR) { $script:CADDY_CONFIG_DIR }
        else { Join-Path $script:ProjectRoot '.caddy-config' }
    $env:XDG_DATA_HOME = $data
    $env:XDG_CONFIG_HOME = $config
    foreach ($d in @($data, $config)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
}

function Wait-ForCaddyListening {
    Load-DeployEnv
    $timeout = if ($script:CADDY_START_TIMEOUT) { [int]$script:CADDY_START_TIMEOUT } else { 45 }
    for ($i = 0; $i -lt $timeout; $i++) {
        if (Test-CaddyHttpsEnabled) {
            if (Test-PortInUse 443) { return $true }
        } elseif (Test-PortInUse $script:PROXY_PORT) {
            return $true
        }
        $pidf = Join-Path $script:LogsDir 'caddy.pid'
        if (Test-Path $pidf) {
            $pid = [int](Get-Content $pidf -Raw).Trim()
            if (-not (Get-Process -Id $pid -ErrorAction SilentlyContinue)) { return $false }
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-CaddyProd {
    param([switch]$Force)
    New-Caddyfile
    Load-DeployEnv
    Set-CaddyEnv
    $caddy = Resolve-Caddy
    if (-not $caddy) { throw '未安装 Caddy，请运行 install' }
    $pidf = Join-Path $script:LogsDir 'caddy.pid'
    if ((Test-Path $pidf) -and (Test-PidFileAlive $pidf)) {
        if ($Force) {
            Write-LogInfo '强制重启 Caddy...'
            Stop-ServiceByPidFile 'caddy'
            Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Remove-Item $pidf -Force -ErrorAction SilentlyContinue
        } else {
            Write-LogInfo 'Caddy 已在运行'
            return
        }
    }
    & $caddy validate --config $script:Caddyfile 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        & $caddy validate --config $script:Caddyfile
        throw 'Caddyfile 校验失败'
    }
    if (Test-CaddyHttpsEnabled) {
        Write-LogInfo "启动 Caddy (HTTPS :443 + HTTP :80, 域名 $($script:CADDY_DOMAIN), 数据 $($env:XDG_DATA_HOME))..."
    } else {
        Write-LogInfo "启动 Caddy (:$($script:PROXY_PORT))..."
    }
    Start-ProcessBackground 'caddy' $caddy @('run',"--config",$script:Caddyfile) @{
        WORKDIR = $script:ProjectRoot
        XDG_DATA_HOME = $env:XDG_DATA_HOME
        XDG_CONFIG_HOME = $env:XDG_CONFIG_HOME
    }
    if (-not (Wait-ForCaddyListening)) {
        $logFile = Join-Path $script:LogsDir 'caddy.log'
        if (Test-Path $logFile) { Get-Content $logFile -Tail 30 | ForEach-Object { Write-LogError $_ } }
        throw "Caddy 未监听端口（等待 $($script:CADDY_START_TIMEOUT)s 超时），查看 $logFile"
    }
    Write-LogOk 'Caddy 已启动'
}

function Invoke-StartDev {
    Ensure-LogsDir
    Load-DeployEnv
    Invoke-Migrate
    Start-BackendDev
    Start-WorkerDev
    Start-FrontendDev
    Ensure-PlaywrightChromiumPostInstall
    Write-LogOk 'RiverEdge 开发环境已就绪'
    $lanIp = Detect-ServerIp
    Write-Host "  Web:  http://127.0.0.1:$($script:FRONTEND_PORT)  |  http://localhost:$($script:FRONTEND_PORT)"
    Write-Host "  API:  http://127.0.0.1:$($script:BACKEND_PORT)  |  http://localhost:$($script:BACKEND_PORT)"
    if ($lanIp -and $lanIp -ne '127.0.0.1') {
        Write-Host "  局域网 Web: http://${lanIp}:$($script:FRONTEND_PORT)"
        Write-Host "  局域网 API: http://${lanIp}:$($script:BACKEND_PORT)"
    }
    Write-SupportContact
}

function Invoke-StartProd {
    Ensure-LogsDir
    Load-DeployEnv
    if (-not (Test-Path (Join-Path $script:FrontendDir 'dist\index.html'))) { throw '缺少前端 dist，请先运行 build' }
    Start-BackendProd
    Start-WorkerProd
    Start-CaddyProd
    Ensure-PlaywrightChromiumPostInstall
    Write-LogOk 'RiverEdge 生产环境已就绪'
    $accessIp = if ($script:SERVER_IP) { $script:SERVER_IP } else { '127.0.0.1' }
    $webUrl = Resolve-ProdWebUrl $accessIp
    Write-Host "  访问: $webUrl"
    if ($script:CADDY_DOMAIN -and $script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
        Write-Host "  备用 IP: http://${accessIp}:$($script:PROXY_PORT)"
    } elseif (-not $script:CADDY_DOMAIN) {
        Write-Host "  本机: http://127.0.0.1:$($script:PROXY_PORT)"
    }
    Write-SupportContact
}

function Invoke-StopDev {
    Load-DeployEnv
    if (Test-BgEnabled) {
        Stop-BgDevApiProxy
        Stop-BgAllBackends
    } else {
        Stop-Port $script:BACKEND_PORT
        Stop-ServiceByPidFile 'backend'
    }
    Stop-Port $script:FRONTEND_PORT
    Stop-ServiceByPidFile 'worker'
    Stop-ServiceByPidFile 'scheduler'
    Write-LogOk '开发服务已停止'
}

function Invoke-StopProd {
    Load-DeployEnv
    Stop-ServiceByPidFile 'caddy'
    Stop-ServiceByPidFile 'worker'
    Stop-ServiceByPidFile 'scheduler'
    Stop-ServiceByPidFile 'backend'
    if (Test-BgEnabled) { Stop-BgAllBackends }
    Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-CaddyHttpsEnabled) {
        Stop-Port 80
        Stop-Port 443
    } else {
        Stop-Port $script:PROXY_PORT
    }
    if (Test-BgEnabled) {
        Stop-Port $script:BACKEND_PORT_BLUE
        Stop-Port $script:BACKEND_PORT_GREEN
    }
    Write-LogOk '生产服务已停止'
}

function Invoke-Status {
    Load-DeployEnv
    Write-Host "=== RiverEdge $($script:DeployMode) 状态 ==="
    foreach ($name in @('backend','frontend','worker','scheduler','caddy')) {
        $pidf = Join-Path $script:LogsDir "$name.pid"
        if (Test-Path $pidf) {
            $pid = (Get-Content $pidf -Raw).Trim()
            if (Get-Process -Id ([int]$pid) -ErrorAction SilentlyContinue) {
                Write-Host "  ${name}: 运行中 (PID $pid)"
            } else { Write-Host "  ${name}: 未运行" }
        } else { Write-Host "  ${name}: 未运行" }
    }
    Write-Host ''
    if (Test-PortInUse $script:BACKEND_PORT) { Write-Host "  端口 $($script:BACKEND_PORT): 监听中" } else { Write-Host "  端口 $($script:BACKEND_PORT): 空闲" }
    if ($script:DeployMode -eq 'dev') {
        if (Test-PortInUse $script:FRONTEND_PORT) { Write-Host "  端口 $($script:FRONTEND_PORT): 监听中" } else { Write-Host "  端口 $($script:FRONTEND_PORT): 空闲" }
    } elseif (Test-CaddyHttpsEnabled) {
        if (Test-PortInUse 443) { Write-Host '  端口 443 (HTTPS): 监听中' } else { Write-Host '  端口 443 (HTTPS): 空闲' }
        if (Test-PortInUse 80) { Write-Host '  端口 80 (HTTP 跳转): 监听中' } else { Write-Host '  端口 80 (HTTP 跳转): 空闲' }
    } else {
        if (Test-PortInUse $script:PROXY_PORT) { Write-Host "  端口 $($script:PROXY_PORT): 监听中" } else { Write-Host "  端口 $($script:PROXY_PORT): 空闲" }
    }
    Write-Host "  蓝绿部署: $(Get-BlueGreenDeployStatusLabel)"
    if (Test-BgEnabled) {
        Write-Host ''
        Write-BgStatus
    }
}

function Install-Component([string]$Component, [string]$Status) {
    if ($Status -eq 'ok') { return }
    $psScript = Join-Path $script:FastDeployDir 'windows\install-component.ps1'
    if (Test-Path $psScript) {
        Write-LogInfo "Windows 安装 $Component（winget 或官方安装包）..."
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $psScript `
            -Component $Component -UseMirror $script:UseMirror -FastDeployDir $script:FastDeployDir
        if ($LASTEXITCODE -ne 0) { throw "${Component} 安装失败，详见上方日志" }
        $env:PATH = Get-EnhancedPath
        return
    }
    $cmd = Get-InstallCommand $Component
    if ($Component -eq 'caddy') {
        Install-Caddy
        return
    }
    if ([string]::IsNullOrWhiteSpace($cmd) -or $cmd -like '*从 https*') {
        throw "请手动安装 ${Component}: $cmd"
    }
    Write-LogInfo "安装 $Component..."
    Write-LogInfo "执行: $cmd"
    cmd.exe /c $cmd
    if ($LASTEXITCODE -ne 0) { throw "${Component} 安装失败，请手动执行: $cmd" }
}

function Invoke-Check {
    $failed = $false
    $checks = @{
        'Node.js' = (Test-CheckNode)
        'Python' = (Test-CheckPython)
        'uv' = (Test-CheckUv)
        'npm' = (Test-CheckNpm)
        'PostgreSQL' = (Test-CheckPostgres)
    }
    if ($script:DeployMode -eq 'prod') { $checks['Caddy'] = (Test-CheckCaddy) }
    foreach ($name in $checks.Keys) {
        if ($checks[$name] -eq 'ok') { Write-LogOk $name }
        else { Write-LogWarn "$name`: $($checks[$name])"; $failed = $true }
    }
    return -not $failed
}

function Invoke-Install {
    if (-not (Test-Path $script:InstallScriptsJson)) { throw "缺少 $script:InstallScriptsJson" }
    Apply-CN-Mirrors
    Write-LogInfo '安装缺失依赖（可能需要管理员权限）...'
    Install-Component 'node' (Test-CheckNode)
    Install-Component 'python' (Test-CheckPython)
    Install-Component 'uv' (Test-CheckUv)
    Install-Component 'postgresql' (Test-CheckPostgres)
    if ($script:DeployMode -eq 'prod') { Install-Component 'caddy' (Test-CheckCaddy) }
    $env:PATH = Get-EnhancedPath
    Write-LogWarn '若刚安装系统软件，请重新打开终端或刷新 PATH 后再次 check'
    if (-not (Invoke-Check)) { throw '环境检测仍有未满足项' }
}

function Invoke-GitCleanUntrackedSafe {
    $enabled = $script:GIT_CLEAN_ON_UPDATE
    if (-not $enabled) {
        if ($script:DeployMode -ne 'prod') { return }
    } elseif ($enabled -ne '1') {
        return
    }
    Write-LogInfo '清理未跟踪文件（保留 .env / uploads / .logs / 扩展组装产物）...'
    $patterns = @(
        '-e', '.logs', '-e', '.logs/',
        '-e', 'riveredge-backend/.env',
        '-e', 'fast-deploy/config/deploy.env',
        '-e', 'fast-deploy/tools/workspace/workspace.yaml',
        '-e', '.playwright-browsers', '-e', '.playwright-browsers/',
        '-e', '.caddy-data', '-e', '.caddy-data/',
        '-e', '.caddy-config', '-e', '.caddy-config/',
        '-e', 'riveredge-backend/uploads', '-e', 'riveredge-backend/uploads/',
        '-e', 'riveredge-backend/src/apps/haoligo', '-e', 'riveredge-backend/src/apps/haoligo/',
        '-e', 'riveredge-backend/src/apps/kuaiai', '-e', 'riveredge-backend/src/apps/kuaiai/',
        '-e', 'riveredge-backend/src/apps/kuaireport', '-e', 'riveredge-backend/src/apps/kuaireport/',
        '-e', 'riveredge-backend/src/apps/kuaiiot', '-e', 'riveredge-backend/src/apps/kuaiiot/',
        '-e', 'riveredge-frontend/src/apps/haoligo', '-e', 'riveredge-frontend/src/apps/haoligo/',
        '-e', 'riveredge-frontend/src/apps/kuaiai', '-e', 'riveredge-frontend/src/apps/kuaiai/',
        '-e', 'riveredge-frontend/src/apps/kuaireport', '-e', 'riveredge-frontend/src/apps/kuaireport/',
        '-e', 'riveredge-frontend/src/apps/kuaiiot', '-e', 'riveredge-frontend/src/apps/kuaiiot/'
    )
    & git clean -fd @patterns 2>$null
}

function Sync-GitFromOrigin {
    Load-DeployEnv
    $branch = $script:GIT_BRANCH
    $remote = $script:GIT_REMOTE
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw '未安装 git' }
    if (-not (Test-Path (Join-Path $script:ProjectRoot '.git'))) { throw "当前目录不是 Git 仓库: $($script:ProjectRoot)" }

    Push-Location $script:ProjectRoot
    try {
        $oldHead = (git rev-parse --short HEAD 2>$null).Trim()
        $oldRef = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
        if (-not $oldHead) { $oldHead = '?' }
        if (-not $oldRef) { $oldRef = '?' }
        Write-LogInfo "同步远程代码 ($remote/$branch，fetch + reset --hard，无需手动 git pull)..."
        Write-LogInfo "当前: $oldRef @ $oldHead"

        git fetch $remote --prune --tags
        if ($LASTEXITCODE -ne 0) { throw "git fetch $remote 失败" }
        git fetch $remote $branch
        if ($LASTEXITCODE -ne 0) { throw "git fetch $remote $branch 失败" }
        git rev-parse --verify "${remote}/${branch}" 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "远程分支 ${remote}/${branch} 不存在，请检查 GIT_BRANCH 或是否已 push" }
        git checkout -B $branch "${remote}/${branch}"
        if ($LASTEXITCODE -ne 0) { throw "git checkout -B $branch ${remote}/${branch} 失败" }
        Invoke-GitCleanUntrackedSafe

        $newHead = (git rev-parse --short HEAD 2>$null).Trim()
        if (-not $newHead) { $newHead = '?' }
        if ($oldHead -eq $newHead) {
            Write-LogOk "代码已是最新 ($newHead)"
        } else {
            Write-LogOk "代码已更新: $oldHead → $newHead"
        }
    } catch {
        Write-LogError "同步远程代码失败 ($remote/$branch): $_"
        Write-LogError "排查: git remote -v · 网络 · $remote 凭据 · deploy.env 中 GIT_BRANCH"
        throw
    } finally { Pop-Location }
}

function Invoke-UpdateDev {
    Load-DeployEnv
    if (Invoke-PromptUpdateBlueGreen) {
        Invoke-BgUpdateDev
        $fpid = Join-Path $script:LogsDir 'frontend.pid'
        if (-not (Test-PidFileAlive $fpid)) {
            Start-FrontendDev
        } else {
            Write-LogInfo 'Vite 仍在运行，跳过前端重启（蓝绿 update）'
        }
        Write-LogOk '开发环境已更新'
        return
    }
    Sync-GitFromOrigin
    Invoke-StopDev
    Invoke-Migrate
    Record-DeployReleaseMetadata
    Invoke-StartDev
    Write-LogOk '开发环境已更新'
}

function Invoke-UpdateProd {
    Load-DeployEnv
    if (Invoke-PromptUpdateBlueGreen) {
        Invoke-BgUpdateProd
        Write-LogOk '生产环境已更新'
        return
    }
    Sync-GitFromOrigin
    Invoke-StopProd
    Invoke-Migrate
    Ensure-FrontendDist
    Record-DeployReleaseMetadata
    Invoke-StartProd
    Write-LogOk '生产环境已更新'
}

function Invoke-Default {
    Apply-CN-Mirrors
    if (-not (Invoke-Check)) {
        Write-LogWarn '环境未就绪，尝试 install...'
        Invoke-Install
    }
    if (Test-EnvNeedsConfigure) { Invoke-Configure }
    if ($script:DeployMode -eq 'dev') {
        Record-DeployReleaseMetadata
        Invoke-StartDev
    }
    else {
        Invoke-Migrate
        if (-not (Test-Path (Join-Path $script:FrontendDir 'dist\index.html'))) { Invoke-Build }
        else { Write-LogOk '已检测到 Web dist，跳过服务器构建' }
        Record-DeployReleaseMetadata
        Invoke-StartProd
    }
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Grant-SystemReadFile([string]$File) {
    if (Test-Path -LiteralPath $File) {
        & icacls $File /grant 'SYSTEM:R' 2>$null | Out-Null
    }
}

function Grant-SystemExecuteFile([string]$File) {
    if (Test-Path -LiteralPath $File) {
        & icacls $File /grant 'SYSTEM:RX' 2>$null | Out-Null
    }
}

function Grant-SystemModifyDir([string]$Dir) {
    if (-not (Test-Path -LiteralPath $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
    & icacls $Dir /grant 'SYSTEM:(OI)(CI)M' 2>$null | Out-Null
}

function Grant-SystemTraverseDir([string]$Dir) {
    if (Test-Path -LiteralPath $Dir) {
        & icacls $Dir /grant 'SYSTEM:(RX)' 2>$null | Out-Null
    }
}

function Grant-BootServiceSystemAccess([string]$UvBin, [string]$CaddyBin) {
    Grant-SystemTraverseDir $script:ProjectRoot
    Grant-SystemTraverseDir $script:FastDeployDir
    Grant-SystemTraverseDir $script:BackendDir
    Grant-SystemTraverseDir $script:FrontendDir
    Grant-SystemTraverseDir (Join-Path $script:FrontendDir 'dist')
    Grant-SystemReadFile $script:EnvFile
    Grant-SystemReadFile $script:DeployEnvFile
    Grant-SystemReadFile $script:BootEnvFile
    Grant-SystemReadFile $script:Caddyfile
    Grant-SystemModifyDir $script:LogsDir
    Grant-SystemExecuteFile $UvBin
    Grant-SystemExecuteFile $CaddyBin
    foreach ($dir in @(
        (Split-Path -Parent $UvBin),
        (Split-Path -Parent $CaddyBin),
        (Join-Path $script:FastDeployDir '.tools\caddy')
    )) {
        Grant-SystemTraverseDir $dir
    }
    $profileRoot = Split-Path -Parent (Split-Path -Parent $UvBin)
    if ($profileRoot -and (Test-Path -LiteralPath $profileRoot)) {
        Grant-SystemTraverseDir $profileRoot
    }
}

function Get-RiverEdgeBootTask {
    return Get-ScheduledTask -TaskName $script:BootTaskName -ErrorAction SilentlyContinue
}

function Test-RiverEdgeBootEnabled {
    $task = Get-RiverEdgeBootTask
    if (-not $task) { return $false }
    return $task.State -ne 'Disabled'
}

function Test-RiverEdgeBootAtStartup {
    $task = Get-RiverEdgeBootTask
    if (-not $task) { return $false }
    foreach ($trigger in $task.Triggers) {
        if ($trigger.CimClass.CimClassName -eq 'MSFT_TaskBootTrigger') { return $true }
    }
    return $false
}

function Test-RiverEdgeBootActive {
    Ensure-LogsDir
    $pidf = Join-Path $script:LogsDir 'backend.pid'
    if (-not (Test-Path $pidf)) { return $false }
    $pid = [int](Get-Content $pidf -Raw).Trim()
    return [bool](Get-Process -Id $pid -ErrorAction SilentlyContinue)
}

function Get-RiverEdgeBootStatusLabel {
    if ($script:DeployMode -ne 'prod') { return '仅生产模式可用' }
    if (-not (Test-RiverEdgeBootEnabled)) { return '未配置' }
    $mode = if (Test-RiverEdgeBootAtStartup) { '开机启动' } else { '登录时启动' }
    if (Test-RiverEdgeBootActive) { return "已启用 · ${mode} · 运行中" }
    return "已启用 · ${mode} · 未运行"
}

function New-RiverEdgeBootTaskSettings {
    return New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1)
}

function Register-RiverEdgeBootStopTask {
    param(
        [Microsoft.Management.Infrastructure.CimInstance]$StopAction,
        [Microsoft.Management.Infrastructure.CimInstance]$Settings,
        [Microsoft.Management.Infrastructure.CimInstance]$Principal
    )
    $triggerCmd = Get-Command New-ScheduledTaskTrigger -ErrorAction SilentlyContinue
    if (-not $triggerCmd -or -not $triggerCmd.Parameters.ContainsKey('AtShutdown')) {
        Write-LogWarn '当前 PowerShell 不支持 -AtShutdown，已跳过 RiverEdge-Stop（系统重启时进程会自动结束）'
        return
    }
    try {
        $stopTrigger = New-ScheduledTaskTrigger -AtShutdown
        Register-ScheduledTask `
            -TaskName $script:BootTaskStopName `
            -Description 'RiverEdge graceful stop at shutdown' `
            -Action $StopAction `
            -Trigger $stopTrigger `
            -Settings $Settings `
            -Principal $Principal `
            -Force | Out-Null
    } catch {
        Write-LogWarn "注册关机停止任务失败，已跳过: $_"
    }
}

function Install-RiverEdgeBootTask {
    Ensure-LogsDir
    Load-DeployEnv
    if (-not (Test-Path (Join-Path $script:FrontendDir 'dist\index.html'))) {
        throw '缺少前端 dist，请先执行 build'
    }
    $uv = Resolve-Uv
    if (-not (Test-Path -LiteralPath $uv)) { throw "未找到 uv: $uv" }
    $caddy = Resolve-Caddy
    if (-not $caddy) { throw '未安装 Caddy，请先执行 install' }

    $serviceScript = Join-Path $script:FastDeployDir 'windows\riveredge-service.ps1'
    if (-not (Test-Path $serviceScript)) { throw "缺少 $serviceScript" }

    $bootEnv = @(
        "PROJECT_ROOT=$($script:ProjectRoot)"
        "FAST_DEPLOY_DIR=$($script:FastDeployDir)"
        "UV_BIN=$uv"
        "CADDY_BIN=$caddy"
        "SERVICE_USER=$env:USERNAME"
        "PLAYWRIGHT_BROWSERS_PATH=$(Resolve-PlaywrightBrowsersPath)"
        "CADDY_DATA_DIR=$(Join-Path $script:ProjectRoot '.caddy-data')"
        "CADDY_CONFIG_DIR=$(Join-Path $script:ProjectRoot '.caddy-config')"
    )
    Set-Content -Path $script:BootEnvFile -Value $bootEnv -Encoding UTF8

    $actionArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$serviceScript`" -Action start"
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $actionArgs -WorkingDirectory $script:ProjectRoot
    $settings = New-RiverEdgeBootTaskSettings

    if (Test-IsAdministrator) {
        Write-LogInfo '管理员模式：注册 SYSTEM 开机启动任务（延迟 45s，等待 PostgreSQL 就绪）...'
        Grant-BootServiceSystemAccess -UvBin $uv -CaddyBin $caddy
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $trigger.Delay = 'PT45S'
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $desc = 'RiverEdge production auto-start at boot (SYSTEM)'
    } else {
        Write-LogInfo '注册当前用户登录时启动任务...'
        Write-LogWarn '如需未登录即开机自启，请以管理员身份重新执行 install-service'
        $trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
        $desc = 'RiverEdge production auto-start at user logon'
    }

    Register-ScheduledTask -TaskName $script:BootTaskName -Description $desc -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

    $stopArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$serviceScript`" -Action stop"
    $stopAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $stopArgs -WorkingDirectory $script:ProjectRoot
    Register-RiverEdgeBootStopTask -StopAction $stopAction -Settings $settings -Principal $principal

    Write-LogOk "开机自启已注册: $($script:BootTaskName)"
    if (Test-IsAdministrator) {
        Write-Host '  触发: 系统开机（SYSTEM，延迟 45s）'
    } else {
        Write-Host '  触发: 当前用户登录时'
    }
    Write-Host "  查看任务: taskschd.msc → 任务计划程序库 → $($script:BootTaskName)"
    Write-Host '  卸载: ./fast-deploy/deploy.sh uninstall-service'
}

function Uninstall-RiverEdgeBootTask {
    foreach ($name in @($script:BootTaskName, $script:BootTaskStopName)) {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        if ($task) {
            Write-LogInfo "移除计划任务 ${name}..."
            Unregister-ScheduledTask -TaskName $name -Confirm:$false
        }
    }
    if (Test-Path $script:BootEnvFile) { Remove-Item $script:BootEnvFile -Force }
    Write-LogOk '已移除 Windows 开机自启任务'
}

function Invoke-FdDispatch([string]$Command) {
    switch ($Command) {
        'check'     { if (-not (Invoke-Check)) { exit 1 } }
        'install'   { Invoke-Install }
        'configure' { Invoke-Configure }
        'migrate'   { Invoke-Migrate }
        'build'     { Invoke-Build }
        'start'     { if ($script:DeployMode -eq 'dev') { Invoke-StartDev } else { Invoke-StartProd } }
        'stop'      { if ($script:DeployMode -eq 'dev') { Invoke-StopDev } else { Invoke-StopProd } }
        'status'    { Invoke-Status }
        'update'    { if ($script:DeployMode -eq 'dev') { Invoke-UpdateDev } else { Invoke-UpdateProd } }
        'install-service'   { Install-RiverEdgeBootTask }
        'uninstall-service' { Uninstall-RiverEdgeBootTask }
        { $_ -in '', 'deploy' } { Invoke-Default }
        default {
            Write-LogError "未知命令: $Command"
            Write-Host '用法: check | install | configure | migrate | build | start | stop | status | update | install-service | uninstall-service | deploy'
            exit 1
        }
    }
}
