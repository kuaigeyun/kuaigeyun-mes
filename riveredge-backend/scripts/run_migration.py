"""
运行数据库迁移脚本

用于生成和应用数据库迁移
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from aerich import Command
from soil.infrastructure.database.database import TORTOISE_ORM


async def run_migration():
    """
    运行数据库迁移
    
    生成迁移文件并应用到数据库
    """
    # 创建 Command 实例
    command = Command(
        tortoise_config=TORTOISE_ORM,
        app="models",
        location="./migrations"
    )
    
    # 初始化（如果需要）
    try:
        await command.init()
        print("迁移目录初始化成功")
    except Exception as e:
        print(f"迁移目录已存在或初始化失败: {e}")
    
    # 生成迁移文件
    print("正在生成迁移文件...")
    try:
        migrate_result = await command.migrate("update_platform_superadmin_table_name")
        if migrate_result:
            print(f"迁移文件生成成功: {migrate_result}")
        else:
            print("没有检测到模型变化，无需生成迁移文件")
    except Exception as e:
        print(f"生成迁移文件失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 应用迁移
    print("正在应用迁移...")
    try:
        upgrade_result = await command.upgrade(run_in_transaction=True)
        if upgrade_result:
            print(f"迁移应用成功: {upgrade_result}")
        else:
            print("没有待应用的迁移")
    except Exception as e:
        print(f"应用迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("数据库迁移完成！")


if __name__ == "__main__":
    asyncio.run(run_migration())

