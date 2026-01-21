#!/usr/bin/env python3
import asyncio
import sys
import os
from pathlib import Path

# 添加后端src目录到Python路径
backend_src_path = Path(__file__).parent / 'riveredge-backend' / 'src'
sys.path.insert(0, str(backend_src_path))

from tortoise import connections
from infra.infrastructure.database.database import register_db

async def check_apps_in_db():
    """检查数据库中的应用记录"""
    try:
        await register_db(None)
        conn = connections.get('default')

        # 查询所有应用
        rows = await conn.execute_query_dict("""
            SELECT uuid, code, name, version, is_installed, is_active, route_path, entry_point
            FROM core_applications
            ORDER BY code
        """)

        print(f"Found {len(rows)} applications in database:")
        for row in rows:
            print(f"  - {row['code']}: {row['name']} (v{row['version']})")
            print(f"    active: {row['is_active']}, installed: {row['is_installed']}")
            print(f"    route_path: {row['route_path']}, entry_point: {row['entry_point']}")
            print()

        # 检查应用文件是否存在
        apps_path = backend_src_path / 'apps'
        print(f"Checking if app directories exist in {apps_path}:")
        for row in rows:
            app_code = row['code']
            app_path = apps_path / app_code
            manifest_path = app_path / 'manifest.json'
            router_path = app_path / 'api' / 'router.py'

            print(f"  {app_code}:")
            print(f"    directory exists: {app_path.exists()}")
            print(f"    manifest.json exists: {manifest_path.exists()}")
            print(f"    router.py exists: {router_path.exists()}")

            if manifest_path.exists():
                print(f"    manifest.json content preview:")
                try:
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # 只显示前几行
                        lines = content.split('\n')[:10]
                        for line in lines:
                            print(f"      {line}")
                        if len(content.split('\n')) > 10:
                            print("      ...")
                except Exception as e:
                    print(f"      Error reading manifest: {e}")
            print()

    except Exception as e:
        print(f"Error checking database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            await connections.close_all()
        except:
            pass

if __name__ == '__main__':
    asyncio.run(check_apps_in_db())