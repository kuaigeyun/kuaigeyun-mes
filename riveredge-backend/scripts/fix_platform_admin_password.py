"""
修复平台超级管理员密码

重新设置密码哈希值
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
from soil.config.platform_config import platform_settings
from soil.core.security.security import hash_password


async def fix_password():
    """
    修复平台超级管理员密码
    """
    try:
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ Tortoise ORM 初始化成功")
        
        # 获取平台超级管理员
        admin = await PlatformSuperAdmin.get_or_none(username='platform_admin')
        if not admin:
            print("❌ 平台超级管理员不存在")
            await Tortoise.close_connections()
            return
        
        print(f"✅ 找到平台超级管理员: {admin.username} (ID: {admin.id})")
        print(f"   当前密码哈希值: {admin.password_hash[:50]}...")
        
        # 从配置中读取密码
        password = platform_settings.PLATFORM_SUPERADMIN_PASSWORD
        if not password:
            print("❌ 密码未在 .env 文件中设置")
            await Tortoise.close_connections()
            return
        
        print(f"   新密码: {password}")
        
        # 重新生成密码哈希值
        new_password_hash = hash_password(password)
        print(f"   新密码哈希值: {new_password_hash[:50]}...")
        
        # 更新密码
        admin.password_hash = new_password_hash
        await admin.save()
        
        print("✅ 密码已更新")
        
        # 验证新密码
        is_valid = admin.verify_password(password)
        print(f"   密码验证: {'✅ 成功' if is_valid else '❌ 失败'}")
        
    except Exception as e:
        print(f"❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(fix_password())

