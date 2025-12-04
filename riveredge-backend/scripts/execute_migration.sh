#!/bin/bash
# 执行数据库表重命名迁移
# 使用 psql 直接执行 SQL 文件

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认配置
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-riveredge}"

# 解析参数
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --host)
            DB_HOST="$2"
            shift 2
            ;;
        --port)
            DB_PORT="$2"
            shift 2
            ;;
        --user)
            DB_USER="$2"
            shift 2
            ;;
        --database)
            DB_NAME="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            exit 1
            ;;
    esac
done

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SQL_FILE="$PROJECT_ROOT/migrations/rename_tables_to_new_naming.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ SQL 文件不存在: $SQL_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}🔄 数据库表重命名迁移${NC}"
echo -e "${BLUE}============================================================${NC}"
echo "数据库: $DB_NAME@$DB_HOST:$DB_PORT"
echo "用户: $DB_USER"
echo "SQL 文件: $SQL_FILE"
echo "模式: $([ "$DRY_RUN" = true ] && echo "预览模式（dry-run）" || echo "实际执行")"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}🔍 [预览] SQL 文件内容:${NC}"
    head -50 "$SQL_FILE"
    echo ""
    echo -e "${YELLOW}⚠️  这是预览模式，未实际执行${NC}"
else
    # 提示输入密码
    echo -e "${YELLOW}⚠️  即将执行数据库迁移，请确认已备份数据库！${NC}"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi
    
    # 执行 SQL
    echo -e "${BLUE}🔄 执行迁移...${NC}"
    if PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"; then
        echo ""
        echo -e "${GREEN}✅ 迁移执行成功！${NC}"
        
        # 验证表名
        echo -e "${BLUE}🔍 验证新表名...${NC}"
        PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT COUNT(*) as new_table_count
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND (table_name LIKE 'platform_%' OR table_name LIKE 'core_%');
        " -t
        
        echo -e "${BLUE}🔍 检查旧表名...${NC}"
        OLD_COUNT=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND (table_name LIKE 'soil_%' OR table_name LIKE 'root_%' OR table_name LIKE 'sys_%' OR table_name LIKE 'tree_%');
        " -t | tr -d ' ')
        
        if [ "$OLD_COUNT" -eq 0 ]; then
            echo -e "${GREEN}✅ 所有旧表名已成功重命名${NC}"
        else
            echo -e "${YELLOW}⚠️  仍有 $OLD_COUNT 个旧表名存在${NC}"
        fi
    else
        echo -e "${RED}❌ 迁移执行失败${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}============================================================${NC}"

