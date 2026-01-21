"""
修复销售出库单表缺失字段的脚本

自动执行 SQL 迁移，添加缺失的字段。

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
backend_path = Path(__file__).parent.parent
src_path = backend_path / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from core.config.settings import settings


async def run_migration():
    """执行数据库迁移"""
    # 初始化 Tortoise ORM
    await Tortoise.init(
        db_url=settings.DATABASE_URL,
        modules={
            "models": [
                "apps.kuaizhizao.models.sales_delivery",
                "apps.kuaizhizao.models.sales_delivery_item",
            ]
        }
    )
    
    # 读取 SQL 脚本
    sql_file = backend_path / "fix_sales_delivery_demand_id.sql"
    if not sql_file.exists():
        print(f"❌ SQL 文件不存在: {sql_file}")
        return False
    
    with open(sql_file, "r", encoding="utf-8") as f:
        sql = f.read()
    
    # 执行 SQL
    try:
        conn = Tortoise.get_connection("default")
        # 分割 SQL 语句（按分号分割，但保留 DO $$ ... END $$ 块）
        statements = []
        current_statement = ""
        in_block = False
        
        for line in sql.split('\n'):
            line = line.strip()
            if not line or line.startswith('--'):
                continue
            
            current_statement += line + '\n'
            
            if 'DO $$' in line:
                in_block = True
            elif in_block and 'END $$;' in line:
                in_block = False
                statements.append(current_statement)
                current_statement = ""
            elif not in_block and line.endswith(';'):
                statements.append(current_statement)
                current_statement = ""
        
        # 执行每个 SQL 语句
        for i, statement in enumerate(statements, 1):
            if statement.strip():
                try:
                    await conn.execute_query(statement)
                    print(f"✅ 执行 SQL 语句 {i}/{len(statements)}")
                except Exception as e:
                    print(f"⚠️  SQL 语句 {i} 执行失败（可能已存在）: {e}")
        
        print("✅ 数据库迁移完成！")
        return True
        
    except Exception as e:
        print(f"❌ 执行迁移时发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await Tortoise.close_connections()


async def main():
    """主函数"""
    print("=" * 80)
    print("修复销售出库单表缺失字段")
    print("=" * 80)
    print()
    
    success = await run_migration()
    
    if success:
        print()
        print("✅ 迁移成功！请重启后端服务。")
        return 0
    else:
        print()
        print("❌ 迁移失败！请检查错误信息。")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
