"""
执行 description 字段迁移

直接执行 50_20260120000006_add_description_to_cost_rules.py 中的 SQL 语句。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

import asyncio
import asyncpg
import os
import re
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
    # 读取迁移文件
    migration_file = Path(__file__).parent / "models" / "50_20260120000006_add_description_to_cost_rules.py"
    
    if not migration_file.exists():
        print(f"❌ 错误：迁移文件不存在: {migration_file}")
        return
    
    print(f"📄 读取迁移文件: {migration_file}")
    
    # 读取文件内容
    with open(migration_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取upgrade函数的SQL
    match = re.search(r'async def upgrade.*?return """(.*?)"""', content, re.DOTALL)
    if not match:
        print("❌ 错误：无法提取upgrade SQL")
        return
    
    sql_content = match.group(1).strip()
    
    print(f"📊 连接到数据库: {DB_NAME}@{DB_HOST}:{DB_PORT}")
    
    # 连接数据库
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        print(f"✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return
    
    try:
        # 执行 SQL
        print(f"\n📝 执行迁移 SQL...")
        print(f"SQL:\n{sql_content}\n")
        
        await conn.execute(sql_content)
        
        print("✅ 迁移执行成功！")
        
        # 验证字段是否已添加
        print("\n🔍 验证字段是否已添加...")
        field_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'description'
            )
        """)
        
        if field_exists:
            print("✅ 字段 description 已成功添加到表中")
        else:
            print("⚠️  警告：字段可能未成功添加，请检查")
        
    except Exception as e:
        print(f"❌ 执行迁移失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n🔌 数据库连接已关闭")


if __name__ == '__main__':
    asyncio.run(execute_migration())
