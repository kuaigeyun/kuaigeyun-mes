# RiverEdge fast-deploy 快速部署

**推荐入口（Git Bash / Linux 统一）：**

```bash
cd riveredge
./fast-deploy/deploy.sh              # 生产一键部署
./fast-deploy/deploy.sh dev          # 开发模式
./fast-deploy/deploy.sh configure    # 仅运行配置向导
```

脚本会自动：检测 Windows/Linux → 默认启用国内镜像 → 安装缺失依赖 → 交互配置 → 迁移 → 构建 → 启动。

不依赖部署面板（`riveredge-panel`）。系统安装命令复用 [`../riveredge-panel/install-scripts.json`](../riveredge-panel/install-scripts.json)。

## 脚本对照

| 场景 | 命令 |
|------|------|
| **统一入口（推荐）** | [`deploy.sh`](deploy.sh) |
| Linux 开发/生产 | [`linux/dev.sh`](linux/dev.sh) / [`linux/prod.sh`](linux/prod.sh) |
| Windows PowerShell | [`windows/dev.ps1`](windows/dev.ps1) / [`windows/prod.ps1`](windows/prod.ps1) |

## 配置向导（configure）

首次部署或 `./fast-deploy/deploy.sh configure` 时会交互填写：

| 项 | 说明 |
|----|------|
| PostgreSQL 用户名 | 默认 `postgres` |
| PostgreSQL 主机 | 本地 `localhost`，远程填 IP |
| 数据库名 | 默认 `riveredge` |
| PostgreSQL 密码 | 必填 |
| 平台超管密码 | 登录用户 `infra_admin` |
| 服务器 IP | **自动检测**本机局域网 IP，回车确认 |

写入文件：

- 应用配置 → `riveredge-backend/.env`（含 `BASE_URL`、`CORS_ORIGINS`）
- 部署配置 → `fast-deploy/deploy.env`（含 `SERVER_IP`、端口）

## 环境要求

| 组件 | 版本 | 开发 | 生产 |
|------|------|:----:|:----:|
| Node.js | 22+ | 必需 | 必需（构建） |
| Python | 3.12+ | 必需 | 必需 |
| uv / npm | — | 必需 | 必需 |
| PostgreSQL | 15+ | 必需 | 必需 |
| Caddy | 最新 | — | 必需 |

异步任务由 **Taskiq + PostgreSQL** 承担，无需 Redis。

## 默认端口

| 模式 | Web 入口 | API |
|------|----------|-----|
| 开发 | http://\<IP\>:8100（Vite） | http://\<IP\>:8200 |
| 生产 | http://\<IP\>:8080（Caddy → dist） | 经 Caddy 反代 `/api` |

## 子命令

```
check      # 检测环境
install    # 安装缺失依赖（Linux sudo；Windows 管理员 Git Bash / PowerShell）
configure  # 配置向导
migrate    # uv sync + aerich upgrade
build      # npm install + vite build
start      # 启动服务
stop       # 停止
status     # 状态
update     # 拉代码 + 迁移 + 重启
(无参)     # 完整生产部署流程
```

## 镜像与环境变量

默认 **`USE_MIRROR=1`**（清华 uv 源 + npmmirror npm 源；PostgreSQL 走阿里云 PGDG 镜像；Caddy 走 GitHub bundled）。Node/Python 仍走官方安装以保证版本。

```bash
USE_MIRROR=0 ./fast-deploy/deploy.sh install   # 禁用国内镜像
DEPLOY_MODE=dev ./fast-deploy/deploy.sh        # 强制开发模式
```

## Windows 说明

- 在 **Git Bash** 中运行 `./fast-deploy/deploy.sh` 即可；`install` 会自动转调 PowerShell（winget）。
- 也可直接运行 [`windows/dev.ps1`](windows/dev.ps1) 或双击 [`dev.cmd`](windows/dev.cmd)。

## 日志与生成文件

| 路径 | 说明 |
|------|------|
| `.logs/*.log` | 运行日志 |
| `fast-deploy/caddy/Caddyfile` | 生产 Caddy（自动生成） |
| `fast-deploy/deploy.env` | 本地部署配置（不入库） |

## 故障排查

1. **install 后 check 仍失败**：重开终端刷新 PATH。
2. **数据库连接失败**：确认 PostgreSQL 服务已启动、密码正确。
3. **8080 无法访问**：查看 `.logs/caddy.log`；确认已 build 且有 `riveredge-frontend/dist/index.html`。
4. **Linux Caddy 冲突**：`sudo systemctl stop caddy && sudo systemctl disable caddy`。

## 与现有脚本

- [`Launch.dev.sh`](../Launch.dev.sh) 保留；推荐新用户使用 `deploy.sh`。
- 图形化部署见 [部署面板使用指南](../docs/部署面板使用指南.md)。
