#!/usr/bin/env python3
"""
修复快格轻制造APP菜单同步问题
"""

import asyncio
import asyncpg
import json
from pathlib import Path

async def fix_kuaizhizao_menus():
    """修复快格轻制造APP的菜单数据"""

    # 连接数据库
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='postgres',
        password='jetema4ev',
        database='riveredge'
    )

    try:
        # 1. 检查应用是否存在
        app_result = await conn.fetchrow('''
            SELECT uuid, name, code, menu_config
            FROM core_applications
            WHERE code = 'kuaizhizao'
        ''')

        if not app_result:
            print('❌ 找不到快格轻制造APP')
            return

        print(f'✅ 找到应用: {app_result["name"]} (UUID: {app_result["uuid"]})')

        # 2. 读取manifest.json文件
        manifest_path = Path('riveredge-frontend/src/apps/kuaizhizao/manifest.json')
        if not manifest_path.exists():
            print(f'❌ manifest.json文件不存在: {manifest_path}')
            return

        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        print(f'✅ 读取manifest.json成功，版本: {manifest.get("version", "unknown")}')

        # 3. 更新应用的menu_config
        menu_config = manifest.get('menu_config')
        if not menu_config:
            print('❌ manifest.json中没有menu_config')
            return

        await conn.execute('''
            UPDATE core_applications
            SET menu_config = $1, updated_at = NOW()
            WHERE uuid = $2
        ''', json.dumps(menu_config, ensure_ascii=False), app_result['uuid'])

        print('✅ 更新应用menu_config成功')

        # 4. 删除现有的菜单数据
        delete_result = await conn.execute('''
            DELETE FROM core_menus
            WHERE application_uuid = $1
        ''', app_result['uuid'])

        print(f'✅ 删除现有菜单数据: {delete_result}')

        # 5. 重新创建菜单数据
        def create_menu_items(menu_items, parent_id=None, parent_uuid=None):
            """递归创建菜单项"""
            items = []
            for item in menu_items:
                menu_uuid = item.get('uuid') or f"kuaizhizao-{item.get('title', '').replace(' ', '-')}"
                menu_name = item.get('title', '')
                menu_path = item.get('path')
                menu_icon = item.get('icon')
                sort_order = item.get('sort_order', 0)
                permission_code = item.get('permission')

                items.append({
                    'uuid': menu_uuid,
                    'name': menu_name,
                    'path': menu_path,
                    'icon': menu_icon,
                    'sort_order': sort_order,
                    'permission_code': permission_code,
                    'parent_uuid': parent_uuid,
                    'children': item.get('children', [])
                })

                # 递归处理子菜单
                if item.get('children'):
                    items.extend(create_menu_items(item['children'], menu_uuid, menu_uuid))

            return items

        menu_tree = create_menu_items(menu_config.get('children', []))

        # 插入菜单数据
        for menu_item in menu_tree:
            await conn.execute('''
                INSERT INTO core_menus (
                    uuid, tenant_id, name, path, icon, component, permission_code,
                    application_uuid, parent_uuid, sort_order, is_active, is_external,
                    created_at, updated_at
                ) VALUES (
                    $1, 1, $2, $3, $4, NULL, $5, $6, $7, $8, true, false, NOW(), NOW()
                )
                ON CONFLICT (uuid) DO UPDATE SET
                    name = EXCLUDED.name,
                    path = EXCLUDED.path,
                    icon = EXCLUDED.icon,
                    permission_code = EXCLUDED.permission_code,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = NOW()
            ''', menu_item['uuid'], menu_item['name'], menu_item['path'],
                menu_item['icon'], menu_item['permission_code'], app_result['uuid'],
                menu_item['parent_uuid'], menu_item['sort_order'])

        print(f'✅ 重新创建菜单数据: {len(menu_tree)} 个菜单项')

        # 6. 验证菜单数据
        final_result = await conn.fetch('''
            SELECT name, path, sort_order
            FROM core_menus
            WHERE application_uuid = $1 AND is_active = true
            ORDER BY sort_order, created_at
        ''', app_result['uuid'])

        print('\n📋 最终菜单数据:')
        print('=' * 40)
        for row in final_result:
            print(f'  {row["name"]} - {row["path"]}')

        print('\n🎉 快格轻制造APP菜单修复完成！')
        print('请刷新浏览器查看效果。')

    except Exception as e:
        print(f'❌ 修复失败: {e}')
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(fix_kuaizhizao_menus())
