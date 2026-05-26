# fast-deploy 快速部署

统一部署入口，支持 **Linux** 与 **Windows（Git Bash）**。完整部署说明见 [docs/部署指南.md](../docs/部署指南.md)。

## 推荐入口

```bash
cd riveredge
./fast-deploy/deploy.sh              # 生产 · 8 阶段向导
./fast-deploy/deploy.sh dev            # 开发模式
./fast-deploy/deploy.sh wizard         # 显式进入向导
```

子命令 `check / install / configure / migrate / build / start / stop / status / update` 可用于单步操作。

## 脚本对照

| 场景 | 命令 |
|------|------|
| **统一入口（推荐）** | [`deploy.sh`](deploy.sh) |
| Linux | [`linux/dev.sh`](linux/dev.sh) / [`linux/prod.sh`](linux/prod.sh) |
| Windows PowerShell | [`windows/dev.ps1`](windows/dev.ps1) / [`windows/prod.ps1`](windows/prod.ps1) |
| Windows 组件安装 | [`windows/install-component.ps1`](windows/install-component.ps1) |

## 环境要求（摘要）

Node.js 22+ · Python 3.12+（系统）/ 3.11（uv 虚拟环境）· uv · npm · PostgreSQL 15+ · Caddy（生产）。**无需 Redis**（Taskiq + PostgreSQL）。

## 默认端口

| 模式 | Web | API |
|------|-----|-----|
| 开发 | :8100（Vite） | :8200 |
| 生产 | :8080（Caddy） | 经 Caddy `/api` |

## Windows 要点

- Git Bash 运行 `./fast-deploy/deploy.sh`；依赖安装走 PowerShell
- winget 不可用时自动 fallback（MSI / 官方安装包 / 便携版）
- Caddyfile 使用 `C:/...` 原生路径，避免静态资源 404

详细故障排查与运维命令见 [部署指南](../docs/部署指南.md)。
