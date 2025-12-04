"""
检查迁移状态

查看数据库中的迁移记录和表结构
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


async def check_status():
    """
    检查迁移状态
    """
    try:
        print("=" * 60)
        print("检查迁移状态")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        print("\n1. 初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        print("   ✅ Tortoise ORM 初始化成功")
        
        # 初始化 Aerich
        print("\n2. 初始化 Aerich...")
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        # 检查已应用的迁移
        print("\n3. 检查已应用的迁移...")
        from aerich.models import Aerich
        applied_migrations = await Aerich.filter(app="models").all()
        if applied_migrations:
            print(f"   已应用的迁移 ({len(applied_migrations)} 个):")
            for mig in applied_migrations:
                print(f"      - {mig.version}")
        else:
            print("   ℹ️  没有已应用的迁移")
        
        # 检查待应用的迁移
        print("\n4. 检查待应用的迁移...")
        heads = await command.heads()
        if heads:
            print(f"   待应用的迁移 ({len(heads)} 个):")
            for head in heads:
                print(f"      - {head}")
        else:
            print("   ℹ️  没有待应用的迁移")
        
        # 检查表是否存在
        print("\n5. 检查数据字典表...")
        from tortoise import connections
        conn = connections.get("default")
        
        # 检查 sys_data_dictionaries 表
        result = await conn.execute_query(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sys_data_dictionaries');"
        )
        dict_exists = result[1][0][0] if result[1] else False
        print(f"   sys_data_dictionaries: {'✅ 存在' if dict_exists else '❌ 不存在'}")
        
        # 检查 sys_dictionary_items 表
        result = await conn.execute_query(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sys_dictionary_items');"
        )
        items_exists = result[1][0][0] if result[1] else False
        print(f"   sys_dictionary_items: {'✅ 存在' if items_exists else '❌ 不存在'}")
        
        print("\n" + "=" * 60)
        print("✅ 检查完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 检查失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_status())

