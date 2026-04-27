import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        rows = await conn.fetch("SELECT path, permission_code FROM core_menus WHERE application_uuid = (SELECT uuid FROM core_applications WHERE code='kuaizhizao' LIMIT 1)")
        for r in rows:
            if r["path"] and ("warehouse-management" in r["path"] or "equipment" in r["path"]):
                print(r["path"], "=>", r["permission_code"])
    finally:
        await conn.close()

asyncio.run(main())
