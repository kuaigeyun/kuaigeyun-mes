# RiverEdge 蓝绿部署（由 common.ps1 dot-source）

$script:BgStateFile = Join-Path $script:LogsDir 'blue-green.state'
$script:BgDevApiCaddyfile = Join-Path $script:CaddyDir 'Caddyfile.dev-api'
$script:BgDevApiTemplate = Join-Path $script:FastDeployDir 'templates\Caddyfile.dev-api.template'

function Test-BgEnabled {
    Load-DeployEnv
    return ($script:BLUE_GREEN_DEPLOY -eq '1')
}

function Initialize-BgDefaults {
    if (-not $script:BLUE_GREEN_DEPLOY) { $script:BLUE_GREEN_DEPLOY = '0' }
    if (-not $script:BACKEND_PORT_BLUE) { $script:BACKEND_PORT_BLUE = 8201 }
    if (-not $script:BACKEND_PORT_GREEN) { $script:BACKEND_PORT_GREEN = 8202 }
    if (-not $script:WORKER_DRAIN_TIMEOUT) { $script:WORKER_DRAIN_TIMEOUT = 60 }
    if (-not $script:BLUE_GREEN_HEALTH_TIMEOUT) { $script:BLUE_GREEN_HEALTH_TIMEOUT = 120 }
}

function Get-BgStateValue([string]$Key) {
    if (-not (Test-Path $script:BgStateFile)) { return $null }
    foreach ($line in Get-Content $script:BgStateFile) {
        if ($line -match "^\s*$([regex]::Escape($Key))=(.*)$") { return $Matches[1].Trim() }
    }
    return $null
}

function Set-BgStateValue([string]$Key, [string]$Value) {
    Ensure-LogsDir
    $lines = @()
    if (Test-Path $script:BgStateFile) {
        $lines = Get-Content $script:BgStateFile | Where-Object { $_ -notmatch "^\s*$([regex]::Escape($Key))=" }
    }
    $lines += "${Key}=${Value}"
    Set-Content -Path $script:BgStateFile -Value $lines -Encoding UTF8
}

function Get-BgSlotPort([string]$Slot) {
    switch ($Slot) {
        'blue' { return [int]$script:BACKEND_PORT_BLUE }
        'green' { return [int]$script:BACKEND_PORT_GREEN }
        default { throw "未知槽位: $Slot" }
    }
}

function Get-BgActiveSlot {
    $slot = Get-BgStateValue 'active_slot'
    if ($slot -eq 'blue' -or $slot -eq 'green') { return $slot }
    return 'blue'
}

function Get-BgInactiveSlot {
    if ((Get-BgActiveSlot) -eq 'blue') { return 'green' }
    return 'blue'
}

function Get-BgFrontendSlotDir([string]$Slot) {
    Join-Path $script:FrontendDir "dist-$Slot"
}

function Get-BgFrontendLiveLink {
    Join-Path $script:FrontendDir 'dist-live'
}

function Initialize-BgFrontendSlots {
    foreach ($slot in @('blue','green')) {
        $dir = Get-BgFrontendSlotDir $slot
        $src = Join-Path $script:FrontendDir 'dist\index.html'
        if (-not (Test-Path (Join-Path $dir 'index.html')) -and (Test-Path $src)) {
            Write-LogInfo "初始化前端槽位 dist-$slot..."
            if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
            Copy-Item (Join-Path $script:FrontendDir 'dist') $dir -Recurse -Force
        }
    }
    $live = Get-BgFrontendLiveLink
    if (-not (Test-Path $live)) {
        $activeFe = Get-BgStateValue 'frontend_slot'
        if (-not $activeFe) { $activeFe = Get-BgActiveSlot }
        $target = Get-BgFrontendSlotDir $activeFe
        New-Item -ItemType Junction -Path $live -Target $target -Force | Out-Null
    }
}

function Get-BgFrontendRootForCaddy {
    $live = Get-BgFrontendLiveLink
    if (Test-Path $live) { return ($live -replace '\\','/') }
    return (Join-Path $script:FrontendDir 'dist') -replace '\\','/'
}

function Initialize-BgState {
    Ensure-LogsDir
    Initialize-BgDefaults
    if ((Test-Path $script:BgStateFile) -and (Get-BgStateValue 'active_slot')) {
        Initialize-BgFrontendSlots
        return
    }
    Write-LogInfo '初始化蓝绿部署状态（active=blue）...'
    Set-BgStateValue 'active_slot' 'blue'
    Set-BgStateValue 'frontend_slot' 'blue'
    Initialize-BgFrontendSlots
    Write-LogOk '蓝绿状态已初始化'
}

function Test-BgHealthOnPort([int]$Port, [int]$TimeoutSec) {
    if (-not $TimeoutSec) { $TimeoutSec = [int]$script:BLUE_GREEN_HEALTH_TIMEOUT }
    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        try {
            Invoke-WebRequest -Uri "http://127.0.0.1:${Port}/health" -UseBasicParsing -TimeoutSec 3 | Out-Null
            return $true
        } catch { Start-Sleep -Seconds 1 }
    }
    return $false
}

function Stop-BgBackendSlot([string]$Slot, [switch]$Graceful) {
    $pidFile = Join-Path $script:LogsDir "backend-$Slot.pid"
    if (Test-Path $pidFile) {
        $procId = [int](Get-Content $pidFile -Raw).Trim()
        if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
            if ($Graceful) {
                Stop-Process -Id $procId -ErrorAction SilentlyContinue
                $i = 0
                while ($i -lt 30 -and (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
                    Start-Sleep -Seconds 1
                    $i++
                }
                if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            } else {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
            Write-LogInfo "已停止 backend-$Slot (PID $procId)"
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    Stop-Port (Get-BgSlotPort $Slot)
}

function Stop-BgAllBackends {
    Stop-BgBackendSlot 'blue'
    Stop-BgBackendSlot 'green'
    Remove-Item (Join-Path $script:LogsDir 'backend.pid') -Force -ErrorAction SilentlyContinue
}

function Start-BgBackendSlot([string]$Slot, [string]$Mode) {
    if (-not $Mode) { $Mode = $script:DeployMode }
    $port = Get-BgSlotPort $Slot
    $pidFile = Join-Path $script:LogsDir "backend-$Slot.pid"
    if (Test-PidFileAlive $pidFile) {
        if (Test-BgHealthOnPort $port 5) {
            Write-LogInfo "backend-$Slot 已在运行 (:$port)"
            return
        }
        Stop-BgBackendSlot $Slot
    }
    Stop-Port $port
    $uv = Resolve-Uv
    if ($Mode -eq 'prod') { Sync-BackendDeps }
    Write-LogInfo "启动 backend-$Slot ($Mode, :$port)..."
    $hostAddr = if ($Mode -eq 'dev') { '0.0.0.0' } else { '127.0.0.1' }
    $args = @('run','--extra','pdf','uvicorn','server.main:app','--host',$hostAddr,'--port',"$port")
    if ($Mode -eq 'dev') { $args += @('--reload','--reload-dir','src') } else { $args += @('--workers','1') }
    $envVars = @{
        PORT = "$port"; HOST = $hostAddr; PYTHONPATH = (Join-Path $script:BackendDir 'src')
        SETUPTOOLS_EGG_INFO_DIR = $script:LogsDir; WORKDIR = $script:BackendDir
    }
    if ($Mode -eq 'prod') {
        $envVars.ENVIRONMENT = 'production'; $envVars.DEBUG = 'false'
        Set-PlaywrightEnv
        $envVars.PLAYWRIGHT_BROWSERS_PATH = $env:PLAYWRIGHT_BROWSERS_PATH
    }
    Start-ProcessBackground "backend-$Slot" $uv $args $envVars
    $timeout = if ($script:BackendStartTimeout) { [int]$script:BackendStartTimeout } else { 90 }
    if (-not (Test-BgHealthOnPort $port $timeout)) {
        throw "backend-$Slot 启动失败，查看 $(Join-Path $script:LogsDir "backend-$Slot.log")"
    }
    if ((Get-BgActiveSlot) -eq $Slot) {
        Copy-Item $pidFile (Join-Path $script:LogsDir 'backend.pid') -Force
    }
    Write-LogOk "backend-$Slot 就绪 (:$port)"
}

function New-BgDevApiCaddyfile([string]$BackendAddr) {
    if (-not (Test-Path $script:CaddyDir)) { New-Item -ItemType Directory -Path $script:CaddyDir -Force | Out-Null }
    $content = (Get-Content $script:BgDevApiTemplate -Raw).Replace('{{LISTEN_PORT}}', "$($script:BACKEND_PORT)").Replace('{{BACKEND_ADDR}}', $BackendAddr)
    Set-Content -Path $script:BgDevApiCaddyfile -Value $content -Encoding UTF8
}

function Start-BgDevApiProxy {
    $activePort = Get-BgSlotPort (Get-BgActiveSlot)
    $backendAddr = "127.0.0.1:$activePort"
    New-BgDevApiCaddyfile $backendAddr
    $pidFile = Join-Path $script:LogsDir 'dev-api-proxy.pid'
    if (Test-PidFileAlive $pidFile) {
        if (Test-PortInUse $script:BACKEND_PORT) {
            Write-LogInfo "dev API 代理已在 :$($script:BACKEND_PORT)"
            return
        }
        Stop-ServiceByPidFile 'dev-api-proxy'
    }
    $caddy = Resolve-Caddy
    if (-not $caddy) { throw '未安装 Caddy（dev API 代理需要）' }
    Write-LogInfo "启动 dev API 代理 (:$($script:BACKEND_PORT) -> $backendAddr)..."
    Start-ProcessBackground 'dev-api-proxy' $caddy @('run','--config',$script:BgDevApiCaddyfile) @{ WORKDIR = $script:ProjectRoot }
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-PortInUse $script:BACKEND_PORT) { break }
        Start-Sleep -Seconds 1
    }
    if (-not (Test-PortInUse $script:BACKEND_PORT)) { throw 'dev API 代理启动超时' }
    Write-LogOk 'dev API 代理就绪'
}

function Reload-BgDevApiProxy([int]$ActivePort) {
    if (-not $ActivePort) { $ActivePort = Get-BgSlotPort (Get-BgActiveSlot) }
    New-BgDevApiCaddyfile "127.0.0.1:$ActivePort"
    $caddy = Resolve-Caddy
    $pidFile = Join-Path $script:LogsDir 'dev-api-proxy.pid'
    if (Test-PidFileAlive $pidFile) {
        & $caddy reload --config $script:BgDevApiCaddyfile 2>$null
        if ($LASTEXITCODE -eq 0) { Write-LogOk "dev API 代理已 reload -> 127.0.0.1:$ActivePort"; return }
    }
    Start-BgDevApiProxy
}

function Stop-BgDevApiProxy {
    Stop-ServiceByPidFile 'dev-api-proxy'
    Stop-Port $script:BACKEND_PORT
}

function Set-BgFrontendFlip([string]$Slot) {
    $dest = Get-BgFrontendSlotDir $Slot
    if (-not (Test-Path (Join-Path $dest 'index.html'))) { throw "dist-$Slot 无效" }
    $live = Get-BgFrontendLiveLink
    if (Test-Path $live) { Remove-Item $live -Force -Recurse -ErrorAction SilentlyContinue }
    New-Item -ItemType Junction -Path $live -Target $dest -Force | Out-Null
    Set-BgStateValue 'frontend_slot' $Slot
    Write-LogOk "前端 dist-live -> dist-$Slot"
}

function Prepare-BgFrontendInactive {
    $inactive = Get-BgInactiveSlot
    $src = Join-Path $script:FrontendDir 'dist'
    if (-not (Test-Path (Join-Path $src 'index.html'))) { throw "缺少 dist/index.html" }
    if (-not (Test-Path (Join-Path $src 'login.html'))) { throw "缺少 dist/login.html" }
    $dest = Get-BgFrontendSlotDir $inactive
    Write-LogInfo "准备前端 inactive 槽位 dist-$inactive..."
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item $src $dest -Recurse -Force
    Write-LogOk '前端 inactive 槽位就绪'
}

function Stop-BgSchedulerOnly {
    Stop-ServiceByPidFile 'scheduler'
}

function Restart-BgWorkerScheduler {
    Stop-BgSchedulerOnly
    $pidFile = Join-Path $script:LogsDir 'worker.pid'
    if (Test-Path $pidFile) {
        $procId = [int](Get-Content $pidFile -Raw).Trim()
        if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
            Write-LogInfo "等待 Worker 优雅退出（最多 $($script:WORKER_DRAIN_TIMEOUT)s）..."
            Stop-Process -Id $procId -ErrorAction SilentlyContinue
            $i = 0
            while ($i -lt [int]$script:WORKER_DRAIN_TIMEOUT -and (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
                Start-Sleep -Seconds 1
                $i++
            }
            if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
                Write-LogWarn 'Worker drain 超时，强制结束'
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    Stop-ServiceByPidFile 'worker'
    if ($script:DeployMode -eq 'dev') { Start-WorkerDev } else { Start-WorkerProd }
}

function Invoke-BgRollbackUpdate {
    $activeSlot = Get-BgActiveSlot
    $activePort = Get-BgSlotPort $activeSlot
    Write-LogWarn "执行蓝绿 update 回滚（保持 active=$activeSlot）..."
    Stop-BgBackendSlot (Get-BgInactiveSlot)
    if ($script:DeployMode -eq 'prod') {
        Set-BgFrontendFlip $activeSlot
        Reload-CaddyProdConfig
    } else {
        Reload-BgDevApiProxy $activePort
    }
    if (-not (Test-BgHealthOnPort $activePort 10)) {
        Write-LogError '回滚后 active backend 不健康，请手动检查'
        $pre = Get-BgStateValue 'pre_update_git_sha'
        Write-LogError "升级前 Git: $pre"
        throw '蓝绿回滚未完成'
    }
    Write-LogWarn "蓝绿回滚完成；完整退回代码: git checkout $(Get-BgStateValue 'pre_update_git_sha')"
}

function Reload-CaddyProdConfig {
    New-Caddyfile
    $caddy = Resolve-Caddy
    if (-not $caddy) { throw '未安装 Caddy' }
    & $caddy validate --config $script:Caddyfile 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Caddyfile 校验失败' }
    $pidFile = Join-Path $script:LogsDir 'caddy.pid'
    if (Test-PidFileAlive $pidFile) {
        & $caddy reload --config $script:Caddyfile 2>$null
        if ($LASTEXITCODE -eq 0) { Write-LogOk 'Caddy 已 reload'; return }
        Write-LogWarn 'Caddy reload 失败，尝试完整重启...'
    }
    Start-CaddyProd
}

function Invoke-BgUpdateProd {
    Initialize-BgState
    Set-BgStateValue 'pre_update_git_sha' (git -C $script:ProjectRoot rev-parse HEAD 2>$null)
    $inactive = Get-BgInactiveSlot
    $inactivePort = Get-BgSlotPort $inactive
    $oldActive = Get-BgActiveSlot
    Sync-GitFromOrigin
    Ensure-FrontendDist
    Prepare-BgFrontendInactive
    Invoke-Migrate
    Stop-BgSchedulerOnly
    try {
        Start-BgBackendSlot $inactive 'prod'
        Set-BgFrontendFlip $inactive
        Set-BgStateValue 'active_slot' $inactive
        Reload-CaddyProdConfig
        Stop-BgBackendSlot $oldActive -Graceful
        Restart-BgWorkerScheduler
        Record-DeployReleaseMetadata
    } catch {
        Set-BgStateValue 'active_slot' $oldActive
        Invoke-BgRollbackUpdate
        throw
    }
    Write-LogOk "生产环境蓝绿 update 完成 (active=$inactive, :$inactivePort)"
}

function Invoke-BgUpdateDev {
    Initialize-BgState
    Set-BgStateValue 'pre_update_git_sha' (git -C $script:ProjectRoot rev-parse HEAD 2>$null)
    $inactive = Get-BgInactiveSlot
    $inactivePort = Get-BgSlotPort $inactive
    $oldActive = Get-BgActiveSlot
    Sync-GitFromOrigin
    Invoke-Migrate
    Stop-BgSchedulerOnly
    try {
        Start-BgBackendSlot $inactive 'dev'
        Reload-BgDevApiProxy $inactivePort
        Set-BgStateValue 'active_slot' $inactive
        Stop-BgBackendSlot $oldActive -Graceful
        Restart-BgWorkerScheduler
        Record-DeployReleaseMetadata
    } catch {
        Set-BgStateValue 'active_slot' $oldActive
        Invoke-BgRollbackUpdate
        throw
    }
    Write-LogOk "开发环境蓝绿 update 完成 (active=$inactive, API :$($script:BACKEND_PORT))"
}

function Write-BgStatus {
    Write-Host "  蓝绿部署: 已启用 (active=$(Get-BgActiveSlot), frontend=$(Get-BgStateValue 'frontend_slot'))"
    foreach ($slot in @('blue','green')) {
        $port = Get-BgSlotPort $slot
        if (Test-BgHealthOnPort $port 3) {
            Write-Host "  backend-$slot (:$port): 健康"
        } else {
            Write-Host "  backend-$slot (:$port): 未就绪"
        }
    }
    if ($script:DeployMode -eq 'dev') {
        if (Test-PortInUse $script:BACKEND_PORT) { Write-Host "  dev API 代理 (:$($script:BACKEND_PORT)): 监听中" }
        else { Write-Host "  dev API 代理 (:$($script:BACKEND_PORT)): 未运行" }
    }
}
