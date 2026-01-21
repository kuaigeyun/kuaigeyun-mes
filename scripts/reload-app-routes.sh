#!/bin/bash
# 重新加载应用路由脚本
# 使用方法: ./scripts/reload-app-routes.sh <app_code>
# 示例: ./scripts/reload-app-routes.sh master-data

APP_CODE=${1:-master-data}
BACKEND_URL=${VITE_API_TARGET:-http://127.0.0.1:8200}
TENANT_ID=${TENANT_ID:-1}

echo "🔄 正在重新加载应用 $APP_CODE 的路由..."
echo "后端地址: $BACKEND_URL"
echo "组织ID: $TENANT_ID"
echo ""

# 从环境变量或localStorage获取token（这里需要手动设置）
TOKEN=${TOKEN:-""}

if [ -z "$TOKEN" ]; then
    echo "⚠️  请设置 TOKEN 环境变量，或者手动在浏览器控制台执行："
    echo ""
    echo "fetch('/api/v1/applications/$APP_CODE/reload-routes', {"
    echo "  method: 'POST',"
    echo "  headers: {"
    echo "    'Authorization': \`Bearer \${localStorage.getItem('token')}\`,"
    echo "    'X-Tenant-ID': localStorage.getItem('tenant_id')"
    echo "  }"
    echo "}).then(r => r.json()).then(console.log)"
    echo ""
    exit 1
fi

# 调用API
response=$(curl -s -X POST "$BACKEND_URL/api/v1/applications/$APP_CODE/reload-routes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json")

echo "响应: $response"
echo ""

if echo "$response" | grep -q '"success":true'; then
    echo "✅ 应用路由重新加载成功！"
    exit 0
else
    echo "❌ 应用路由重新加载失败，请查看后端日志"
    exit 1
fi
