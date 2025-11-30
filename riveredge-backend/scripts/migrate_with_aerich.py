"""
使用 Aerich 进行数据库迁移脚本

生成迁移文件并应用到数据库
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from aerich import Command
from soil.infrastructure.database.database import TORTOISE_ORM


async def migrate_with_aerich():
    """
    使用 Aerich 进行数据库迁移
    """
    try:
        # 创建 Command 实例
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        print("=" * 60)
        print("使用 Aerich 进行数据库迁移")
        print("=" * 60)
        
        # 初始化（如果需要）
        print("\n1. 初始化迁移目录...")
        try:
            await command.init()
            print("   ✅ 迁移目录初始化成功")
        except Exception as e:
            if "already exists" in str(e).lower() or "已存在" in str(e):
                print("   ℹ️  迁移目录已存在，跳过初始化")
            else:
                print(f"   ⚠️  初始化警告: {e}")
        
        # 初始化数据库（生成初始迁移）
        print("\n2. 初始化数据库迁移...")
        try:
            await command.init_db(safe=True)
            print("   ✅ 数据库迁移初始化成功")
        except Exception as e:
            if "already exists" in str(e).lower() or "已存在" in str(e):
                print("   ℹ️  数据库迁移已初始化，跳过")
            else:
                print(f"   ⚠️  初始化警告: {e}")
        
        # 生成迁移文件
        print("\n3. 生成迁移文件...")
        try:
            migrate_result = await command.migrate("update_platform_superadmin_table_name")
            if migrate_result:
                print(f"   ✅ 迁移文件生成成功: {migrate_result}")
            else:
                print("   ℹ️  没有检测到模型变化，无需生成迁移文件")
        except Exception as e:
            print(f"   ⚠️  生成迁移文件警告: {e}")
            # 如果是因为没有变化，这是正常的
            if "no changes" in str(e).lower() or "没有变化" in str(e).lower():
                print("   ℹ️  模型没有变化，这是正常的")
            else:
                import traceback
                traceback.print_exc()
        
        # 应用迁移
        print("\n4. 应用迁移...")
        try:
            upgrade_result = await command.upgrade()
            if upgrade_result:
                print(f"   ✅ 迁移应用成功")
                if isinstance(upgrade_result, list) and upgrade_result:
                    for result in upgrade_result:
                        print(f"      - {result}")
            else:
                print("   ℹ️  没有待应用的迁移")
        except Exception as e:
            print(f"   ❌ 应用迁移失败: {e}")
            import traceback
            traceback.print_exc()
            return
        
        print("\n" + "=" * 60)
        print("✅ 数据库迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 数据库迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == "__main__":
    asyncio.run(migrate_with_aerich())

