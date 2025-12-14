"""
运行主数据管理模型的数据库迁移

使用 Aerich 生成和应用迁移文件。
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

# 添加src目录到Python路径（必须在导入之前）
src_path = Path(__file__).parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# 确保 apps 目录可以被导入
apps_path = src_path / "apps"
if str(apps_path.parent) not in sys.path:
    sys.path.insert(0, str(apps_path.parent))

from aerich import Command
from aerich.migrate import Migrate
from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def run_migration():
    """
    运行数据库迁移
    """
    try:
        print("=" * 60)
        print("主数据管理模型 - 数据库迁移")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        print("\n1. 初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ Tortoise ORM 初始化成功")
        
        # 设置迁移位置
        migrate_location = Path(__file__).parent.parent / "migrations" / "models"
        Migrate.migrate_location = migrate_location
        Migrate.app = "models"
        
        # 初始化 Aerich Command
        print("\n2. 初始化 Aerich Command...")
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        # 应用迁移（迁移文件已手动创建）
        print("\n3. 应用迁移...")
        print("   ℹ️  迁移文件已手动创建: migrations/models/33_20250111_add_master_data_models.py")
        
        # 应用迁移
        print("\n5. 应用迁移...")
        try:
            upgrade_result = await command.upgrade()
            if upgrade_result:
                print(f"   ✅ 迁移应用成功: {upgrade_result}")
            else:
                print("   ℹ️  没有待应用的迁移")
        except Exception as e:
            error_msg = str(e)
            if "no upgrade items found" in error_msg.lower() or "没有待应用的迁移" in error_msg.lower():
                print("   ℹ️  没有待应用的迁移")
            else:
                print(f"   ⚠️  应用迁移时出错: {error_msg}")
                raise
        
        print("\n" + "=" * 60)
        print("✅ 数据库迁移完成")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(run_migration())

