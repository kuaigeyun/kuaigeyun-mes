"""
创建CRM模型的数据库迁移文件

使用 Aerich 生成迁移文件
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
from infra.infrastructure.database.database import TORTOISE_ORM


async def create_migration():
    """
    使用 Aerich 生成迁移文件
    """
    try:
        print("=" * 60)
        print("创建CRM模型的数据库迁移文件")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        print("\n1. 初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ Tortoise ORM 初始化成功")
        
        # 初始化 Aerich Command
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
        
        # 生成迁移文件
        print("\n3. 生成迁移文件...")
        try:
            migrate_result = await command.migrate(name="create_crm_models")
            print(f"   ✅ 迁移文件生成成功")
            print(f"   📄 {migrate_result}")
        except Exception as e:
            error_msg = str(e)
            if "no changes detected" in error_msg.lower() or "未检测到更改" in error_msg.lower():
                print("   ℹ️  未检测到模型更改，无需生成迁移文件")
            else:
                print(f"   ❌ 生成迁移文件失败: {error_msg}")
                raise
        
        print("\n" + "=" * 60)
        print("✅ 迁移文件创建完成")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(create_migration())
