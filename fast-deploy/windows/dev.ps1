# RiverEdge 开发模式快速部署（Windows PowerShell）
# 用法: .\fast-deploy\windows\dev.ps1 [check|install|configure|migrate|build|start|stop|status|update]

$ErrorActionPreference = 'Stop'
$env:DEPLOY_MODE = 'dev'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Load-DeployEnv
Invoke-FdDispatch ($args | Select-Object -First 1)
