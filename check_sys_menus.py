import asyncio
from pathlib import Path
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'src'))

from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        rows = await conn.fetch("SELECT * FROM core_menus WHERE path LIKE '%system%'")
        for r in rows:
            print(r["path"], r["permission_code"])
    finally:
        await conn.close()

asyncio.run(main())
