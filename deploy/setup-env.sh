#!/bin/bash
# 生成生产环境 .env 文件
# 用法：./setup-env.sh 或 bash setup-env.sh
# 输出：.env（复制到服务器 /opt/riveredge/.env）

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="$SCRIPT_DIR/.env"

echo "=== RiverEdge 生产环境配置生成 ==="
echo ""

# 1. 数据库密码
read -p "数据库密码 DB_PASSWORD（直接回车将自动生成）: " DB_PW
if [ -z "$DB_PW" ]; then
    DB_PW=$(openssl rand -base64 24 | tr -d '\n')
    echo "  已生成: ${DB_PW:0:8}..."
fi

# 2. Inngest 密钥（直接回车将自动生成）
read -p "按回车自动生成 Inngest 密钥，或输入 y 手动输入: " INNGEST_CHOICE
if [ -z "$INNGEST_CHOICE" ] || [ "$INNGEST_CHOICE" != "y" ]; then
    INNGEST_EVENT=$(openssl rand -hex 32)
    INNGEST_SIGNING=$(openssl rand -hex 32)
    echo "  已生成 INNGEST_EVENT_KEY 和 INNGEST_SIGNING_KEY"
else
    read -p "INNGEST_EVENT_KEY: " INNGEST_EVENT
    read -p "INNGEST_SIGNING_KEY: " INNGEST_SIGNING
fi

# 3. 平台管理员密码（必填，勿使用默认值）
read -p "平台管理员密码（必填，用于 /infra/login）: " ADMIN_PW
while [ -z "$ADMIN_PW" ]; do
    echo "  密码不能为空，请重新输入"
    read -p "平台管理员密码: " ADMIN_PW
done

# 4. 域名
read -p "域名 DOMAIN（如 example.com）: " DOMAIN
DOMAIN=${DOMAIN:-example.com}

# 生成 .env
cat > "$OUTPUT" << EOF
# RiverEdge 生产环境 - 自动生成于 $(date +%Y-%m-%d)
DOMAIN=$DOMAIN
DB_PASSWORD=$DB_PW
REDIS_PASSWORD=
INNGEST_EVENT_KEY=$INNGEST_EVENT
INNGEST_SIGNING_KEY=$INNGEST_SIGNING
INNGEST_POSTGRES_URI=postgres://riveredge:${DB_PW}@127.0.0.1:5432/inngest
INNGEST_REDIS_URI=redis://127.0.0.1:6379
INFRA_SUPERADMIN_USERNAME=infra_admin
INFRA_SUPERADMIN_PASSWORD=$ADMIN_PW
INFRA_SUPERADMIN_EMAIL=admin@${DOMAIN}
INFRA_SUPERADMIN_FULL_NAME=平台超级管理员
EOF

echo ""
echo "✅ 已生成 $OUTPUT"
echo ""
echo "请将以下文件同步到服务器 /opt/riveredge/："
echo "  - $OUTPUT (重命名为 .env)"
echo "  - $SCRIPT_DIR/ (deploy 目录)"
echo ""
echo "平台管理员登录：https://$DOMAIN/infra/login"
echo "  用户名: infra_admin"
echo "  密码: $ADMIN_PW"
