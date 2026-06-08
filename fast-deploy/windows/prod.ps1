# RiverEdge 生产模式快速部署（Windows PowerShell）
# 用法: .\fast-deploy\windows\prod.ps1 [check|install|configure|migrate|build|start|stop|status|update|install-service|uninstall-service]

$ErrorActionPreference = 'Stop'
$env:DEPLOY_MODE = 'prod'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')
Load-DeployEnv
Invoke-FdDispatch ($args | Select-Object -First 1)
