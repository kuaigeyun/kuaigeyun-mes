#!/usr/bin/env bash
set -euo pipefail

# 用法：
#   ./fast-deploy/sync-publish-branch.sh [source_branch] [target_branch]
# 默认：
#   source_branch=develop-local
#   target_branch=develop
#
# 逻辑：
# 1. fast-forward 合并 source -> target
# 2. 读取当前工作区 .gitignore 作为发布过滤规则
# 3. 在 target 中删除“被 .gitignore 命中且已被跟踪”的文件
# 4. 若有变化则自动提交

SOURCE_BRANCH="${1:-develop-local}"
TARGET_BRANCH="${2:-develop}"
MODE="${3:-preview}"
IGNORE_FILE=".gitignore"

if ! git rev-parse --verify "$SOURCE_BRANCH" >/dev/null 2>&1; then
  echo "ERROR: source branch not found: $SOURCE_BRANCH"
  exit 1
fi

if ! git rev-parse --verify "$TARGET_BRANCH" >/dev/null 2>&1; then
  echo "ERROR: target branch not found: $TARGET_BRANCH"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree is not clean, please commit/stash first."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TMP_IGNORE_FILE=".git/.sync-publish-ignore.tmp"

cleanup() {
  rm -f "$TMP_IGNORE_FILE"
  if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$CURRENT_BRANCH" ]]; then
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ ! -f "$IGNORE_FILE" ]]; then
  echo "ERROR: ${IGNORE_FILE} not found in working tree."
  exit 1
fi
cp "$IGNORE_FILE" "$TMP_IGNORE_FILE"

echo "[1/4] checkout target branch: ${TARGET_BRANCH}"
git checkout "$TARGET_BRANCH" >/dev/null

echo "[2/4] fast-forward merge: ${SOURCE_BRANCH} -> ${TARGET_BRANCH}"
git merge --ff-only "$SOURCE_BRANCH"

echo "[3/4] remove tracked files matched by ${IGNORE_FILE}"
mapfile -d '' MATCHED_PATHS < <(git ls-files -z -ci --exclude-from="$TMP_IGNORE_FILE")

if [[ "${#MATCHED_PATHS[@]}" -eq 0 ]]; then
  echo "No tracked files matched ${IGNORE_FILE}."
  exit 0
fi

echo "Matched tracked files (${#MATCHED_PATHS[@]}):"
for p in "${MATCHED_PATHS[@]}"; do
  [[ -n "$p" ]] && echo "  - $p"
done

if [[ "$MODE" != "apply" ]]; then
  echo "PREVIEW ONLY: no files removed."
  echo "Run with apply mode to execute removal:"
  echo "  bash fast-deploy/sync-publish-branch.sh ${SOURCE_BRANCH} ${TARGET_BRANCH} apply"
  exit 0
fi

for p in "${MATCHED_PATHS[@]}"; do
  if [[ -n "$p" ]]; then
    git rm -r --ignore-unmatch -- "$p" >/dev/null
  fi
done

echo "[4/4] commit filtered publish snapshot (if changed)"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git commit -m "chore(release): sync ${TARGET_BRANCH} from ${SOURCE_BRANCH} by .gitignore policy"
  echo "DONE: committed filtered publish snapshot on ${TARGET_BRANCH}"
else
  echo "DONE: nothing to commit."
fi

echo "Tip: push target branch manually if needed:"
echo "  git push origin ${TARGET_BRANCH}"
