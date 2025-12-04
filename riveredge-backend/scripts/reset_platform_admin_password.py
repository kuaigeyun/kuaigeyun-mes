"""
重置平台超级管理员密码

用于重置平台超级管理员的密码为 .env 文件中配置的密码。
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from platform.models.platform_superadmin import PlatformSuperAdmin
from platform.infrastructure.database.database import TORTOISE_ORM
from platform.config.platform_config import platform_settings
from platform.core.security.security import hash_password


async def reset_password():
    """
    重置密码
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    # 获取平台超级管理员
    admin = await PlatformSuperAdmin.get_or_none(username='platform_admin')
    
    if not admin:
        print("❌ 平台超级管理员不存在")
        await Tortoise.close_connections()
        return
    
    # 从配置读取密码
    password = platform_settings.PLATFORM_SUPERADMIN_PASSWORD
    
    if not password:
        print("❌ .env 文件中未设置 PLATFORM_SUPERADMIN_PASSWORD")
        await Tortoise.close_connections()
        return
    
    print("=" * 60)
    print("重置平台超级管理员密码")
    print("=" * 60)
    print(f"用户名: {admin.username}")
    print(f"配置中的密码长度: {len(password)}")
    print()
    
    # 更新密码
    admin.password_hash = hash_password(password)
    await admin.save()
    
    # 验证新密码
    is_valid = admin.verify_password(password)
    
    if is_valid:
        print("✅ 密码重置成功！")
        print(f"✅ 密码验证通过")
    else:
        print("❌ 密码重置后验证失败，请检查配置")
    
    print("=" * 60)
    
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(reset_password())

