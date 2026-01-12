"""
执行物料类型字段可空迁移脚本

将 apps_master_data_materials 表的 material_type 字段改为可空（NULL）。

使用方法：
1. 确保已设置数据库连接（通过 .env 文件）
2. 运行：uv run python migrations/execute_material_type_nullable_migration.py

Author: Luigi Lu
Date: 2026-01-16
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库连接配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "riveredge")


async def execute_migration():
    """执行迁移"""
    print(f"\n连接数据库: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        print("数据库连接成功\n")
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return
    
    try:
        # 开始事务
        async with conn.transaction():
            print("开始执行迁移...")
            
            # 执行 SQL
            sql = """
            ALTER TABLE apps_master_data_materials 
            ALTER COLUMN material_type DROP NOT NULL;
            """
            
            print("执行 SQL: ALTER TABLE apps_master_data_materials ALTER COLUMN material_type DROP NOT NULL;")
            await conn.execute(sql)
            print("  ✓ 成功")
            
            print("\n迁移执行完成！")
            
            # 验证表结构
            print("\n验证表结构...")
            
            # 检查 material_type 字段的约束
            column_info = await conn.fetchrow("""
                SELECT 
                    column_name, 
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_materials' 
                AND column_name = 'material_type'
            """)
            
            if column_info:
                print(f"  ✓ material_type 字段存在")
                print(f"  - 数据类型: {column_info['data_type']}")
                print(f"  - 是否可空: {column_info['is_nullable']}")
                if column_info['is_nullable'] == 'YES':
                    print("  ✅ material_type 字段已成功改为可空")
                else:
                    print("  ⚠ material_type 字段仍然不可空，可能需要检查")
            else:
                print("  ✗ material_type 字段不存在")
            
    except Exception as e:
        print(f"\n迁移执行失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(execute_migration())
