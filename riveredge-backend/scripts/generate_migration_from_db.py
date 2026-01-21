"""
从实际数据库结构生成 Aerich 迁移文件

用途：当生产环境使用 SQL 直接修改数据库后，根据实际数据库结构生成迁移文件

使用方法：
    cd riveredge-backend
    export PATH="/c/Users/Kuaige/AppData/Local/Programs/Python/Python312:/c/Users/Kuaige/AppData/Local/Programs/Python/Python312/Scripts:$PATH"
    python scripts/generate_migration_from_db.py --name sync_from_production_db

注意：
1. 此脚本会读取数据库当前结构
2. 生成一个迁移文件记录当前状态
3. 如果数据库结构与模型不一致，需要先更新模型文件，然后使用 aerich migrate 生成差异迁移
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Optional

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def get_db_tables() -> Set[str]:
    """获取数据库中的所有表名"""
    conn = Tortoise.get_connection("default")
    tables = await conn.execute_query(
        """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'aerich%'
        ORDER BY table_name;
        """
    )
    return {row[0] for row in tables}


async def get_table_columns(table_name: str) -> List[Dict]:
    """获取表的所有列信息"""
    conn = Tortoise.get_connection("default")
    columns = await conn.execute_query(
        """
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
        """,
        [table_name]
    )
    return [
        {
            "name": col[0],
            "type": col[1],
            "max_length": col[2],
            "nullable": col[3] == "YES",
            "default": col[4]
        }
        for col in columns
    ]


async def get_table_indexes(table_name: str) -> List[Dict]:
    """获取表的所有索引信息"""
    conn = Tortoise.get_connection("default")
    indexes = await conn.execute_query(
        """
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' 
        AND tablename = $1
        AND indexname NOT LIKE '%_pkey'
        ORDER BY indexname;
        """,
        [table_name]
    )
    return [
        {
            "name": idx[0],
            "definition": idx[1]
        }
        for idx in indexes
    ]


async def get_table_constraints(table_name: str) -> List[Dict]:
    """获取表的所有约束信息"""
    conn = Tortoise.get_connection("default")
    constraints = await conn.execute_query(
        """
        SELECT 
            constraint_name,
            constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY constraint_name;
        """,
        [table_name]
    )
    return [
        {
            "name": con[0],
            "type": con[1]
        }
        for con in constraints
    ]


def generate_migration_content(
    db_tables: Set[str],
    table_info: Dict[str, Dict]
) -> str:
    """生成迁移文件内容"""
    
    sql_statements = []
    sql_statements.append("-- 从生产数据库同步结构生成的迁移文件")
    sql_statements.append("-- 注意：此文件记录了数据库当前状态，用于同步迁移历史")
    sql_statements.append("")
    
    # 按表名排序
    for table_name in sorted(db_tables):
        info = table_info[table_name]
        sql_statements.append(f"-- 表: {table_name}")
        sql_statements.append(f"-- 列数: {len(info['columns'])}")
        sql_statements.append(f"-- 索引数: {len(info['indexes'])}")
        sql_statements.append("")
    
    sql_statements.append("-- 此迁移文件仅用于记录数据库当前状态")
    sql_statements.append("-- 如果数据库结构已与模型一致，此迁移将不会执行任何操作")
    
    return "\n".join(sql_statements)


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="从数据库结构生成迁移文件")
    parser.add_argument(
        "--name",
        required=True,
        help="迁移文件名称（例如: sync_from_production_db）"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅显示信息，不生成文件"
    )
    
    args = parser.parse_args()
    
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        print("正在连接数据库...")
        
        # 获取数据库表
        print("正在获取数据库表列表...")
        db_tables = await get_db_tables()
        print(f"找到 {len(db_tables)} 个表")
        
        # 获取每个表的详细信息
        print("正在获取表结构信息...")
        table_info = {}
        for table_name in db_tables:
            print(f"  处理表: {table_name}")
            columns = await get_table_columns(table_name)
            indexes = await get_table_indexes(table_name)
            constraints = await get_table_constraints(table_name)
            
            table_info[table_name] = {
                "columns": columns,
                "indexes": indexes,
                "constraints": constraints
            }
        
        # 生成迁移文件内容
        migration_content = generate_migration_content(db_tables, table_info)
        
        if args.dry_run:
            print("\n=== 迁移文件内容预览 ===")
            print(migration_content)
            print("\n=== 预览结束 ===")
            return
        
        # 确定下一个迁移文件序号
        migrations_dir = project_root / "migrations" / "models"
        existing_files = sorted(migrations_dir.glob("*.py"))
        if existing_files:
            # 从最后一个文件名提取序号
            last_file = existing_files[-1]
            last_num = int(last_file.name.split("_")[0])
            next_num = last_num + 1
        else:
            next_num = 0
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{next_num}_{timestamp}_{args.name}.py"
        filepath = migrations_dir / filename
        
        # 生成完整的迁移文件
        full_content = f'''"""
从生产数据库同步结构生成的迁移文件

生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
数据库表数: {len(db_tables)}

注意：
1. 此迁移文件用于记录数据库当前状态
2. 如果数据库结构已与模型一致，此迁移不会执行任何操作
3. 如果数据库结构与模型不一致，需要先更新模型文件，然后重新生成迁移
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    从生产数据库同步结构
    
    注意：此迁移仅用于记录数据库当前状态
    如果数据库结构已与模型一致，此函数将返回空字符串
    """
    return """
{migration_content}
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚操作（通常不需要）
    """
    return """
-- 此迁移仅用于记录状态，无需回滚操作
"""
'''
        
        # 写入文件
        filepath.write_text(full_content, encoding="utf-8")
        print(f"\n✓ 迁移文件已生成: {filepath}")
        print(f"  文件序号: {next_num}")
        print(f"  表数量: {len(db_tables)}")
        print("\n下一步:")
        print("1. 检查生成的迁移文件")
        print("2. 如果数据库结构与模型不一致，需要:")
        print("   - 更新模型文件使其与数据库一致")
        print("   - 或创建新的迁移文件记录差异")
        print("3. 运行: uv run aerich upgrade")
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())

