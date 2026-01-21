"""
检查菜单数据
"""

import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.menu import Menu
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_menu():
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        menus = await Menu.filter(
            path='/apps/master-data/factory/plants',
            deleted_at__isnull=True
        ).all()
        
        print(f'找到菜单: {len(menus)}')
        for m in menus:
            print(f'  - {m.name} ({m.path})')
            
        # 也检查一下工厂数据下的所有菜单
        all_factory_menus = await Menu.filter(
            path__startswith='/apps/master-data/factory',
            deleted_at__isnull=True
        ).all()
        
        print(f'\n工厂数据下的所有菜单: {len(all_factory_menus)}')
        for m in all_factory_menus:
            print(f'  - {m.name} ({m.path})')
            
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_menu())
