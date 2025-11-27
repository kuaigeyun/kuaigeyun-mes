#!/bin/bash
# RiverEdge 项目重命名脚本
# 使用 Git Bash 执行，避免 PowerShell 编码问题

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}RiverEdge 项目重命名脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -d "riveredge-core" ] || [ ! -d "riveredge-shell" ]; then
    echo -e "${RED}错误: 请在项目根目录执行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  警告：此操作将重命名项目文件夹和数据库结构${NC}"
echo -e "${YELLOW}⚠️  请确保已创建备份！${NC}"
echo ""
read -p "是否继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo -e "${GREEN}[1/6] 检查 Git 状态...${NC}"
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}警告: 有未提交的更改，建议先提交${NC}"
    read -p "是否继续？(yes/no): " confirm2
    if [ "$confirm2" != "yes" ]; then
        exit 0
    fi
fi

echo -e "${GREEN}[2/6] 创建备份分支...${NC}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_BRANCH="backup/before-rename-${TIMESTAMP}"
git branch "${BACKUP_BRANCH}"
echo -e "${GREEN}✓ 备份分支创建成功: ${BACKUP_BRANCH}${NC}"

echo ""
echo -e "${GREEN}[3/6] 重命名文件夹...${NC}"

# 重命名 riveredge-seeds → riveredge-seed
if [ -d "riveredge-seeds" ]; then
    echo "重命名 riveredge-seeds → riveredge-seed"
    mv riveredge-seeds riveredge-seed
    echo -e "${GREEN}✓ riveredge-seeds → riveredge-seed${NC}"
fi

echo ""
echo -e "${YELLOW}[4/6] 文件夹拆分（需要手动操作）...${NC}"
echo -e "${YELLOW}注意：riveredge-core 和 riveredge-shell 需要手动拆分${NC}"
echo -e "${YELLOW}请参考重命名执行计划文档${NC}"

echo ""
echo -e "${GREEN}[5/6] 更新 Git 配置...${NC}"
# 更新 .gitignore 中的引用（如果有）
if grep -q "riveredge-seeds" .gitignore 2>/dev/null; then
    sed -i 's/riveredge-seeds/riveredge-seed/g' .gitignore
    echo -e "${GREEN}✓ 更新 .gitignore${NC}"
fi

echo ""
echo -e "${GREEN}[6/6] 提交更改...${NC}"
git add -A
git commit -m "refactor: 重命名项目文件夹 - seeds → seed

- riveredge-seeds → riveredge-seed (单数形式)
- 符合新命名哲学

备份分支: ${BACKUP_BRANCH}
重命名时间: $(date '+%Y-%m-%d %H:%M:%S')" || echo "没有需要提交的更改"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}文件夹重命名完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步：${NC}"
echo -e "1. 手动拆分 riveredge-core → riveredge-root + riveredge-core"
echo -e "2. 手动拆分 riveredge-shell → riveredge-stem + riveredge-shell"
echo -e "3. 执行数据库重命名脚本"
echo -e "4. 更新所有代码引用"
echo ""
echo -e "${YELLOW}查看备份分支:${NC}"
echo -e "  git branch -a | grep backup"

