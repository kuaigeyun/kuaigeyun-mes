"""
检查 Aerich 迁移记录

查看数据库中已应用的迁移
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from platform.infrastructure.database.database import TORTOISE_ORM


async def check_migrations():
    """
    检查 Aerich 迁移记录
    """
    try:
        print("=" * 60)
        print("检查 Aerich 迁移记录")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 查询 aerich 表
        from tortoise import connections
        conn = connections.get("default")
        
        result = await conn.execute_query(
            """
            SELECT version, app 
            FROM aerich 
            WHERE app = 'models'
            ORDER BY id;
            """
        )
        
        migrations = result[1] if result[1] else []
        
        print(f"\n已应用的迁移 ({len(migrations)} 个):")
        if migrations:
            for mig in migrations:
                print(f"  - {mig[0]} (app: {mig[1]})")
        else:
            print("  ℹ️  没有已应用的迁移记录")
        
        # 检查迁移文件
        migrate_dir = Path(__file__).parent.parent / "migrations" / "models"
        if migrate_dir.exists():
            migration_files = sorted([f.name for f in migrate_dir.glob("*.py") if f.name != "__init__.py"])
            print(f"\n迁移文件 ({len(migration_files)} 个):")
            for f in migration_files:
                applied = any(mig[0] == f for mig in migrations)
                status = "✅ 已应用" if applied else "⏳ 待应用"
                print(f"  {status} - {f}")
        
        print("\n" + "=" * 60)
        
    except Exception as e:
        print(f"\n❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_migrations())

