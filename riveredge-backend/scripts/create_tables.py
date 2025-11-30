"""
创建数据库表脚本

使用 Tortoise ORM 直接生成数据库表结构
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.infrastructure.database.database import TORTOISE_ORM


async def create_tables():
    """
    创建数据库表
    
    使用 Tortoise ORM 的 generate_schemas 方法生成表结构
    """
    try:
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        print("数据库连接成功")
        
        # 生成数据库表结构
        print("正在生成数据库表结构...")
        await Tortoise.generate_schemas()
        
        print("✅ 数据库表创建成功！")
        
        await Tortoise.close_connections()
        
    except Exception as e:
        print(f"❌ 创建数据库表失败: {e}")
        import traceback
        traceback.print_exc()
        try:
            await Tortoise.close_connections()
        except:
            pass
        return


if __name__ == "__main__":
    asyncio.run(create_tables())

