import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        # get application UUIDs installed for tenant
        rows = await conn.fetch("SELECT application_uuid, is_active FROM core_tenant_applications WHERE tenant_id = $1", tenant_id)
        if not rows:
            print("No tenant apps found. Checking core_applications directly.")
            apps = await conn.fetch("SELECT uuid, code FROM core_applications")
            for a in apps:
                print(f"App: {a['code']}, UUID: {a['uuid']}")
        else:
            for r in rows:
                app = await conn.fetchrow("SELECT code FROM core_applications WHERE uuid = $1", r["application_uuid"])
                print(f"App: {app['code']}, Active in Tenant: {r['is_active']}")
    finally:
        await conn.close()

asyncio.run(main())
