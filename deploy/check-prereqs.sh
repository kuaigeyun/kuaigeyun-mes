#!/bin/bash
# RiverEdge 传统部署 - 前置检查脚本
# 检查必备软件和数据库是否完备，部署前在服务器上执行
# 用法：bash deploy/check-prereqs.sh 或 cd /opt/riveredge && bash deploy/check-prereqs.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

PASS=0
FAIL=0

echo "=== RiverEdge 前置检查 ==="
echo ""

# 1. 必备软件
echo "--- 必备软件 ---"
for cmd in postgres psql redis-server redis-cli caddy python3.11 node npm git curl openssl; do
  if command -v "$cmd" &>/dev/null; then
    ok "$cmd"
    ((PASS++)) || true
  else
    fail "$cmd 未安装"
    ((FAIL++)) || true
  fi
done

# uv（推荐）
if command -v uv &>/dev/null; then
  ok "uv"
  ((PASS++)) || true
else
  warn "uv 未安装（推荐）: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

# inngest（可选，用于自建 Inngest）
if command -v inngest &>/dev/null; then
  ok "inngest"
  ((PASS++)) || true
else
  warn "inngest 未安装（自建 Inngest 时需安装）"
fi

echo ""

# 2. Postgres 服务
echo "--- Postgres ---"
if systemctl is-active --quiet postgresql 2>/dev/null || systemctl is-active --quiet postgres 2>/dev/null; then
  ok "Postgres 服务运行中"
  ((PASS++)) || true
else
  fail "Postgres 服务未运行"
  ((FAIL++)) || true
fi

# 3. Redis 服务
echo "--- Redis ---"
if systemctl is-active --quiet redis-server 2>/dev/null || systemctl is-active --quiet redis 2>/dev/null; then
  ok "Redis 服务运行中"
  ((PASS++)) || true
else
  fail "Redis 服务未运行"
  ((FAIL++)) || true
fi

# 4. 数据库存在性（需 .env 或环境变量 DB_PASSWORD）
echo "--- 数据库 ---"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
fi

DB_PW="${DB_PASSWORD:-}"
if [ -z "$DB_PW" ]; then
  warn "未设置 DB_PASSWORD，跳过数据库连接检查（请在 .env 中配置）"
else
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='riveredge'" 2>/dev/null | grep -q 1; then
    ok "数据库 riveredge 存在"
    ((PASS++)) || true
  else
    fail "数据库 riveredge 不存在"
    ((FAIL++)) || true
  fi

  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='inngest'" 2>/dev/null | grep -q 1; then
    ok "数据库 inngest 存在"
    ((PASS++)) || true
  else
    fail "数据库 inngest 不存在（执行: sudo -u postgres psql -c \"CREATE DATABASE inngest OWNER riveredge;\"）"
    ((FAIL++)) || true
  fi

  # 测试连接（使用 riveredge 用户）
  if PGPASSWORD="$DB_PW" psql -h 127.0.0.1 -U riveredge -d riveredge -tAc "SELECT 1" 2>/dev/null | grep -q 1; then
    ok "Postgres 连接 riveredge 成功"
    ((PASS++)) || true
  else
    fail "Postgres 连接 riveredge 失败（检查用户/密码）"
    ((FAIL++)) || true
  fi
fi

# 5. Redis 连接
echo "--- Redis 连接 ---"
if redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "Redis 连接成功"
  ((PASS++)) || true
else
  fail "Redis 连接失败"
  ((FAIL++)) || true
fi

# 6. 配置文件
echo "--- 配置 ---"
if [ -f "$ENV_FILE" ]; then
  ok ".env 存在"
  ((PASS++)) || true
  # 检查关键变量
  for var in DOMAIN DB_PASSWORD INNGEST_EVENT_KEY INNGEST_SIGNING_KEY INFRA_SUPERADMIN_PASSWORD; do
    val=$(grep -E "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$val" ] && [ "$val" != "替换为DB_PASSWORD" ]; then
      ok "  $var 已配置"
    else
      warn "  $var 未配置或为空"
    fi
  done
else
  warn ".env 不存在（复制 deploy/env.prod.example 为 .env 并填写）"
fi

# 7. 项目目录
echo "--- 项目 ---"
if [ -d "$PROJECT_ROOT/riveredge-backend" ] && [ -d "$PROJECT_ROOT/riveredge-frontend" ]; then
  ok "项目目录完整"
  ((PASS++)) || true
else
  fail "项目目录不完整（riveredge-backend 或 riveredge-frontend 缺失）"
  ((FAIL++)) || true
fi

# 8. 前端构建产物
if [ -d "$PROJECT_ROOT/frontend-dist" ] && [ -f "$PROJECT_ROOT/frontend-dist/index.html" ]; then
  ok "前端构建产物存在"
  ((PASS++)) || true
else
  warn "frontend-dist 不存在或为空（需先执行 npm run build 并复制到 frontend-dist）"
fi

# 9. Caddy
echo "--- Caddy ---"
if systemctl is-active --quiet caddy 2>/dev/null; then
  ok "Caddy 服务运行中"
  ((PASS++)) || true
else
  warn "Caddy 服务未运行"
fi

if [ -f /etc/caddy/Caddyfile ]; then
  ok "Caddyfile 已部署"
  ((PASS++)) || true
else
  warn "Caddyfile 未部署（复制 deploy/Caddyfile 到 /etc/caddy/Caddyfile）"
fi

echo ""
echo "=== 汇总 ==="
echo "通过: $PASS  |  失败: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "请先解决上述失败项后再部署。"
  exit 1
fi
echo ""
echo "前置检查通过，可继续部署。"
