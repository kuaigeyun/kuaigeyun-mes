"""
检查数据库表状态

查看数据库中已存在的表
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.infrastructure.database.database import TORTOISE_ORM


async def check_tables():
    """
    检查数据库表状态
    """
    try:
        print("=" * 60)
        print("检查数据库表状态")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 检查表是否存在
        from tortoise import connections
        conn = connections.get("default")
        
        # 查询所有表
        result = await conn.execute_query(
            """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
            """
        )
        
        tables = [row[0] for row in result[1]] if result[1] else []
        
        print(f"\n数据库中的表 ({len(tables)} 个):")
        for table in tables:
            print(f"  - {table}")
        
        # 检查关键表
        key_tables = [
            "sys_users",
            "sys_departments", 
            "sys_data_dictionaries",
            "sys_dictionary_items",
            "aerich"
        ]
        
        print(f"\n关键表状态:")
        for table in key_tables:
            exists = table in tables
            status = "✅ 存在" if exists else "❌ 不存在"
            print(f"  {table}: {status}")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_tables())

