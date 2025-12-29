#!/usr/bin/env python3
"""
直接更新数据库中的应用清单配置

绕过API，直接在数据库中更新应用的menu_config字段。
"""

import asyncio
import json
import asyncpg
from pathlib import Path

# 数据库配置
DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'postgres',
    'password': 'postgres',
    'database': 'riveredge'
}

async def direct_update_manifest():
    """直接在数据库中更新应用的menu_config"""

    try:
        # 读取manifest.json
        manifest_path = Path('riveredge-frontend/src/apps/kuaizhizao/manifest.json')
        if not manifest_path.exists():
            print(f'❌ manifest.json文件不存在: {manifest_path}')
            return

        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        print(f'📋 读取到应用配置: {manifest.get("name")} v{manifest.get("version")}')

        # 连接数据库
        conn = await asyncpg.connect(
            host=DATABASE_CONFIG['host'],
            port=DATABASE_CONFIG['port'],
            user=DATABASE_CONFIG['user'],
            password=DATABASE_CONFIG['password'],
            database=DATABASE_CONFIG['database']
        )

        try:
            # 查询应用
            app_query = '''
                SELECT * FROM core_applications
                WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                LIMIT 1
            '''

            app = await conn.fetchrow(app_query, 1, 'kuaizhizao')

            if not app:
                print('❌ 未找到快格轻制造应用')
                return

            print(f'🔍 找到应用: {app["name"]} (UUID: {app["uuid"]})')

            # 更新menu_config和version
            menu_config = manifest.get('menu_config')
            version = manifest.get('version', '1.0.1')

            if not menu_config:
                print('❌ manifest.json缺少menu_config')
                return

            # 执行更新 - 使用jsonb类型
            update_query = '''
                UPDATE core_applications
                SET menu_config = $1::jsonb, version = $2, updated_at = NOW()
                WHERE tenant_id = $3 AND uuid = $4 AND deleted_at IS NULL
            '''

            result = await conn.execute(update_query, menu_config, version, 1, str(app['uuid']))

            if result == 'UPDATE 1':
                print('✅ 应用配置更新成功！')
                print(f'📊 菜单项数量: {len(menu_config.get("children", []))}')
                print('💡 请刷新前端页面查看新菜单')
            else:
                print(f'❌ 更新失败: {result}')

        finally:
            await conn.close()

    except Exception as e:
        print(f'❌ 执行失败: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(direct_update_manifest())
