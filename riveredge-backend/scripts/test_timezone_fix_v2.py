"""
时区配置修复验证脚本

测试修复后的Tortoise ORM时区配置
"""

import asyncio
import os
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量（必须在导入 Tortoise 之前）
from platform.config.platform_config import platform_settings, setup_tortoise_timezone_env

# 确保环境变量在导入 Tortoise 之前就已经设置
os.environ["USE_TZ"] = str(platform_settings.USE_TZ)
os.environ["TIMEZONE"] = platform_settings.TIMEZONE
setup_tortoise_timezone_env()

print(f"USE_TZ: {os.environ.get('USE_TZ')}")
print(f"TIMEZONE: {os.environ.get('TIMEZONE')}")
print(f"Platform settings - USE_TZ: {platform_settings.USE_TZ}")
print(f"Platform settings - TIMEZONE: {platform_settings.TIMEZONE}")

from tortoise import Tortoise
from tortoise import timezone as tortoise_timezone
from platform.infrastructure.database.database import TORTOISE_ORM

async def test_timezone_fix():
    """测试修复后的时区配置"""
    try:
        print("\n初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)

        print("检查 Tortoise 时区配置...")
        print(f"Tortoise use_tz: {tortoise_timezone.get_use_tz()}")
        print(f"Tortoise timezone: {tortoise_timezone.get_timezone()}")

        # 测试创建一个部门（使用Tortoise ORM）
        from core.models.department import Department
        print("\n创建测试部门...")

        department = await Department.create(
            tenant_id=1,
            name="时区测试部门",
            code="TZ_TEST",
            description="验证时区配置修复",
            sort_order=999,
            is_active=True
        )

        print(f"✅ 成功创建部门: {department.name} (ID: {department.id})")
        print(f"   创建时间: {department.created_at} (类型: {type(department.created_at)})")
        print(f"   更新时间: {department.updated_at} (类型: {type(department.updated_at)})")

        if department.created_at:
            print(f"   时区信息: {department.created_at.tzinfo}")
            print(f"   是否时区感知: {tortoise_timezone.is_aware(department.created_at)}")

        # 清理测试数据
        await department.delete()
        print("✅ 清理测试数据完成")

        # 测试原始初始化脚本的部分功能
        print("\n测试部门初始化（少量数据）...")
        from core.models.position import Position

        position = await Position.create(
            tenant_id=1,
            name="时区测试职位",
            code="TZ_POS",
            description="验证时区配置修复",
            sort_order=999,
            is_active=True
        )

        print(f"✅ 成功创建职位: {position.name} (ID: {position.id})")
        print(f"   创建时间: {position.created_at} (类型: {type(position.created_at)})")

        await position.delete()
        print("✅ 清理测试职位完成")

        print("\n" + "=" * 60)
        print("✅ 时区配置修复验证成功！")
        print("   Tortoise ORM现在可以正常处理时区感知的datetime对象")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(test_timezone_fix())
