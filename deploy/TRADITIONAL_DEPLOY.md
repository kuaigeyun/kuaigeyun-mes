# RiverEdge 传统部署指南（无 Docker）

本指南适用于在服务器上直接安装 Postgres、Redis、Caddy、Inngest，后端用 uvicorn、前端构建后由 Caddy 托管静态文件并反向代理 API 的部署方式。

## 架构

```
Caddy (80/443)
    ├── /api/*     → 反向代理到 uvicorn :8200
    └── /*         → 静态文件 /opt/riveredge/frontend-dist

uvicorn (127.0.0.1:8200) ← riveredge-backend
    ├── Postgres
    └── Redis

Inngest (8288)
    ├── Postgres (inngest 数据库)
    ├── Redis
    └── 调用 Backend /api/inngest
```

## 服务器环境要求

- Ubuntu 22.04+ / Debian 11+
- 开放端口：80、443（Caddy）

## 一、安装系统依赖

```bash
apt update && apt install -y postgresql redis-server caddy python3.11 python3.11-venv nodejs npm git curl
```

如需使用 UV 管理 Python（推荐）：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 二、Postgres

1. 创建数据库 `riveredge`、`inngest`：

```bash
sudo -u postgres psql -c "CREATE USER riveredge WITH PASSWORD '你的密码';"
sudo -u postgres psql -c "CREATE DATABASE riveredge OWNER riveredge;"
sudo -u postgres psql -c "CREATE DATABASE inngest OWNER riveredge;"
```

或使用 `deploy/postgres/init-inngest.sql` 中的 `CREATE DATABASE inngest;`（若 inngest 库不存在）。

## 三、Redis

默认配置即可。若需密码，编辑 `/etc/redis/redis.conf` 设置 `requirepass`，并在 `.env` 中配置 `REDIS_PASSWORD`。

## 四、部署代码

```bash
git clone <你的仓库地址> /opt/riveredge
cd /opt/riveredge
```

### 后端依赖

```bash
cd /opt/riveredge/riveredge-backend
uv sync --no-install-project --frozen --no-dev
# 若无 uv，可用：python3.11 -m venv .venv && .venv/bin/pip install -e .
```

### 前端构建

```bash
cd /opt/riveredge/riveredge-frontend
npm ci && npm run build
```

### 复制前端构建产物到静态目录

```bash
mkdir -p /opt/riveredge/frontend-dist
cp -r /opt/riveredge/riveredge-frontend/src/dist/* /opt/riveredge/frontend-dist/
```

## 五、配置

1. 复制 `deploy/env.prod.example` 为 `/opt/riveredge/.env` 并填写实际值：

```bash
cp /opt/riveredge/deploy/env.prod.example /opt/riveredge/.env
# 编辑 .env，填写 DOMAIN、DB_PASSWORD、INNGEST_EVENT_KEY、INNGEST_SIGNING_KEY 等
```

2. 生成 Inngest 密钥（若未设置）：

```bash
openssl rand -hex 32  # 用于 INNGEST_EVENT_KEY
openssl rand -hex 32  # 用于 INNGEST_SIGNING_KEY
```

3. 数据库连接字符串格式（供参考）：

- 后端：`postgres://riveredge:密码@127.0.0.1:5432/riveredge`
- Inngest：`postgres://riveredge:密码@127.0.0.1:5432/inngest`
- Redis：`redis://127.0.0.1:6379` 或 `redis://:密码@127.0.0.1:6379`

## 六、数据库迁移

首次启动后端前执行：

```bash
cd /opt/riveredge/riveredge-backend
# 确保 .env 在 /opt/riveredge 或通过 --env-file 指定
uv run aerich upgrade
```

## 七、Systemd 服务

### 后端服务

复制 `deploy/riveredge-backend.service.example` 到 `/etc/systemd/system/riveredge-backend.service`，按需修改路径和环境变量，然后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable riveredge-backend
sudo systemctl start riveredge-backend
```

### Inngest 服务

1. 安装 Inngest 二进制：从 [GitHub Releases](https://github.com/inngest/inngest/releases) 下载对应架构的 `inngest`，或 `go install github.com/inngest/inngest/cmd/inngest@latest`（若已安装 Go）。

2. 复制 `deploy/riveredge-inngest.service.example` 到 `/etc/systemd/system/riveredge-inngest.service`，填写环境变量后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable riveredge-inngest
sudo systemctl start riveredge-inngest
```

### Caddy

1. 部署 Caddyfile：将 `deploy/Caddyfile` 复制到 `/etc/caddy/Caddyfile`，确保 `root` 指向 `/opt/riveredge/frontend-dist`，`reverse_proxy` 指向 `127.0.0.1:8200`。

2. 若使用环境变量 `DOMAIN`，可通过 systemd 或 Caddy 的 envfile 传入。

3. 启动 Caddy：

```bash
sudo systemctl enable caddy
sudo systemctl start caddy
```

## 八、验证

- 访问 `https://你的域名/infra/login`
- 用户名：`infra_admin`，密码：`.env` 中 `INFRA_SUPERADMIN_PASSWORD`

## 九、更新部署

使用 `deploy/deploy.sh` 一键更新：

```bash
cd /opt/riveredge
bash deploy/deploy.sh
```

或手动执行：

```bash
cd /opt/riveredge
git pull
cd riveredge-backend && uv sync --no-install-project --frozen --no-dev
cd ../riveredge-frontend && npm ci && npm run build
mkdir -p /opt/riveredge/frontend-dist && cp -r riveredge-frontend/src/dist/* /opt/riveredge/frontend-dist/
sudo systemctl restart riveredge-backend
# Caddy 无需重启（静态文件变更即生效）
```
