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
$script:EnvFile = Join-Path $script:BackendDir '.env'
$script:ConfigDir = Join-Path $script:FastDeployDir 'config'
$script:DeployEnvFile = Join-Path $script:ConfigDir 'deploy.env'
$script:DeployEnvExample = Join-Path $script:ConfigDir 'deploy.env.example'
$script:LogsDir = Join-Path $script:ProjectRoot '.logs'
$script:CaddyDir = Join-Path $script:FastDeployDir 'caddy'
$script:Caddyfile = Join-Path $script:CaddyDir 'Caddyfile'
$script:CaddyTemplate = Join-Path $script:FastDeployDir 'templates\Caddyfile.template'
$script:InstallScriptsJson = Join-Path $script:ConfigDir 'install-scripts.json'

if (-not $env:DEPLOY_MODE) { $env:DEPLOY_MODE = 'prod' }
$script:DeployMode = $env:DEPLOY_MODE
$script:UseMirror = ($env:USE_MIRROR -ne '0')
$script:BackendStartTimeout = 30

# Windows 默认 GBK，aerich 读 pyproject.toml（UTF-8）会 UnicodeDecodeError
if (-not $env:PYTHONUTF8) { $env:PYTHONUTF8 = '1' }
if (-not $env:PYTHONIOENCODING) { $env:PYTHONIOENCODING = 'utf-8' }

function Write-LogInfo($msg)  { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] INFO: $msg" -ForegroundColor Cyan }
function Write-LogWarn($msg)  { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] WARN: $msg" -ForegroundColor Yellow }
function Write-LogOk($msg)    { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] OK: $msg" -ForegroundColor Green }
function Write-LogError($msg) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $msg" -ForegroundColor Red }

function Ensure-LogsDir {
    if (-not (Test-Path $script:LogsDir)) { New-Item -ItemType Directory -Path $script:LogsDir -Force | Out-Null }
}

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
}

function Apply-CN-Mirrors {
    if (-not $script:UseMirror) { return }
    $env:UV_INDEX_URL = if ($env:UV_INDEX_URL) { $env:UV_INDEX_URL } else { 'https://pypi.tuna.tsinghua.edu.cn/simple' }
    $env:npm_config_registry = 'https://registry.npmmirror.com'
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm config set registry https://registry.npmmirror.com 2>$null
    }
    Write-LogInfo '已启用国内镜像 (uv/npm)'
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
        "$env:LOCALAPPDATA\Programs\Python\Python312",
        "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts",
        "$env:LOCALAPPDATA\Programs\Python\Python313",
        "$env:LOCALAPPDATA\Programs\Python\Python313\Scripts",
        "$env:USERPROFILE\.local\bin",
        "$env:ProgramFiles\PostgreSQL\15\bin",
        "$env:ProgramFiles\PostgreSQL\16\bin",
        "$env:ProgramFiles\PostgreSQL\17\bin",
        (Join-Path $script:FastDeployDir '.tools\caddy')
    )
    foreach ($p in $extra) {
        if ($p -and (Test-Path $p) -and ($paths -notcontains $p)) { $paths = @($p) + $paths }
    }
    $pyRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
    if (Test-Path $pyRoot) {
        foreach ($dir in Get-ChildItem $pyRoot -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue) {
            foreach ($sub in @($dir.FullName, (Join-Path $dir.FullName 'Scripts'))) {
                if (($paths -notcontains $sub)) { $paths = @($sub) + $paths }
            }
        }
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
    if (Get-Command uv -ErrorAction SilentlyContinue) { return 'uv' }
    $candidates = @(
        "$env:USERPROFILE\.local\bin\uv.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts\uv.exe"
    )
    foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
    return 'uv'
}

function Resolve-Caddy {
    if (Get-Command caddy -ErrorAction SilentlyContinue) { return (Get-Command caddy).Source }
    $bundled = Join-Path $script:FastDeployDir '.tools\caddy\caddy.exe'
    if (Test-Path $bundled) { return $bundled }
    return $null
}

function Test-CheckNode {
    $env:PATH = Get-EnhancedPath
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        $candidates = @(
            (Join-Path $script:FastDeployDir '.tools\node\node.exe'),
            (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
        )
        foreach ($p in $candidates) {
            if (Test-Path $p) { $node = Get-Command $p -ErrorAction SilentlyContinue; if ($node) { break } }
        }
    }
    if (-not $node) { return 'missing' }
    $v = (& $node.Source -v) -replace '^v',''
    if (Test-VersionGe $v '22.0.0') { return 'ok' } else { return "old:$v" }
}

function Test-CheckPython {
    $env:PATH = Get-EnhancedPath
    foreach ($c in @('python3.12', 'python3', 'python', 'py')) {
        if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { continue }
        $out = if ($c -eq 'py') { & py -3.12 --version 2>&1 } else { & $c --version 2>&1 }
        if ($out -match '(\d+\.\d+\.\d+)') {
            $v = $Matches[1]
            if (Test-VersionGe $v '3.12.0') { return 'ok' } else { return "old:$v" }
        }
    }
    $pyCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe')
    )
    $pyRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
    if (Test-Path $pyRoot) {
        $pyCandidates += Get-ChildItem $pyRoot -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName 'python.exe' }
    }
    foreach ($p in $pyCandidates) {
        if (-not (Test-Path $p)) { continue }
        $out = & $p --version 2>&1
        if ($out -match '(\d+\.\d+\.\d+)') {
            $v = $Matches[1]
            if (Test-VersionGe $v '3.12.0') { return 'ok' } else { return "old:$v" }
        }
    }
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
    $candidates = @('psql')
    if ($IsLinux -or $env:OS -ne 'Windows_NT') {
        $candidates += Get-ChildItem -Path '/usr/lib/postgresql/*/bin/psql' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
    }
    foreach ($bin in $candidates) {
        if (-not (Get-Command $bin -ErrorAction SilentlyContinue) -and -not (Test-Path $bin)) { continue }
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

function Resolve-ProdWebUrl([string]$ServerIp) {
    Load-DeployEnv
    if ([string]::IsNullOrWhiteSpace($ServerIp)) {
        $ServerIp = Read-DeployEnvValue 'SERVER_IP'
        if ([string]::IsNullOrWhiteSpace($ServerIp)) { $ServerIp = Detect-ServerIp }
    }
    if ($script:CADDY_DOMAIN) {
        if ($script:CADDY_ENABLE_LETSENCRYPT -eq 'true') { return "https://$($script:CADDY_DOMAIN)" }
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
                Write-LogOk "已配置: https://${domain}（需 DNS 指向本机且公网 80 端口可达）"
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
        if ($script:CADDY_DOMAIN) {
            if ($script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
                $baseUrl = "https://$($script:CADDY_DOMAIN)"
            } else {
                $baseUrl = "http://$($script:CADDY_DOMAIN):$($script:PROXY_PORT)"
            }
        } else {
            $baseUrl = "http://${serverIp}:$($script:PROXY_PORT)"
        }
        Set-EnvValue 'BASE_URL' $baseUrl
        $cors = "$baseUrl,http://${serverIp}:$($script:PROXY_PORT),http://127.0.0.1:$($script:PROXY_PORT),http://localhost:$($script:PROXY_PORT)"
        if ($script:CADDY_DOMAIN) {
            $cors = "$baseUrl,https://$($script:CADDY_DOMAIN),http://$($script:CADDY_DOMAIN):$($script:PROXY_PORT),http://${serverIp}:$($script:PROXY_PORT),http://127.0.0.1:$($script:PROXY_PORT),http://localhost:$($script:PROXY_PORT)"
        }
        Set-EnvValue 'CORS_ORIGINS' $cors
    } else {
        Set-EnvValue 'HOST' '0.0.0.0'
        Set-EnvValue 'CORS_ORIGINS' "http://${serverIp}:$($script:FRONTEND_PORT),http://127.0.0.1:$($script:FRONTEND_PORT),http://localhost:$($script:FRONTEND_PORT)"
    }

    Write-LogInfo '测试数据库连接...'
    if (-not (Test-DbConnection)) { throw '数据库连接失败，请确认 PostgreSQL 已启动且 DB_* 配置正确' }
    Write-LogOk '配置完成'
    Write-Host "  数据库: ${dbUser}@${dbHost}/${dbName}"
    Write-Host '  超管账号: infra_admin'
    if ($script:DeployMode -eq 'prod') {
        $webUrl = Resolve-ProdWebUrl $serverIp
        Write-Host "  访问地址: $webUrl"
        if ($script:CADDY_DOMAIN -and $script:CADDY_ENABLE_LETSENCRYPT -eq 'true') {
            Write-Host "  备用 IP: http://${serverIp}:$($script:PROXY_PORT)"
        }
    } else {
        Write-Host "  访问地址: http://${serverIp}:$($script:FRONTEND_PORT) (Web) / http://${serverIp}:$($script:BACKEND_PORT) (API)"
    }
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

function Ensure-PlaywrightChromiumPostInstall {
    # 非阻断后置补装：后台下载 Chromium，不阻塞 start 主流程
    $enabled = if ($env:PLAYWRIGHT_POSTINSTALL_ENABLE) { $env:PLAYWRIGHT_POSTINSTALL_ENABLE } else { '1' }
    if ($enabled -eq '0') { return }
    Ensure-LogsDir
    $marker = Join-Path $script:LogsDir 'playwright-chromium.ready'
    $logFile = Join-Path $script:LogsDir 'playwright-install.log'
    $pidf = Join-Path $script:LogsDir 'playwright-install.pid'
    if (Test-Path $marker) { return }
    if (-not (Test-Path $script:BackendDir)) { return }

    $running = Get-Job -Name 'RiverEdgePlaywrightInstall' -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Running' }
    if ($running) {
        Write-LogInfo "Playwright Chromium 后台补装进行中（Job $($running.Id)），详见 $logFile"
        return
    }

    Write-LogInfo '补装 Playwright Chromium 运行时（后台执行，不阻塞启动）...'
    $uv = Resolve-Uv
    $backendDir = $script:BackendDir
    Start-Job -Name 'RiverEdgePlaywrightInstall' -ScriptBlock {
        param($BackendDir, $Uv, $Marker, $LogFile, $PidFile)
        $env:PYTHONPATH = Join-Path $BackendDir 'src'
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
                Set-Content -Path $Marker -Value (Get-Date -Format o) -Encoding UTF8
                Add-Content $LogFile "[$(Get-Date -Format o)] ok: Playwright Chromium 补装完成"
            } else {
                Add-Content $LogFile "[$(Get-Date -Format o)] fail: Playwright Chromium 补装失败"
            }
        } finally {
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            Pop-Location
        }
    } -ArgumentList $backendDir, $uv, $marker, $logFile, $pidf | Out-Null
    Write-LogInfo "Playwright 补装已在后台运行，详见 $logFile"
}

function Sync-BackendDeps {
    Apply-CN-Mirrors
    Write-LogInfo '同步 Python 依赖...'
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
        $env:UV_LINK_MODE = 'copy'
        $env:UV_HTTP_TIMEOUT = '600'
        & $uv sync --no-install-project
        if ($LASTEXITCODE -ne 0) { throw 'uv sync 失败' }
    } finally { Pop-Location }
    Ensure-PyzbarWindowsNative
}

function Invoke-Migrate {
    Sync-BackendDeps
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
    Write-LogOk '前端构建完成'
}

function Ensure-FrontendDist {
    Load-DeployEnv
    $index = Join-Path $script:FrontendDir 'dist\index.html'
    if (Test-Path $index) {
        Write-LogOk '已检测到 Web dist，跳过服务器构建'
        return
    }
    if ($script:ALLOW_SERVER_BUILD -ne '0') {
        Write-LogWarn 'dist 不在仓库中，正在服务器构建（内存占用较高）...'
        Invoke-Build
        return
    }
    throw '缺少 dist/index.html。请设置 ALLOW_SERVER_BUILD=1 在服务器构建，或本地 build 后上传 dist'
}

function New-Caddyfile {
    Load-DeployEnv
    if (-not (Test-Path $script:CaddyDir)) { New-Item -ItemType Directory -Path $script:CaddyDir -Force | Out-Null }
    if (-not (Test-Path $script:CaddyTemplate)) { throw "缺少模板 $script:CaddyTemplate" }

    $backendAddr = "127.0.0.1:$($script:BACKEND_PORT)"
    $frontendRoot = (Join-Path $script:FrontendDir 'dist') -replace '\\','/'

    if ($script:CADDY_DOMAIN) {
        if ($script:CADDY_ENABLE_LETSENCRYPT -eq 'true') { $addr = $script:CADDY_DOMAIN }
        else { $addr = "http://$($script:CADDY_DOMAIN):$($script:PROXY_PORT)" }
    } else { $addr = ":$($script:PROXY_PORT)" }

    $content = (Get-Content $script:CaddyTemplate -Raw).Replace('{{ADDR}}', $addr).Replace('{{BACKEND_ADDR}}', $backendAddr).Replace('{{FRONTEND_ROOT}}', $frontendRoot)

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
    Stop-Port $script:BACKEND_PORT
    Write-LogInfo "启动后端 (dev, :$($script:BACKEND_PORT))..."
    $uv = Resolve-Uv
    Push-Location $script:BackendDir
    try {
        $env:PYTHONPATH = Join-Path $script:BackendDir 'src'
        $env:SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
        $args = @('run','--extra','pdf','uvicorn','server.main:app','--host','0.0.0.0',"--port",$script:BACKEND_PORT,'--reload','--reload-dir','src')
        $pid = Start-ProcessBackground 'backend' $uv $args @{ PYTHONPATH = $env:PYTHONPATH; SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir; WORKDIR = $script:BackendDir }
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
        $wArgs = @('run','--extra','pdf','taskiq','worker','core.tasks.taskiq_app:broker','--fs-discover',
            '--workers',"$($script:TASKIQ_WORKERS)",
            'core.tasks.taskiq_app','core.tasks.worker_bootstrap','core.tasks.data_backup_handlers')
        Start-ProcessBackground 'worker' $uv $wArgs @{ PYTHONPATH = $env:PYTHONPATH; WORKDIR = $script:BackendDir }
        $sArgs = @('run','--extra','pdf','taskiq','scheduler','core.tasks.taskiq_app:scheduler','--fs-discover',
            'core.tasks.taskiq_app','core.inngest.functions',
            'apps.master_data.inngest.functions','apps.kuaizhizao.inngest.functions')
        Start-ProcessBackground 'scheduler' $uv $sArgs @{ PYTHONPATH = $env:PYTHONPATH; WORKDIR = $script:BackendDir }
    } finally { Pop-Location }
    Write-LogOk 'Taskiq 已启动'
}

function Start-FrontendDev {
    Stop-Port $script:FRONTEND_PORT
    Ensure-FrontendDeps
    Write-LogInfo "启动前端 (dev, :$($script:FRONTEND_PORT))..."
    $viteConfig = Join-Path $script:FrontendDir 'vite.config.ts'
    if (Test-Path $viteConfig) {
        $c = Get-Content $viteConfig -Raw
        $c = $c -replace "target: 'http://localhost:\d+'", "target: 'http://localhost:$($script:BACKEND_PORT)'"
        Set-Content $viteConfig $c -Encoding UTF8
    }
    Push-Location $script:FrontendDir
    try {
        Start-ProcessBackground 'frontend' 'npx' @('vite',"--port",$script:FRONTEND_PORT,'--host','127.0.0.1') @{ WORKDIR = $script:FrontendDir }
    } finally { Pop-Location }
    Write-LogOk '前端已启动'
}

function Start-BackendProd {
    $pidf = Join-Path $script:LogsDir 'backend.pid'
    if (Test-Path $pidf) {
        $pid = [int](Get-Content $pidf -Raw).Trim()
        if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { Write-LogInfo '后端已在运行'; return }
    }
    Sync-BackendDeps
    Write-LogInfo "启动后端 (prod, :$($script:BACKEND_PORT))..."
    $uv = Resolve-Uv
    $args = @('run','uvicorn','server.main:app','--host','127.0.0.1',"--port",$script:BACKEND_PORT,'--workers','1')
    Start-ProcessBackground 'backend' $uv $args @{
        PORT = $script:BACKEND_PORT; HOST = '127.0.0.1'; ENVIRONMENT = 'production'; DEBUG = 'false'
        SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir; PYTHONPATH = (Join-Path $script:BackendDir 'src'); WORKDIR = $script:BackendDir
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
        $args = @('run','taskiq','worker','--app-dir','src','--fs-discover','--workers',"$($script:TASKIQ_WORKERS)",'core.tasks.taskiq_app:broker')
        Start-ProcessBackground 'worker' $uv $args @{
            ENVIRONMENT = 'production'; SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
            PYTHONPATH = (Join-Path $script:BackendDir 'src'); WORKDIR = $script:BackendDir
        }
        if (-not (Wait-ProcessStable 'Worker' $workerPidFile $workerLogFile 12)) { throw 'Worker 启动失败' }
    } else {
        Write-LogInfo 'Worker 已在运行'
    }
    $schedulerPidFile = Join-Path $script:LogsDir 'scheduler.pid'
    $schedulerLogFile = Join-Path $script:LogsDir 'scheduler.log'
    if (-not (Test-PidFileAlive $schedulerPidFile)) {
        Remove-Item $schedulerPidFile -Force -ErrorAction SilentlyContinue
        Write-LogInfo '启动 Taskiq Scheduler...'
        $args = @('run','taskiq','scheduler','--app-dir','src','--fs-discover','core.tasks.taskiq_app:scheduler')
        Start-ProcessBackground 'scheduler' $uv $args @{
            ENVIRONMENT = 'production'; SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir
            PYTHONPATH = (Join-Path $script:BackendDir 'src'); WORKDIR = $script:BackendDir
        }
        if (-not (Wait-ProcessStable 'Scheduler' $schedulerPidFile $schedulerLogFile 12)) { throw 'Scheduler 启动失败' }
    } else {
        Write-LogInfo 'Scheduler 已在运行'
    }
    Write-LogOk 'Taskiq 已启动'
}

function Test-CaddyHttpsEnabled {
    Load-DeployEnv
    return ($script:CADDY_DOMAIN -and $script:CADDY_ENABLE_LETSENCRYPT -eq 'true')
}

function Start-CaddyProd {
    New-Caddyfile
    Load-DeployEnv
    $caddy = Resolve-Caddy
    if (-not $caddy) { throw '未安装 Caddy，请运行 install' }
    $pidf = Join-Path $script:LogsDir 'caddy.pid'
    if (Test-Path $pidf) {
        $pid = [int](Get-Content $pidf -Raw).Trim()
        if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { Write-LogInfo 'Caddy 已在运行'; return }
    }
    if (Test-CaddyHttpsEnabled) {
        Write-LogInfo "启动 Caddy (HTTPS :443 + HTTP :80, 域名 $($script:CADDY_DOMAIN))..."
    } else {
        Write-LogInfo "启动 Caddy (:$($script:PROXY_PORT))..."
    }
    Start-ProcessBackground 'caddy' $caddy @('run',"--config",$script:Caddyfile) @{ WORKDIR = $script:ProjectRoot }
    Start-Sleep -Seconds 2
    if (Test-CaddyHttpsEnabled) {
        if (-not (Test-PortInUse 443)) { throw 'Caddy 未监听端口 443，查看 .logs/caddy.log' }
    } elseif (-not (Test-PortInUse $script:PROXY_PORT)) {
        throw "Caddy 未监听端口 $($script:PROXY_PORT)，查看 .logs/caddy.log"
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
    Write-Host "  Web:  http://127.0.0.1:$($script:FRONTEND_PORT)"
    Write-Host "  API:  http://127.0.0.1:$($script:BACKEND_PORT)"
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
}

function Invoke-StopDev {
    Stop-Port $script:BACKEND_PORT
    Stop-Port $script:FRONTEND_PORT
    Stop-ServiceByPidFile 'worker'
    Stop-ServiceByPidFile 'scheduler'
    Stop-ServiceByPidFile 'backend'
    Write-LogOk '开发服务已停止'
}

function Invoke-StopProd {
    Load-DeployEnv
    Stop-ServiceByPidFile 'caddy'
    Stop-ServiceByPidFile 'worker'
    Stop-ServiceByPidFile 'scheduler'
    Stop-ServiceByPidFile 'backend'
    Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-CaddyHttpsEnabled) {
        Stop-Port 80
        Stop-Port 443
    } else {
        Stop-Port $script:PROXY_PORT
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

function Invoke-UpdateDev {
    Invoke-Migrate
    Invoke-StopDev
    Record-DeployReleaseMetadata
    Invoke-StartDev
}

function Invoke-UpdateProd {
    Load-DeployEnv
    $branch = if ($env:GIT_BRANCH) { $env:GIT_BRANCH } else { 'develop' }
    Write-LogInfo "拉取代码 (origin/$branch)..."
    Push-Location $script:ProjectRoot
    try {
        git fetch origin
        git checkout $branch
        git pull origin $branch
        if ($LASTEXITCODE -ne 0) { throw 'git pull 失败' }
    } finally { Pop-Location }
    Invoke-Migrate
    Invoke-StopProd
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
        { $_ -in '', 'deploy' } { Invoke-Default }
        default {
            Write-LogError "未知命令: $Command"
            Write-Host '用法: check | install | configure | migrate | build | start | stop | status | update | deploy'
            exit 1
        }
    }
}
