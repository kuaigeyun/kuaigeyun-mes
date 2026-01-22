"""
检查仓库菜单数据
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.menu import Menu
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_warehouse_menu():
    """检查仓库菜单数据"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 查找仓库相关的菜单
        menus = await Menu.filter(
            tenant_id=1,
            application_uuid='df31f29d-50ce-4679-b3d5-e823e447f9ba',
            path__contains='warehouse',
            deleted_at__isnull=True
        ).order_by('sort_order').all()
        
        print('仓库相关菜单:')
        for m in menus:
            print(f'  {m.name} ({m.path}) - sort_order: {m.sort_order}')
        
        # 查找仓库数据的父菜单
        parent_menus = await Menu.filter(
            tenant_id=1,
            application_uuid='df31f29d-50ce-4679-b3d5-e823e447f9ba',
            name__contains='仓库',
            deleted_at__isnull=True
        ).all()
        
        print('\n仓库数据父菜单:')
        for m in parent_menus:
            print(f'  {m.name} ({m.path}) - sort_order: {m.sort_order}, parent_id: {m.parent_id}')
            # 查找子菜单
            children = await Menu.filter(
                tenant_id=1,
                parent_id=m.id,
                deleted_at__isnull=True
            ).order_by('sort_order').all()
            for child in children:
                print(f'    - {child.name} ({child.path}) - sort_order: {child.sort_order}')
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_warehouse_menu())
