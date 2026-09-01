#!/usr/bin/env bash
# Cloud Agent 开发环境安装脚本（幂等）。
# 负责：系统依赖(PostgreSQL16+pgvector / uv / 运行库) + 数据库初始化
#       + 后端 uv 依赖 + 敏感词包 + 数据库迁移 + 前端 npm 依赖。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/riveredge-backend"
FRONTEND_DIR="$REPO_ROOT/riveredge-frontend"

DB_NAME="${DB_NAME:-riveredge}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

log() { echo -e "\n\033[1;36m[install] $*\033[0m"; }

# ---------------------------------------------------------------------------
# 1) 系统依赖：PostgreSQL 16 + pgvector、运行库（zbar/gomp/gl 供二维码与 OCR）
# ---------------------------------------------------------------------------
log "安装系统依赖 (PostgreSQL 16 + pgvector, 运行库)..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib postgresql-16-pgvector \
    libzbar0 libgomp1 libgl1 \
    ca-certificates curl

PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1 || echo 16)"

# ---------------------------------------------------------------------------
# 2) uv（Astral）：Python 依赖管理器
# ---------------------------------------------------------------------------
if ! command -v uv >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/uv" ]; then
    log "安装 uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"
sudo ln -sf "$HOME/.local/bin/uv" /usr/local/bin/uv 2>/dev/null || true

# ---------------------------------------------------------------------------
# 3) 启动 PostgreSQL 集群并初始化库 / 用户 / pgvector 扩展（幂等）
# ---------------------------------------------------------------------------
log "启动 PostgreSQL 集群并初始化数据库..."
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true
for _ in $(seq 1 30); do
    pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && break
    sleep 1
done

sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASSWORD';"
if ! sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
        "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
fi
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
    "CREATE EXTENSION IF NOT EXISTS vector;"

# ---------------------------------------------------------------------------
# 4) 后端：.env、Python 依赖、敏感词包、数据库迁移
# ---------------------------------------------------------------------------
log "配置后端 .env 并安装 Python 依赖..."
cd "$BACKEND_DIR"
if [ ! -f .env ]; then
    cp .env.example .env
    # 开发用默认密钥与平台超管密码（生产务必修改）
    sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=dev-local-secret-key-change-in-production|" .env
    sed -i "s|^PLATFORM_SUPERADMIN_PASSWORD=.*|PLATFORM_SUPERADMIN_PASSWORD=Admin@123456|" .env
fi

export UV_LINK_MODE=copy
uv sync --no-install-project --extra ocr --extra pdf

log "生成敏感词 lexicon.pack（未入库，须本机生成，否则后端 /health 500）..."
if [ ! -s src/core/data/sensitive_words/lexicon.pack ]; then
    uv run python scripts/pack_sensitive_words.py
fi

log "执行数据库迁移 (aerich upgrade)..."
PYTHONPATH=src uv run aerich upgrade

# ---------------------------------------------------------------------------
# 5) 前端：npm 依赖
# ---------------------------------------------------------------------------
log "安装前端依赖 (npm install)..."
cd "$FRONTEND_DIR"
npm install --legacy-peer-deps

log "开发环境安装完成。"
