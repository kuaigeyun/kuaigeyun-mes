"""
检查平台超级管理员密码

用于检查数据库中的密码哈希是用哪个密码生成的。
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.models.platform_superadmin import PlatformSuperAdmin
from soil.infrastructure.database.database import TORTOISE_ORM


async def check_password():
    """
    检查密码
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
    print("密码验证测试")
    print("=" * 60)
    print(f"数据库中的密码哈希: {admin.password_hash[:50]}...")
    print()
    
    # 从配置读取密码进行测试
    from soil.config.platform_config import platform_settings
    config_password = platform_settings.PLATFORM_SUPERADMIN_PASSWORD
    
    if config_password:
        print(f"\n测试 .env 配置中的密码 (长度: {len(config_password)}):")
        is_valid = admin.verify_password(config_password)
        status = "✅ 正确" if is_valid else "❌ 错误"
        print(f"{status}: {'*' * len(config_password)}")
    else:
        print("\n⚠️  .env 文件中未设置 PLATFORM_SUPERADMIN_PASSWORD")
    
    print("=" * 60)
    
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_password())

