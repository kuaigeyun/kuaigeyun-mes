#!/usr/bin/env bash
# 使用 16G 内存构建 WEB 和 H5，构建完成后远程推送
# Usage: ./build-web-h5.sh

set -e
export NODE_OPTIONS="--max-old-space-size=16384"  # 16GB

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "使用 16GB 内存构建 WEB 和 H5"
echo "=========================================="

# 1. 构建 WEB (riveredge-frontend)
echo ""
echo "[1/3] 构建 WEB (riveredge-frontend)..."
cd "$PROJECT_ROOT/riveredge-frontend"
npm run build:16g
echo "WEB 构建完成"

# 2. 构建 H5 (riveredge-mobile)
echo ""
echo "[2/3] 构建 H5 (riveredge-mobile)..."
cd "$PROJECT_ROOT/riveredge-mobile"
npx expo export --platform web
echo "H5 构建完成 (输出到 riveredge-mobile/dist)"

# 3. 远程推送
echo ""
echo "[3/3] 远程推送..."
cd "$PROJECT_ROOT"
git add -A
git status
if git diff --staged --quiet 2>/dev/null; then
  echo "无变更需要提交，跳过 push"
else
  git commit -m "chore: build WEB and H5" || true
  git push
  echo "远程推送完成"
fi

echo ""
echo "=========================================="
echo "全部完成"
echo "=========================================="
