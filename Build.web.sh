#!/usr/bin/env bash
# 构建 riveredge-frontend，并将 dist + 其它已跟踪的改动一并暂存、提交、推送。
# 生产机只用仓库里的 dist；脚本会在构建后执行 git add -u，因此后端 / 面板等有改动时
# 即使 dist 与上次提交字节级一致，仍会正常提交（不再仅凭 dist 是否有 diff 决定）。
#
# 前置：当前分支已设置上游（git push -u origin <branch>），且能访问 origin。
# 未跟踪的新文件需自行 git add；Usage: ./build-web.sh [commit 说明]

set -euo pipefail
export NODE_OPTIONS="--max-old-space-size=16384"

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

git rev-parse --is-inside-work-tree >/dev/null

git fetch origin

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git rev-parse @{u} >/dev/null 2>&1 || {
  echo "错误: 当前分支未配置上游。执行: git push -u origin ${CURRENT_BRANCH}"
  exit 1
}

BEHIND=$(git rev-list --count HEAD.."@{upstream}")
AHEAD=$(git rev-list --count "@{upstream}"..HEAD)
echo "分支 ${CURRENT_BRANCH} | 相对上游 落后 ${BEHIND} / 未推送 ${AHEAD}"
if [ "${BEHIND}" != "0" ]; then
  echo "错误: 本地落后于 origin，请先 git pull 合并远程后再构建发布。"
  exit 1
fi

SOURCE_COMMIT=$(git rev-parse --short HEAD)
SOURCE_MSG=$(git log -1 --pretty=%s)

echo "构建 Web: ${SOURCE_COMMIT} ${SOURCE_MSG}"

cd "$PROJECT_ROOT/riveredge-frontend"
npm run build:16g

WEB_DIST="$PROJECT_ROOT/riveredge-frontend/dist"
test -f "$WEB_DIST/index.html"

cd "$PROJECT_ROOT"
git add -A riveredge-frontend/dist
# 已跟踪文件中的其它修改（后端、riveredge-panel、文档等）一并纳入本次发布
git add -u

git diff --staged --quiet && {
  echo "错误: 暂存区为空。dist 无变化，且仓库内没有其它已跟踪文件的修改可提交。"
  echo "（若有新文件，请先 git add 后再运行本脚本。）"
  exit 1
}

USER_MSG=${1:-}
if [ -n "$USER_MSG" ]; then
  COMMIT_MSG="$USER_MSG (build-web @ $SOURCE_COMMIT)"
else
  COMMIT_MSG="chore: build-web sync (build-web @ $SOURCE_COMMIT)"
fi

git commit -m "$COMMIT_MSG"
git push
echo "完成: $(git rev-parse --short HEAD) 已推送到 origin"
