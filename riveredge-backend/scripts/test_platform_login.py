"""
测试平台超级管理员登录

用于测试平台超级管理员登录功能，验证密码是否正确。
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


async def test_login():
    """
    测试平台超级管理员登录
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    # 获取平台超级管理员
    admin = await PlatformSuperAdmin.get_or_none(username='platform_admin')
    
    if not admin:
        print("❌ 平台超级管理员不存在")
        await Tortoise.close_connections()
        return
    
    print("=" * 60)
    print("平台超级管理员信息")
    print("=" * 60)
    print(f"ID: {admin.id}")
    print(f"用户名: {admin.username}")
    print(f"邮箱: {admin.email}")
    print(f"是否激活: {admin.is_active}")
    print(f"密码哈希: {admin.password_hash[:20]}...")
    print("=" * 60)
    
    # 从配置读取密码
    password = platform_settings.PLATFORM_SUPERADMIN_PASSWORD
    print(f"\n配置中的密码: {password if password else '(未设置)'}")
    
    # 测试密码验证
    if password:
        is_valid = admin.verify_password(password)
        print(f"密码验证结果: {'✅ 正确' if is_valid else '❌ 错误'}")
    else:
        print("⚠️  无法测试：密码未在配置中设置")
    
    # 测试常见密码
    test_passwords = ['admin', 'password', '123456', 'platform_admin']
    print("\n测试常见密码:")
    for test_pwd in test_passwords:
        is_valid = admin.verify_password(test_pwd)
        status = "✅" if is_valid else "❌"
        print(f"  {status} {test_pwd}")
    
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(test_login())
