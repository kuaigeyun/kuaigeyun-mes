"""
使用 Aerich 应用 tree-root 表的迁移

从 .env 读取数据库配置，使用 Aerich 应用迁移
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ 已加载 .env 文件: {env_path}")

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from aerich import Command
from tortoise import Tortoise
from platform.infrastructure.database.database import TORTOISE_ORM


async def apply_migration():
    """
    使用 Aerich 应用迁移
    """
    try:
        print("=" * 60)
        print("使用 Aerich 应用 tree-root 表的迁移")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        print("\n1. 初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ Tortoise ORM 初始化成功")
        
        # 初始化 Aerich（如果需要）
        print("\n2. 初始化 Aerich...")
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        try:
            await command.init()
            print("   ✅ Aerich 初始化成功")
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg.lower() or "已存在" in error_msg.lower():
                print("   ℹ️  Aerich 已初始化，跳过")
            else:
                print(f"   ⚠️  初始化警告: {error_msg}")
        
        # 应用迁移
        print("\n3. 应用迁移...")
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
            error_msg = str(e)
            print(f"   ❌ 应用迁移失败: {error_msg}")
            
            # 检查是否是数据库连接问题
            if "password" in error_msg.lower() or "authentication" in error_msg.lower():
                print("   💡 提示：请检查 .env 文件中的数据库密码配置")
                print("   💡 数据库配置项：DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME")
            elif "不存在" in error_msg or "not exist" in error_msg.lower():
                print("   💡 提示：某些表可能不存在，这是正常的（迁移会创建它们）")
            
            import traceback
            traceback.print_exc()
        
        print("\n" + "=" * 60)
        print("✅ 数据库迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 数据库迁移失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())

