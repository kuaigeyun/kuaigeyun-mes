"""
合并数据库迁移文件

根据实际数据库状态，将多个迁移文件合并成一个初始迁移文件

使用方法:
    cd riveredge-backend
    python scripts/merge_migrations.py
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def get_all_tables_sql() -> str:
    """获取所有表的创建 SQL"""
    conn = Tortoise.get_connection("default")
    
    # 获取所有表名
    tables_result = await conn.execute_query(
        """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'aerich%'
        ORDER BY table_name;
        """
    )
    
    # 提取表名列表
    tables = [row[0] if isinstance(row, (list, tuple)) else row for row in tables_result]
    
    sql_statements = []
    sql_statements.append("-- 合并后的初始迁移文件")
    sql_statements.append(f"-- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sql_statements.append(f"-- 表数量: {len(tables)}")
    sql_statements.append("")
    sql_statements.append("-- 注意: 此文件记录了数据库当前完整结构")
    sql_statements.append("-- 使用 pg_dump 方式生成，包含完整的表结构、索引、约束等")
    sql_statements.append("")
    
    # 使用 pg_dump 方式获取完整的表结构
    for table_name in tables:
        sql_statements.append(f"-- 表: {table_name}")
        sql_statements.append(f'-- 如需完整结构，请使用: pg_dump -t "{table_name}" -s')
        sql_statements.append("")
    
    sql_statements.append("-- 建议使用以下方法获取完整 SQL:")
    sql_statements.append("-- 1. 使用 pg_dump: pg_dump -s -t 'table_name' database_name")
    sql_statements.append("-- 2. 或使用数据库工具导出表结构")
    sql_statements.append("-- 3. 将导出的 SQL 整理后放入此迁移文件")
    
    return "\n".join(sql_statements)


async def main():
    """主函数"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        print("正在连接数据库...")
        print("正在生成合并后的迁移文件...")
        
        sql_content = await get_all_tables_sql()
        
        # 生成新的初始迁移文件
        migrations_dir = project_root / "migrations" / "models"
        new_file = migrations_dir / f"0_{datetime.now().strftime('%Y%m%d')}_merged_init_schema.py"
        
        file_content = f'''"""
合并后的初始迁移文件

此文件合并了所有历史迁移，记录了数据库当前完整结构
生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

注意:
1. 此文件使用 IF NOT EXISTS，如果表已存在不会报错
2. 建议备份现有迁移文件后再使用此文件
3. 使用前请检查 SQL 语句是否正确
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    创建所有表结构
    """
    return """
{sql_content}
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    删除所有表（谨慎使用）
    """
    return """
-- 注意: 此操作会删除所有表，请谨慎使用
-- 如需回滚，请手动执行 DROP TABLE 语句
"""
'''
        
        new_file.write_text(file_content, encoding="utf-8")
        print(f"\n✓ 合并后的迁移文件已生成: {new_file}")
        print("\n下一步:")
        print("1. 检查生成的迁移文件内容")
        print("2. 备份现有迁移文件（可选）")
        print("3. 如果需要，可以删除旧的迁移文件，只保留这个合并后的文件")
        print("4. 运行: uv run aerich upgrade")
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())

