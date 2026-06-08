# RiverEdge 生产环境计划任务入口（由 Windows 开机自启任务调用，勿手动执行）
param(
    [Parameter()]
    [ValidateSet('start', 'stop')]
    [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'

$BootScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FastDeployDir = Split-Path $BootScriptDir -Parent
$BootEnvFile = Join-Path $FastDeployDir 'config\boot-service.env'

function Import-BootServiceEnv {
    if (-not (Test-Path $BootEnvFile)) {
        throw "缺少 $BootEnvFile，请先执行 install-service"
    }
    Get-Content $BootEnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            Set-Item -Path "env:$($Matches[1])" -Value $Matches[2].Trim()
        }
    }
}

Import-BootServiceEnv

$env:DEPLOY_MODE = 'prod'
$env:RIVEREDGE_BOOT_SERVICE = '1'
if ($env:UV_BIN) { $env:RIVEREDGE_UV = $env:UV_BIN }
if ($env:CADDY_BIN) { $env:RIVEREDGE_CADDY = $env:CADDY_BIN }

. (Join-Path $FastDeployDir 'lib\common.ps1')

$script:ProjectRoot = $env:PROJECT_ROOT
$script:FastDeployDir = $env:FAST_DEPLOY_DIR
$script:BackendDir = Join-Path $script:ProjectRoot 'riveredge-backend'
$script:FrontendDir = Join-Path $script:ProjectRoot 'riveredge-frontend'
$script:EnvFile = Join-Path $script:BackendDir '.env'
$script:LogsDir = Join-Path $script:ProjectRoot '.logs'
$script:CaddyDir = Join-Path $script:FastDeployDir 'caddy'
$script:Caddyfile = Join-Path $script:CaddyDir 'Caddyfile'

Load-DeployEnv

if ($Action -eq 'stop') {
    Invoke-StopProd
    exit 0
}

for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
        Invoke-StartProd
        exit 0
    } catch {
        Write-LogError "start failed (attempt ${attempt}/3): $_"
        try { Invoke-StopProd } catch { }
        if ($attempt -lt 3) { Start-Sleep -Seconds 15 }
    }
}
exit 1
