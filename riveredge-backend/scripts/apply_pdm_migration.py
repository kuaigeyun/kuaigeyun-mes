"""
应用PDM模型的数据库迁移

使用 Aerich 应用迁移文件
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


async def apply_migration():
    """
    使用 Aerich 应用迁移文件
    """
    try:
        print("=" * 60)
        print("应用PDM模型的数据库迁移")
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
        except Exception:
            # 如果已经初始化，忽略错误
            pass
        
        # 应用迁移
        print("\n3. 应用迁移...")
        await command.upgrade(run_in_transaction=True)
        print("   ✅ 迁移应用成功")
        
        print("\n" + "=" * 60)
        print("✅ 数据库迁移完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
