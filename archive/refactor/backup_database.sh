#!/bin/bash
# 数据库备份脚本
# 用于备份MRP/LRP和销售预测/销售订单相关表

# 数据库配置（从环境变量或默认值读取）
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-riveredge}

# 备份文件路径
BACKUP_DIR="archive/refactor"
BACKUP_FILE="${BACKUP_DIR}/database_backup_$(date +%Y%m%d_%H%M%S).sql"

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

echo "=== 开始数据库备份 ==="
echo "数据库: ${DB_NAME}"
echo "主机: ${DB_HOST}:${DB_PORT}"
echo "用户: ${DB_USER}"
echo "备份文件: ${BACKUP_FILE}"
echo ""

# 检查pg_dump是否可用
if ! command -v pg_dump &> /dev/null; then
    echo "❌ 错误: pg_dump 命令未找到"
    echo "请确保已安装 PostgreSQL 客户端工具"
    echo ""
    echo "Windows 安装方法:"
    echo "  1. 下载 PostgreSQL: https://www.postgresql.org/download/windows/"
    echo "  2. 安装时选择包含命令行工具"
    echo "  3. 将 PostgreSQL bin 目录添加到 PATH 环境变量"
    exit 1
fi

# 需要备份的表
TABLES=(
    "apps_kuaizhizao_mrp_results"
    "apps_kuaizhizao_lrp_results"
    "apps_kuaizhizao_sales_forecasts"
    "apps_kuaizhizao_sales_orders"
)

# 检查表是否存在并备份
EXISTING_TABLES=()
for table in "${TABLES[@]}"; do
    # 检查表是否存在（使用psql命令）
    if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='${table}'" 2>/dev/null | grep -q 1; then
        EXISTING_TABLES+=("${table}")
        echo "✅ 表 ${table} 存在"
    else
        echo "⚠️  表 ${table} 不存在（可能尚未创建）"
    fi
done

if [ ${#EXISTING_TABLES[@]} -eq 0 ]; then
    echo ""
    echo "⚠️  警告: 没有找到需要备份的表"
    echo "可能原因:"
    echo "  1. 数据库尚未初始化"
    echo "  2. 表名不正确"
    echo "  3. 数据库连接失败"
    echo ""
    echo "创建空备份文件作为占位符..."
    echo "-- 数据库备份占位符" > "${BACKUP_FILE}"
    echo "-- 备份时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "${BACKUP_FILE}"
    echo "-- 说明: 未找到需要备份的表，可能数据库尚未初始化" >> "${BACKUP_FILE}"
    exit 0
fi

echo ""
echo "开始备份 ${#EXISTING_TABLES[@]} 个表..."

# 构建pg_dump命令
DUMP_CMD="pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}"

# 添加表参数
for table in "${EXISTING_TABLES[@]}"; do
    DUMP_CMD="${DUMP_CMD} -t ${table}"
done

# 添加其他选项
DUMP_CMD="${DUMP_CMD} --clean --if-exists --no-owner --no-acl"

# 执行备份
echo "执行备份命令..."
if ${DUMP_CMD} > "${BACKUP_FILE}" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo ""
    echo "✅ 数据库备份完成"
    echo "备份文件: ${BACKUP_FILE}"
    echo "备份大小: ${BACKUP_SIZE}"
    echo "备份表数: ${#EXISTING_TABLES[@]}"
    echo ""
    echo "备份的表:"
    for table in "${EXISTING_TABLES[@]}"; do
        echo "  - ${table}"
    done
else
    echo ""
    echo "❌ 数据库备份失败"
    echo "可能原因:"
    echo "  1. 数据库连接失败（请检查DB_HOST、DB_PORT、DB_USER、DB_PASSWORD）"
    echo "  2. 权限不足"
    echo "  3. 数据库不存在"
    echo ""
    echo "提示: 可以手动执行以下命令进行备份:"
    echo "${DUMP_CMD} > ${BACKUP_FILE}"
    exit 1
fi
