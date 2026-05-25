# RiverEdge fast-deploy 快速部署

**推荐入口（对话式向导）：**

```bash
cd riveredge
./fast-deploy/deploy.sh              # 生产 · 7 阶段智能向导
./fast-deploy/deploy.sh dev            # 开发模式（跳过模式选择）
./fast-deploy/deploy.sh wizard         # 显式进入向导
```

子命令 `check / install / configure / ...` 仍可用于单步操作。

## 智能部署向导（7 阶段）

| 阶段 | 名称 | 说明 |
|:----:|------|------|
| 1 | 系统识别 | 检测 Windows/Linux、架构、部署模式、镜像策略 |
| 2 | 环境监测 | 扫描 Node / Python / uv / npm / PostgreSQL / Caddy |
| 3 | 环境准备 | 初始化目录、加载 deploy.env、启用国内镜像 |
| 4 | 环境软件安装 | 静默安装缺失依赖（日志 → `.logs/wizard-deps.log`） |
| 5 | 系统配置 | 交互填写数据库、超管密码、服务器 IP |
| 6 | 系统安装 | 迁移 → 构建 → 启动（dev 直接热重载启动） |
| 7 | 安装完成 | 展示访问地址、账号与常用命令 |

向导输出形如对话：

```
RiverEdge › 你好，我将引导你完成 RiverEdge 的检测、安装与启动。
━━━ 阶段 2/7 · 环境监测 ━━━
  ✓ Node.js 22+ — 就绪
  ! PostgreSQL 15+ — 版本 14.23，需要升级
```

## 脚本对照

| 场景 | 命令 |
|------|------|
| **统一入口（推荐）** | [`deploy.sh`](deploy.sh) |
| Linux 开发/生产 | [`linux/dev.sh`](linux/dev.sh) / [`linux/prod.sh`](linux/prod.sh) |
| Windows PowerShell | [`windows/dev.ps1`](windows/dev.ps1) / [`windows/prod.ps1`](windows/prod.ps1) |

## 配置向导（阶段 5）

| 项 | 说明 |
|----|------|
| PostgreSQL 用户名 | 默认 `postgres` |
| PostgreSQL 主机 | 本地 `localhost`，远程填 IP |
| PostgreSQL 端口 | 自动检测 PG15 集群（常为 5432 或 5433） |
| 数据库名 | 默认 `riveredge` |
| PostgreSQL 密码 | 必填（本机 postgres 密码） |
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
wizard     # 对话式完整部署（与无参相同）
check      # 检测环境
install    # 仅安装系统依赖
configure  # 配置向导
migrate    # uv sync + aerich upgrade
build      # npm install + vite build
start      # 启动服务
stop       # 停止
status     # 状态
update     # 拉代码 + 迁移 + 重启
```

## 镜像与环境变量

默认 **`USE_MIRROR=1`**（清华 uv 源 + npmmirror npm 源；PostgreSQL 走阿里云 PGDG 镜像；Caddy 走 apt 安装，国内镜像加速）。Node/Python 仍走官方安装以保证版本。

```bash
USE_MIRROR=0 ./fast-deploy/deploy.sh install   # 禁用国内镜像
DEPLOY_MODE=dev ./fast-deploy/deploy.sh        # 开发模式，跳过模式选择
WIZARD_TYPING=0 ./fast-deploy/deploy.sh        # 关闭对话逐行延迟
```

## Windows 说明

- 在 **Git Bash** 中运行 `./fast-deploy/deploy.sh` 即可；`install` 会自动转调 PowerShell（winget）。
- 也可直接运行 [`windows/dev.ps1`](windows/dev.ps1) 或双击 [`dev.cmd`](windows/dev.cmd)。

## 日志与生成文件

| 路径 | 说明 |
|------|------|
| `.logs/*.log` | 运行日志 |
| `.logs/wizard-deps.log` | 向导阶段 4 依赖安装日志 |
| `fast-deploy/caddy/Caddyfile` | 生产 Caddy（自动生成） |
| `fast-deploy/deploy.env` | 本地部署配置（不入库） |

## 故障排查

1. **install 后 check 仍失败**：重开终端刷新 PATH。
2. **数据库连接失败**：确认端口（PG15 常为 5433）、本机 postgres 密码正确。
3. **8080 无法访问**：查看 `.logs/caddy.log`；确认已 build 且有 `riveredge-frontend/dist/index.html`。
4. **Linux Caddy 冲突**：`sudo systemctl stop caddy && sudo systemctl disable caddy`。

## 与现有脚本

- [`Launch.dev.sh`](../Launch.dev.sh) 保留；推荐新用户使用 `deploy.sh`。
- 图形化部署见 [部署面板使用指南](../docs/部署面板使用指南.md)。
