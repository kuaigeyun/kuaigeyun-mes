#!/usr/bin/env python3
"""
检查快格轻制造应用的菜单数据
"""

import os
import sys
import asyncio

# 添加后端路径
sys.path.append('riveredge-backend/src')

# 设置环境变量
os.environ['ENVIRONMENT'] = 'development'
os.environ['DATABASE_URL'] = 'postgresql://postgres:password@localhost:5432/riveredge'

async def check_kuaizhizao_menus():
    try:
        from infra.infrastructure.database.connection import get_db_connection

        conn = await get_db_connection()

        # 查询快格轻制造应用的菜单
        result = await conn.fetch('''
            SELECT m.name, m.path, m.icon, m.sort_order, m.created_at, m.updated_at
            FROM core_menus m
            JOIN core_applications a ON m.application_uuid = a.uuid
            WHERE a.code = 'kuaizhizao'
            ORDER BY m.sort_order, m.created_at
        ''')

        print('快格轻制造应用菜单:')
        print('=' * 50)
        for row in result:
            print(f'名称: {row["name"]}')
            print(f'路径: {row["path"]}')
            print(f'图标: {row["icon"]}')
            print(f'排序: {row["sort_order"]}')
            print(f'创建时间: {row["created_at"]}')
            print(f'更新时间: {row["updated_at"]}')
            print('-' * 30)

        await conn.close()

    except Exception as e:
        print(f'查询失败: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(check_kuaizhizao_menus())
