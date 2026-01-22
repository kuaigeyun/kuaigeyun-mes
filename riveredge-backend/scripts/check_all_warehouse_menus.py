"""
检查所有仓库菜单数据（包括已删除的）
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


async def check_all_warehouse_menus():
    """检查所有仓库菜单数据"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 查找所有仓库相关的菜单（包括已删除的）
        all_menus = await Menu.filter(
            tenant_id=1,
            application_uuid='df31f29d-50ce-4679-b3d5-e823e447f9ba',
            path__contains='warehouse'
        ).all()
        
        print('所有仓库相关菜单（包括已删除的）:')
        for m in all_menus:
            deleted = '已删除' if m.deleted_at else '正常'
            print(f'  {m.name} ({m.path}) - sort_order: {m.sort_order} - {deleted} - uuid: {m.uuid}')
        
        # 查找通过路径查找的菜单
        print('\n通过路径查找的菜单:')
        paths = [
            '/apps/master-data/warehouse/warehouses',
            '/apps/master-data/warehouse/storage-areas',
            '/apps/master-data/warehouse/storage-locations'
        ]
        for path in paths:
            menus = await Menu.filter(
                tenant_id=1,
                application_uuid='df31f29d-50ce-4679-b3d5-e823e447f9ba',
                path=path,
                deleted_at__isnull=True
            ).all()
            print(f'  {path}:')
            for m in menus:
                print(f'    - {m.name} (uuid: {m.uuid}, parent_id: {m.parent_id})')
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_all_warehouse_menus())
