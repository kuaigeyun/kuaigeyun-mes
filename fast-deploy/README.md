# RiverEdge fast-deploy 快速部署

**推荐入口（对话式向导）：**

```bash
cd riveredge
./fast-deploy/deploy.sh              # 生产 · 8 阶段智能向导
./fast-deploy/deploy.sh dev            # 开发模式（跳过模式选择）
./fast-deploy/deploy.sh wizard         # 显式进入向导
```

子命令 `check / install / configure / ...` 仍可用于单步操作。

## 向导入口（第一步三选一）

| 选项 | 说明 |
|:----:|------|
| **1) 全新安装** | 8 阶段完整流程（环境检测 → 安装规划 → 依赖安装 → 启动） |
| **2) 修改配置** | 逐项修改数据库、超管、访问 IP（回车保持原值） |
| **3) 更新系统** | 拉取代码 → 迁移 → 构建（生产）→ 重启服务 |

## 全新安装（8 阶段）

| 阶段 | 名称 | 说明 |
|:----:|------|------|
| 1 | 系统识别 | 检测 Windows/Linux、架构、部署模式、镜像策略 |
| 2 | 安装规划 | **安装前**一次性填写：数据库（本地/远程）、超管用户名密码、服务器 IP |
| 3 | 环境监测 | 扫描 Node / Python / uv / npm / PostgreSQL / Caddy |
| 4 | 环境准备 | 初始化目录、加载 deploy.env、启用国内镜像 |
| 5 | 环境软件安装 | 安装前列出待装组件，逐项安装并提示完成 |
| 6 | 应用配置 | 自动写入 JWT / BASE_URL / CORS，验证数据库连接（无交互） |
| 7 | 系统安装 | 迁移 → 构建 → 启动（失败时自动打印日志末尾，见 `.logs/wizard-deploy.log`） |
| 8 | 安装完成 | 展示访问地址、账号与常用命令 |

向导输出形如对话：

```
RiverEdge › 在安装依赖之前，请先确定数据库部署方式：
    1) 本地安装 PostgreSQL
    2) 使用远程数据库
RiverEdge › 请设定平台超级管理员（首次登录使用）
RiverEdge › 超管用户名 [infra_admin]:
RiverEdge › 超管密码（至少 6 位）:
RiverEdge › 浏览器访问本系统时使用的服务器 IP（已检测: 192.168.x.x）
  ✓ 安装规划已全部保存，后续将自动安装，无需再输入
```

## 脚本对照

| 场景 | 命令 |
|------|------|
| **统一入口（推荐）** | [`deploy.sh`](deploy.sh) |
| Linux 开发/生产 | [`linux/dev.sh`](linux/dev.sh) / [`linux/prod.sh`](linux/prod.sh) |
| Windows PowerShell | [`windows/dev.ps1`](windows/dev.ps1) / [`windows/prod.ps1`](windows/prod.ps1) |

## 安装规划（阶段 2，安装前 · 唯一交互阶段）

| 项 | 说明 |
|----|------|
| 数据库部署方式 | **本地安装 PG15** 或 **远程数据库**（远程则跳过本地 PG 安装） |
| PostgreSQL 用户名/主机/端口/库名/密码 | 本地默认 `postgres` + `localhost`；远程按实际填写；密码必填 |
| 平台超管用户名 | 默认 `infra_admin`，可自定义 |
| 平台超管密码 | **至少 6 位**，安装前必填 |
| 服务器 IP | **自动检测**本机局域网 IP，回车确认 |

填写完成后，阶段 3–8 **全自动**执行（安装依赖、初始化库、迁移、构建、启动），无需再输入。

`.env` 会写入 `DB_TARGET=local|remote`、完整 `DB_*`、`PLATFORM_SUPERADMIN_*`；`deploy.env` 写入 `SERVER_IP`。

## 单独配置

运行 `./fast-deploy/deploy.sh configure` 时可修改全部项（含数据库手动/强制重置模式）。

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
4. **Linux Caddy 冲突**：安装后会自动 `stop + disable` 系统 `caddy.service`；若仍冲突可执行 `sudo systemctl mask caddy`。

## 与现有脚本

- [`Launch.dev.sh`](../Launch.dev.sh) 保留；推荐新用户使用 `deploy.sh`。
- 图形化部署见 [部署面板使用指南](../docs/部署面板使用指南.md)。
