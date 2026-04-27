import asyncio
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'src'))
from infra.infrastructure.database.database import get_db_connection

async def main():
    conn = await get_db_connection()
    try:
        tenant_id = 1
        
        # Get all apps
        apps = await conn.fetch("SELECT uuid, code FROM core_applications")
        
        for app in apps:
            app_uuid = app["uuid"]
            
            # Check if installed
            exists = await conn.fetchrow("SELECT id FROM core_tenant_applications WHERE tenant_id = $1 AND application_uuid = $2", tenant_id, app_uuid)
            
            if exists:
                await conn.execute("UPDATE core_tenant_applications SET is_active = true WHERE id = $1", exists["id"])
            else:
                await conn.execute("INSERT INTO core_tenant_applications (tenant_id, application_uuid, is_active, created_at, updated_at) VALUES ($1, $2, true, now(), now())", tenant_id, app_uuid)
                
        print("Enabled ALL apps for tenant 1.")
        
    finally:
        await conn.close()

asyncio.run(main())
