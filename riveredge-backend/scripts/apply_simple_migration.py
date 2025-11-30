"""
应用简化的迁移文件（只创建 soil_platform_superadmin 表）
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from aerich import Command
from soil.infrastructure.database.database import TORTOISE_ORM
from tortoise import Tortoise


async def apply_migration():
    """
    应用迁移
    """
    try:
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ Tortoise ORM 初始化成功")
        
        # 创建 Command 实例
        command = Command(
            tortoise_config=TORTOISE_ORM,
            app="models",
            location="./migrations"
        )
        
        # 初始化 Aerich
        await command.init()
        print("✅ Aerich 初始化成功")
        
        # 应用迁移
        print("\n正在应用迁移...")
        result = await command.upgrade()
        
        if result:
            print(f"✅ 迁移应用成功")
            if isinstance(result, list) and result:
                for r in result:
                    print(f"   - {r}")
        else:
            print("ℹ️  没有待应用的迁移")
        
        # 关闭连接
        await Tortoise.close_connections()
        print("\n✅ 迁移完成！")
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())

