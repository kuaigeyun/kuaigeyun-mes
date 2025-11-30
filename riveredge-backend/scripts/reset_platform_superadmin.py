"""
重置平台超级管理员脚本

删除现有的平台超级管理员，然后使用 .env 配置重新创建
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.models.platform_superadmin import PlatformSuperAdmin
from soil.core.security.security import hash_password
from soil.infrastructure.database.database import TORTOISE_ORM
from soil.config.platform_config import platform_settings


async def reset_platform_superadmin():
    """
    重置平台超级管理员
    
    删除现有的平台超级管理员，然后使用 .env 配置重新创建
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 删除所有现有的平台超级管理员
        deleted_count = await PlatformSuperAdmin.all().delete()
        if deleted_count > 0:
            print(f"✅ 已删除 {deleted_count} 个现有的平台超级管理员")
        else:
            print("ℹ️  没有现有的平台超级管理员需要删除")
        
        # 从配置中读取平台超级管理员信息
        username = platform_settings.PLATFORM_SUPERADMIN_USERNAME
        password = platform_settings.PLATFORM_SUPERADMIN_PASSWORD
        email = platform_settings.PLATFORM_SUPERADMIN_EMAIL
        full_name = platform_settings.PLATFORM_SUPERADMIN_FULL_NAME
        
        # 验证密码是否设置
        if not password:
            print("=" * 60)
            print("❌ 错误：平台超级管理员密码未设置！")
            print("=" * 60)
            print("请在 .env 文件中设置 PLATFORM_SUPERADMIN_PASSWORD")
            print("=" * 60)
            return
        
        # 创建平台超级管理员
        password_hash = hash_password(password)
        admin = await PlatformSuperAdmin.create(
            username=username,
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            is_active=True,
        )
        
        print("=" * 60)
        print("平台超级管理员创建成功！")
        print("=" * 60)
        print(f"用户名: {admin.username}")
        print(f"邮箱: {admin.email}")
        print(f"全名: {admin.full_name}")
        print("=" * 60)
        print("✅ 密码已从 .env 文件读取并设置")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(reset_platform_superadmin())

