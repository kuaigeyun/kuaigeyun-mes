"""
检查数据库初始化状态
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.database import TORTOISE_ORM
from tortoise import Tortoise


async def check_database():
    """检查数据库表是否存在"""
    try:
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        print("✓ 数据库连接成功")
        
        # 检查用户表
        from models.user import User
        try:
            count = await User.all().count()
            print(f"✓ core_users 表存在，当前用户数: {count}")
        except Exception as e:
            print(f"✗ core_users 表不存在或查询失败: {e}")
        
        # 检查组织表
        from models.tenant import Tenant
        try:
            count = await Tenant.all().count()
            print(f"✓ core_tenants 表存在，当前组织数: {count}")
        except Exception as e:
            print(f"✗ core_tenants 表不存在或查询失败: {e}")
        
        # 关闭连接
        await Tortoise.close_connections()
        print("✓ 数据库连接已关闭")
        
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(check_database())

