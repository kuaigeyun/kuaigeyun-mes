import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))

from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        rows = await conn.fetch("SELECT code, is_active FROM core_applications")
        for r in rows:
            print(f"App: {r['code']}, Active: {r['is_active']}")
    finally:
        await conn.close()

asyncio.run(main())
