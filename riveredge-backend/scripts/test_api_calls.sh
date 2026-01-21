#!/bin/bash
# 测试迁移后的API路由实际调用

echo "=========================================="
echo "测试迁移后的API路由实际调用"
echo "=========================================="
echo ""

# 检查后端服务是否运行
echo "1. 检查后端服务状态..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 后端服务正在运行"
else
    echo "❌ 后端服务未运行，请先启动服务"
    exit 1
fi

echo ""
echo "2. 测试用户列表API (GET /api/v1/core/users)..."
echo "   注意：此API需要认证，这里只测试路由是否可访问"
response=$(curl -s -w "\n%{http_code}" http://localhost:8000/api/v1/core/users 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "200" ] || [ "$http_code" == "401" ] || [ "$http_code" == "403" ]; then
    echo "✅ API路由可访问 (HTTP $http_code)"
    echo "   响应: ${body:0:200}..."
else
    echo "❌ API路由访问失败 (HTTP $http_code)"
    echo "   响应: $body"
fi

echo ""
echo "3. 测试用户创建API (POST /api/v1/core/users)..."
echo "   注意：此API需要认证，这里只测试路由是否可访问"
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8000/api/v1/core/users \
    -H "Content-Type: application/json" \
    -d '{}' 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "201" ] || [ "$http_code" == "401" ] || [ "$http_code" == "403" ] || [ "$http_code" == "422" ]; then
    echo "✅ API路由可访问 (HTTP $http_code)"
    echo "   响应: ${body:0:200}..."
else
    echo "❌ API路由访问失败 (HTTP $http_code)"
    echo "   响应: $body"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="

