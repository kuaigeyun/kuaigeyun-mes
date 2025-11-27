"""
测试登录功能

直接测试登录API，查看具体错误信息
"""

import sys
import asyncio
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# Windows 环境下修复异步网络兼容性问题
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings
from core.database import TORTOISE_ORM
from tortoise import Tortoise
from models.user import User
from core.security import verify_password, create_token_for_user

async def test_login():
    """测试登录功能"""
    try:
        print("=" * 60)
        print("测试登录功能")
        print("=" * 60)
        
        # 初始化数据库连接（使用 Tortoise ORM 官方方法）
        print("1. 初始化数据库连接...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ 数据库连接已初始化")
        print()
        
        # 测试查询超级管理员
        print("2. 查询超级管理员用户...")
        username = "superadmin"
        user = await User.get_or_none(
            username=username,
            is_superuser=True,
            tenant_id__isnull=True
        )
        
        if user:
            print(f"   ✅ 找到用户: {user.username} (ID: {user.id})")
            print(f"   - 邮箱: {user.email}")
            print(f"   - 是否激活: {user.is_active}")
            print(f"   - 是否超级用户: {user.is_superuser}")
            print(f"   - 组织ID: {user.tenant_id}")
            print(f"   - 密码哈希: {user.password_hash[:30]}...")
        else:
            print("   ❌ 未找到超级管理员用户")
            print("   请运行: python scripts/init_users.py")
            return
        print()
        
        # 测试密码验证
        print("3. 测试密码验证...")
        test_passwords = ["SuperAdmin@2024", "wrong_password"]
        
        for test_password in test_passwords:
            try:
                password_valid = verify_password(test_password, user.password_hash)
                status = "✅ 正确" if password_valid else "❌ 错误"
                print(f"   密码 '{test_password}': {status}")
            except Exception as e:
                print(f"   ❌ 密码验证失败: {e}")
                import traceback
                traceback.print_exc()
        print()
        
        # 测试Token生成
        print("4. 测试Token生成...")
        try:
            access_token = create_token_for_user(
                user_id=user.id,
                username=user.username,
                tenant_id=user.tenant_id,
                is_superuser=user.is_superuser,
                is_tenant_admin=user.is_tenant_admin
            )
            print(f"   ✅ Token生成成功")
            print(f"   Token长度: {len(access_token)} 字符")
            print(f"   Token预览: {access_token[:50]}...")
        except Exception as e:
            print(f"   ❌ Token生成失败: {e}")
            import traceback
            traceback.print_exc()
        print()
        
        print("=" * 60)
        print("✅ 所有测试完成")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # 关闭数据库连接（使用 Tortoise ORM 官方方法）
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_login())

