"""
检查应用注册状态的脚本
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def check_apps():
    """检查数据库中的应用注册状态"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

    try:
        # 查询所有应用
        apps = await conn.fetch('SELECT id, code, name, is_active FROM core_applications ORDER BY id')

        print('📋 数据库中的应用列表:')
        for app in apps:
            status = '✅ 活跃' if app['is_active'] else '❌ 未激活'
            print(f'  {app["id"]}: {app["code"]} - {app["name"]} [{status}]')

        # 查找kuaizhizao应用
        kuaizhizao_app = await conn.fetchrow('SELECT * FROM core_applications WHERE code = $1', 'kuaizhizao')
        if kuaizhizao_app:
            print('\n🔍 kuaizhizao应用详情:')
            for key, value in kuaizhizao_app.items():
                print(f'  {key}: {value}')
        else:
            print('\n❌ kuaizhizao应用未在数据库中注册')

    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check_apps())
