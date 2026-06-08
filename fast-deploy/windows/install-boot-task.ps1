# RiverEdge Windows 开机自启（计划任务）安装/卸载
param(
    [Parameter()]
    [ValidateSet('install', 'uninstall', 'status')]
    [string]$Action = 'install',
    [string]$FastDeployDir = '',
    [string]$ProjectRoot = ''
)

$ErrorActionPreference = 'Stop'

if (-not $FastDeployDir) { $FastDeployDir = Split-Path $PSScriptRoot -Parent }
if (-not $ProjectRoot) { $ProjectRoot = Split-Path $FastDeployDir -Parent }

$env:DEPLOY_MODE = 'prod'
$script:FastDeployDir = $FastDeployDir
$script:ProjectRoot = $ProjectRoot

. (Join-Path $FastDeployDir 'lib\common.ps1')
Load-DeployEnv

switch ($Action) {
    'install'   { Install-RiverEdgeBootTask }
    'uninstall' { Uninstall-RiverEdgeBootTask }
    'status'    { Write-Output (Get-RiverEdgeBootStatusLabel) }
    default     { throw "未知操作: $Action" }
}
