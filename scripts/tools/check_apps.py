import asyncio
import sys
from pathlib import Path
import os

# 添加src目录到Python路径
sys.path.insert(0, str(Path(__file__).parent / 'riveredge-backend' / 'src'))

from tortoise import connections
from infra.infrastructure.database.database import register_db

async def check_apps():
    await register_db(None)
    conn = connections.get('default')
    rows = await conn.execute_query_dict('SELECT code, name, is_active, is_installed FROM core_applications')
    print('Applications in database:')
    for row in rows:
        print(f'  {row}')
    await connections.close_all()

if __name__ == '__main__':
    asyncio.run(check_apps())