"""
将 tree-root 迁移文件注册到 Aerich 版本表

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
    print(f"✅ 已加载 .env 文件: {env_path}")

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
        print("注册 tree-root 迁移文件到 Aerich")
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
            "10_create_sys_tables"
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
        """, next_id, "10_create_sys_tables", "models", "{}")
        
        print("   ✅ 迁移注册成功")
        
        # 验证
        print("\n3. 验证注册结果...")
        registered = await conn.fetchrow(
            "SELECT * FROM aerich WHERE version = $1",
            "10_create_sys_tables"
        )
        if registered:
            print(f"   ✅ 迁移已注册: ID={registered['id']}, 版本={registered['version']}")
        
        await conn.close()
        
        print("\n" + "=" * 60)
        print("✅ 注册完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 注册失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(register_migration())

