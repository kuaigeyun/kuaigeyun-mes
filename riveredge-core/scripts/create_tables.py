"""
直接创建数据库表结构
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.database import TORTOISE_ORM
from tortoise import Tortoise


async def create_tables():
    """直接生成数据库表结构"""
    try:
        # 初始化数据库连接
        print("正在初始化数据库连接...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("✓ 数据库连接成功")
        
        # 生成表结构
        print("正在生成数据库表结构...")
        await Tortoise.generate_schemas()
        print("✓ 数据库表结构生成成功")
        
        # 验证表是否存在
        from models.user import User
        from models.tenant import Tenant
        
        try:
            user_count = await User.all().count()
            print(f"✓ core_users 表存在，当前用户数: {user_count}")
        except Exception as e:
            print(f"✗ core_users 表查询失败: {e}")
        
        try:
            tenant_count = await Tenant.all().count()
            print(f"✓ core_tenants 表存在，当前组织数: {tenant_count}")
        except Exception as e:
            print(f"✗ core_tenants 表查询失败: {e}")
        
        # 关闭连接
        await Tortoise.close_connections()
        print("✓ 数据库连接已关闭")
        
    except Exception as e:
        print(f"✗ 操作失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(create_tables())

