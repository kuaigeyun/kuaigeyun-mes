#!/bin/bash
# RiverEdge SaaS - 基于当前数据库状态初始化迁移文件
#
# 此脚本用于：
# 1. 备份现有迁移文件
# 2. 基于当前数据库状态（public.sql）重新初始化 Aerich 迁移
# 3. 创建初始迁移文件，反映当前数据库结构
#
# 使用方法：
#   ./migrations/init_from_current_db.sh

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}基于当前数据库状态初始化迁移文件${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 检查必要文件
echo "1. 检查必要文件..."
if [ ! -f "migrations/models/public.sql" ]; then
    echo -e "${RED}❌ 错误: migrations/models/public.sql 不存在${NC}"
    echo "   请先导出当前数据库结构到 public.sql"
    exit 1
fi
echo -e "${GREEN}✅ public.sql 文件存在${NC}"
echo ""

# 2. 备份现有迁移文件
echo "2. 备份现有迁移文件..."
BACKUP_DIR="migrations/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -d "migrations/models" ] && [ "$(ls -A migrations/models/*.py 2>/dev/null | grep -v public.sql | wc -l)" -gt 0 ]; then
    cp -r migrations/models/*.py "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✅ 已备份到: $BACKUP_DIR${NC}"
else
    echo -e "${YELLOW}⚠️  没有现有迁移文件需要备份${NC}"
fi
echo ""

# 3. 检查 Aerich 配置
echo "3. 检查 Aerich 配置..."
if [ ! -f "migrations/aerich_config.py" ]; then
    echo -e "${RED}❌ 错误: migrations/aerich_config.py 不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Aerich 配置存在${NC}"
echo ""

# 4. 检查数据库连接
echo "4. 检查数据库连接..."
if ! python -c "import sys; sys.path.insert(0, 'src'); from core.settings import settings; print(settings.DB_NAME)" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  无法读取数据库配置，请确保环境变量已设置${NC}"
    echo "   继续执行，但后续步骤可能需要手动配置数据库连接"
fi
echo ""

# 5. 清理现有迁移文件（保留 public.sql）
echo "5. 清理现有迁移文件..."
find migrations/models -name "*.py" -type f ! -name "__init__.py" -delete 2>/dev/null || true
echo -e "${GREEN}✅ 已清理现有迁移文件${NC}"
echo ""

# 6. 初始化 Aerich（如果尚未初始化）
echo "6. 初始化 Aerich..."
if [ ! -f "pyproject.toml" ] || ! grep -q "\[tool.aerich\]" pyproject.toml; then
    echo -e "${YELLOW}⚠️  pyproject.toml 中缺少 [tool.aerich] 配置${NC}"
    echo "   请手动添加以下配置："
    echo ""
    echo "   [tool.aerich]"
    echo "   tortoise_orm = \"migrations.aerich_config.TORTOISE_ORM\""
    echo "   location = \"./migrations\""
    echo "   src_folder = \"./src\""
    echo ""
fi

# 7. 生成初始迁移文件
echo "7. 生成初始迁移文件..."
echo -e "${YELLOW}⚠️  重要提示：${NC}"
echo "   由于 Aerich 需要连接到数据库来生成迁移文件，"
echo "   请按以下步骤操作："
echo ""
echo "   1. 确保数据库服务正在运行"
echo "   2. 确保数据库连接配置正确（.env 文件）"
echo "   3. 运行以下命令："
echo ""
echo "      cd riveredge-backend"
echo "      uv run aerich init-db"
echo ""
echo "   这将基于当前模型定义创建初始迁移文件"
echo ""
echo "   4. 如果数据库已存在表结构（如 public.sql），可以："
echo "      a) 先导入 public.sql 到数据库"
echo "      b) 然后运行: uv run aerich migrate --name init_from_current_db"
echo "      c) 这将生成一个空迁移，标记当前状态为已迁移"
echo ""

# 8. 提供后续步骤说明
echo "8. 后续步骤..."
echo -e "${GREEN}✅ 初始化准备完成！${NC}"
echo ""
echo "下一步操作："
echo "  1. 如果数据库是空的："
echo "     uv run aerich init-db"
echo ""
echo "  2. 如果数据库已有表结构（public.sql）："
echo "     a) 导入 public.sql 到数据库（如果尚未导入）"
echo "     b) 运行: uv run aerich migrate --name init_from_current_db"
echo "     c) 这将创建一个空迁移，标记当前状态"
echo ""
echo "  3. 验证迁移："
echo "     uv run aerich history"
echo "     uv run aerich heads"
echo ""
echo -e "${GREEN}备份目录: $BACKUP_DIR${NC}"

