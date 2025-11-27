#!/bin/bash
# RiverEdge 项目备份脚本
# 使用 Git Bash 执行，避免 PowerShell 编码问题

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}RiverEdge 项目备份脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 获取当前时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_BRANCH="backup/${TIMESTAMP}-develop-state"
BACKUP_DIR="../riveredge_backup_${TIMESTAMP}"

echo -e "${YELLOW}当前时间: ${TIMESTAMP}${NC}"
echo -e "${YELLOW}备份分支: ${BACKUP_BRANCH}${NC}"
echo ""

# 1. 检查 Git 状态
echo -e "${GREEN}[1/5] 检查 Git 状态...${NC}"
git status --short

# 2. 暂存所有更改
echo -e "${GREEN}[2/5] 暂存所有更改...${NC}"
git add -A

# 3. 创建备份提交
echo -e "${GREEN}[3/5] 创建备份提交...${NC}"
git commit -m "backup: 项目备份 - ${TIMESTAMP}

备份内容：
- 技术选型文档更新
- 命名哲学文档更新
- 前端组件更新
- 评估文档新增

备份时间: $(date '+%Y-%m-%d %H:%M:%S')" || echo "没有需要提交的更改"

# 4. 创建备份分支
echo -e "${GREEN}[4/5] 创建备份分支: ${BACKUP_BRANCH}...${NC}"
git branch "${BACKUP_BRANCH}" || echo "备份分支已存在"

# 5. 创建压缩备份（可选）
echo -e "${GREEN}[5/5] 创建压缩备份...${NC}"
cd ..
if [ -d "riveredge" ]; then
    echo "正在创建压缩备份..."
    tar -czf "riveredge_backup_${TIMESTAMP}.tar.gz" \
        --exclude='riveredge/node_modules' \
        --exclude='riveredge/venv311' \
        --exclude='riveredge/.git' \
        --exclude='riveredge/logs/*.log' \
        --exclude='riveredge/logs/*.pid' \
        --exclude='riveredge/**/__pycache__' \
        --exclude='riveredge/**/*.pyc' \
        --exclude='riveredge/riveredge-shell/dist' \
        --exclude='riveredge/riveredge-core/src/logs/*.log' \
        riveredge/
    
    if [ -f "riveredge_backup_${TIMESTAMP}.tar.gz" ]; then
        BACKUP_SIZE=$(du -h "riveredge_backup_${TIMESTAMP}.tar.gz" | cut -f1)
        echo -e "${GREEN}✓ 压缩备份创建成功: riveredge_backup_${TIMESTAMP}.tar.gz (${BACKUP_SIZE})${NC}"
    else
        echo -e "${YELLOW}⚠ 压缩备份创建失败（可能缺少 tar 命令）${NC}"
    fi
    cd riveredge
else
    echo -e "${YELLOW}⚠ 无法创建压缩备份（项目目录不存在）${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}备份完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "备份分支: ${BACKUP_BRANCH}"
echo -e "备份时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${YELLOW}查看备份分支:${NC}"
echo -e "  git branch -a | grep backup"
echo ""
echo -e "${YELLOW}切换到备份分支:${NC}"
echo -e "  git checkout ${BACKUP_BRANCH}"
echo ""
echo -e "${YELLOW}查看备份提交:${NC}"
echo -e "  git log --oneline -1"

