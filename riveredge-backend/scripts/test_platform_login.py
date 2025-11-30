"""
测试平台超级管理员登录功能
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
from soil.services.platform_superadmin_auth_service import PlatformSuperAdminAuthService
from soil.schemas.platform_superadmin import PlatformSuperAdminLoginRequest


async def test_login():
    """
    测试登录功能
    """
    try:
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ Tortoise ORM 初始化成功")
        
        # 检查平台超级管理员是否存在
        admin = await PlatformSuperAdmin.get_or_none(username='platform_admin')
        if not admin:
            print("❌ 平台超级管理员不存在")
            await Tortoise.close_connections()
            return
        
        print(f"✅ 找到平台超级管理员: {admin.username} (ID: {admin.id})")
        print(f"   邮箱: {admin.email}")
        print(f"   全名: {admin.full_name}")
        print(f"   是否激活: {admin.is_active}")
        
        # 测试密码验证
        password = "easthigh@1987"
        print(f"\n测试密码验证: {password}")
        is_valid = admin.verify_password(password)
        print(f"密码验证结果: {is_valid}")
        
        if not is_valid:
            print("❌ 密码验证失败")
            await Tortoise.close_connections()
            return
        
        # 测试登录服务
        print("\n测试登录服务...")
        service = PlatformSuperAdminAuthService()
        login_request = PlatformSuperAdminLoginRequest(
            username="platform_admin",
            password="easthigh@1987"
        )
        
        result = await service.login(login_request)
        print("✅ 登录成功！")
        print(f"   Token: {result.get('access_token', '')[:50]}...")
        print(f"   Token 类型: {result.get('token_type')}")
        print(f"   过期时间: {result.get('expires_in')} 秒")
        print(f"   用户信息: {result.get('user', {}).get('username')}")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(test_login())

