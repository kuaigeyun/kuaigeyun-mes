# 恢复端口 9000 使用脚本
# 需要以管理员身份运行 PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "恢复端口 9000 使用" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ 错误：需要以管理员身份运行此脚本" -ForegroundColor Red
    Write-Host "   请右键点击 PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 已确认管理员权限" -ForegroundColor Green
Write-Host ""

# 显示当前端口保留范围
Write-Host "当前端口保留范围：" -ForegroundColor Yellow
netsh interface ipv4 show excludedportrange protocol=tcp
Write-Host ""

# 检查 vmcompute 服务状态
Write-Host "检查 Hyper-V 服务状态..." -ForegroundColor Yellow
$vmcompute = Get-Service -Name vmcompute -ErrorAction SilentlyContinue
if ($vmcompute) {
    Write-Host "  vmcompute 服务状态: $($vmcompute.Status)" -ForegroundColor $(if ($vmcompute.Status -eq 'Running') { 'Yellow' } else { 'Green' })
    
    if ($vmcompute.Status -eq 'Running') {
        Write-Host ""
        Write-Host "⚠️  警告：vmcompute 服务正在运行，这会保留端口范围" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "选项 1：临时停止 vmcompute 服务（测试端口 9000）" -ForegroundColor Cyan
        Write-Host "选项 2：修改 Hyper-V 动态端口范围（避开 9000）" -ForegroundColor Cyan
        Write-Host "选项 3：继续使用端口 9100（推荐，不影响其他功能）" -ForegroundColor Cyan
        Write-Host ""
        
        $choice = Read-Host "请选择 (1/2/3，直接回车跳过)"
        
        if ($choice -eq '1') {
            Write-Host ""
            Write-Host "停止 vmcompute 服务..." -ForegroundColor Yellow
            Stop-Service -Name vmcompute -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            
            Write-Host "测试端口 9000..." -ForegroundColor Yellow
            $test = Test-NetConnection -ComputerName localhost -Port 9000 -InformationLevel Quiet -WarningAction SilentlyContinue
            if (-not $test) {
                Write-Host "✅ 端口 9000 现在应该可用了" -ForegroundColor Green
                Write-Host "⚠️  注意：重启后 vmcompute 服务会自动启动，端口可能再次被保留" -ForegroundColor Yellow
            } else {
                Write-Host "❌ 端口 9000 仍被占用" -ForegroundColor Red
            }
        }
        elseif ($choice -eq '2') {
            Write-Host ""
            Write-Host "修改 Hyper-V 动态端口范围..." -ForegroundColor Yellow
            Write-Host "将动态端口范围改为 49152-65535（避开 9000）" -ForegroundColor Yellow
            netsh int ipv4 set dynamicport tcp start=49152 num=16384
            Write-Host "✅ 已修改动态端口范围" -ForegroundColor Green
            Write-Host "⚠️  需要重启 vmcompute 服务使更改生效" -ForegroundColor Yellow
            Restart-Service -Name vmcompute -Force -ErrorAction SilentlyContinue
            Write-Host "✅ 已重启 vmcompute 服务" -ForegroundColor Green
        }
        else {
            Write-Host ""
            Write-Host "✅ 保持当前配置（使用端口 9100）" -ForegroundColor Green
            Write-Host "   这是最安全的方案，不会影响 Hyper-V/WSL2/Docker 等功能" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  vmcompute 服务未安装或未运行" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

