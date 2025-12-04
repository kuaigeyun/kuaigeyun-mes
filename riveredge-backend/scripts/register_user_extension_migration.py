"""
将 User 扩展迁移文件注册到 Aerich

从 .env 读取数据库配置，手动注册迁移文件
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv
import asyncpg

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from platform.config.platform_config import PlatformSettings

settings = PlatformSettings()


async def register_migration():
    """
    将迁移文件注册到 Aerich 版本表
    """
    try:
        print("=" * 60)
        print("注册 User 扩展迁移文件到 Aerich")
        print("=" * 60)
        
        # 连接数据库
        conn = await asyncpg.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
        )
        
        # 检查迁移是否已注册
        print("\n1. 检查迁移是否已注册...")
        existing = await conn.fetchrow(
            "SELECT * FROM aerich WHERE version = $1",
            "11_extend_user_model"
        )
        
        if existing:
            print("   ℹ️  迁移已注册，跳过")
            await conn.close()
            return
        
        # 获取当前最大 ID
        max_id = await conn.fetchval("SELECT MAX(id) FROM aerich")
        next_id = (max_id or 0) + 1
        
        # 注册迁移
        print(f"\n2. 注册迁移文件 (ID: {next_id})...")
        await conn.execute("""
            INSERT INTO aerich (id, version, app, content)
            VALUES ($1, $2, $3, $4)
        """, next_id, "11_extend_user_model", "models", "{}")
        
        print("   ✅ 迁移注册成功")
        
        # 应用迁移
        print("\n3. 应用迁移...")
        from tortoise import Tortoise
        from platform.infrastructure.database.database import TORTOISE_ORM
        
        await Tortoise.init(config=TORTOISE_ORM)
        from aerich import Command
        
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        upgrade_result = await command.upgrade()
        if upgrade_result:
            print(f"   ✅ 迁移应用成功")
        else:
            print("   ℹ️  没有待应用的迁移")
        
        await Tortoise.close_connections()
        await conn.close()
        
        print("\n" + "=" * 60)
        print("✅ 注册和应用完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(register_migration())

