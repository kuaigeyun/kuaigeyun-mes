#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
重新同步主数据管理应用的菜单配置
确保菜单名称使用中文（从 manifest.json 的 title 字段）
"""

import sys
import os
import asyncio

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from core.services.application_service import ApplicationService
from core.services.menu_service import MenuService
from infra.infrastructure.database.database import TORTOISE_ORM
from tortoise import Tortoise


async def sync_menus():
    """同步主数据管理应用的菜单"""
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        tenant_id = 1  # 默认租户ID
        
        # 获取主数据管理应用
        app = await ApplicationService.get_application_by_code(
            tenant_id=tenant_id,
            code='master-data'
        )
        
        if not app:
            print('❌ 未找到主数据管理应用')
            return
        print(f'✅ 找到应用: {app.name} ({app.code})')
        
        if not app.menu_config:
            print('❌ 应用没有菜单配置')
            return
        
        # 重新同步菜单（使用修复后的逻辑，优先使用 title 字段）
        count = await MenuService.sync_menus_from_application_config(
            tenant_id=tenant_id,
            application_uuid=str(app.uuid),
            menu_config=app.menu_config,
            is_active=app.is_active
        )
        
        print(f'✅ 同步菜单完成，更新了 {count} 个菜单项')
        
        # 清除菜单缓存，确保前端立即看到更新
        await MenuService._clear_menu_cache(tenant_id)
        print('✅ 已清除菜单缓存')
        
    except Exception as e:
        print(f'❌ 同步菜单失败: {e}')
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == '__main__':
    asyncio.run(sync_menus())
